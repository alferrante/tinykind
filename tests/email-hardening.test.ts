import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { NextRequest } from "next/server";
import { Webhook } from "svix";

test("email reliability, complaint handling and bot protection", async (t) => {
  const directory = await mkdtemp(path.join(tmpdir(), "tinykind-email-test-"));
  process.env.TINYKIND_DATA_DIR = directory;
  process.env.TINYKIND_BACKUP_ON_WRITE = "0";
  process.env.TINYKIND_AUTH_SECRET = "local-test-auth-secret";
  process.env.RESEND_API_KEY = "local-test-email-key";
  process.env.TINYKIND_REACTION_FROM_EMAIL = "Tinykind <notifications@example.test>";
  process.env.RESEND_WEBHOOK_SECRET = `whsec_${Buffer.from("local-test-webhook-secret").toString("base64")}`;
  delete process.env.TURNSTILE_ENABLED;
  delete process.env.TURNSTILE_SITE_KEY;
  delete process.env.TURNSTILE_SECRET_KEY;
  const store = await import("../src/lib/store");
  const { sendTinyKindEmail } = await import("../src/lib/email");
  const { sendLoginLinkEmail, sendWeeklyReminderEmail } = await import("../src/lib/authNotification");
  const { sendReactionNotification } = await import("../src/lib/reactionNotification");
  const { sendOpenNotification } = await import("../src/lib/openNotification");
  const webhook = await import("../src/app/api/webhooks/resend/route");
  const login = await import("../src/app/api/auth/request-link/route");
  const { verifyLoginChallenge } = await import("../src/lib/botProtection");
  const originalFetch = globalThis.fetch;
  const sample = { toEmail: "person@example.test", subject: "Test", text: "Test body" };
  const success = () => new Response(JSON.stringify({ id: "local-provider-id" }), { status: 200 });
  const signedRequest = (type: string, to: string, id: string, bounceType = "Permanent", from = process.env.TINYKIND_REACTION_FROM_EMAIL!) => {
    const body = JSON.stringify({ type, created_at: new Date().toISOString(), data: { from, to: [to], bounce: { type: bounceType } } });
    const timestamp = new Date();
    return new Request("https://tinykind.example/api/webhooks/resend", { method: "POST", body, headers: {
      "svix-id": id, "svix-timestamp": String(Math.floor(timestamp.getTime()/1000)),
      "svix-signature": new Webhook(process.env.RESEND_WEBHOOK_SECRET!).sign(id, timestamp, body),
    } });
  };
  try {
    await t.test("accepted but disconnected request retries with one stable provider key", async () => {
      const keys: string[] = [];
      globalThis.fetch = async (_url, init) => {
        keys.push(new Headers(init?.headers).get("Idempotency-Key")!);
        if (keys.length === 1) throw new Error("accepted then disconnected");
        return success();
      };
      assert.equal((await sendTinyKindEmail({ ...sample, idempotencyKey: "retry-event" })).sent, true);
      assert.equal(keys.length, 2);
      assert.equal(keys[0], keys[1]);
      assert.equal((await sendTinyKindEmail({ ...sample, idempotencyKey: "retry-event" })).sent, true);
      assert.equal(keys.length, 2);
      assert.equal((await sendTinyKindEmail({ ...sample, idempotencyKey: "distinct-event" })).sent, true);
      assert.notEqual(keys[0], keys[2]);
      assert.equal((await sendTinyKindEmail({ ...sample, text: "changed", idempotencyKey: "retry-event" })).reason, "send-payload-conflict");
    });
    await t.test("concurrent same-event sends submit once; uncertain old events stay blocked", async () => {
      let calls = 0;
      globalThis.fetch = async () => { calls++; await new Promise((resolve) => setTimeout(resolve, 30)); return success(); };
      const results = await Promise.all(Array.from({ length: 5 }, () => sendTinyKindEmail({ ...sample, idempotencyKey: "parallel-event" })));
      assert.equal(calls, 1);
      assert.ok(results.some((result) => result.sent));
      const claim = await store.claimEmailDelivery("unknown-event", "payload-digest");
      assert.equal(claim.state, "claimed");
      if (claim.state === "claimed") await store.finishEmailDelivery("unknown-event", claim.claimId, false);
      const originalNow = Date.now;
      Date.now = () => originalNow() + 24 * 60 * 60 * 1000;
      try { assert.deepEqual(await store.claimEmailDelivery("unknown-event", "payload-digest"), { state: "blocked", reason: "delivery-status-unknown" }); } finally { Date.now = originalNow; }
    });
    await t.test("notification revisions and open attempts have stable logical event IDs", async () => {
      const message = await store.createMessage({ senderName: "Sender", body: "Thanks." });
      const first = await store.upsertReaction({ slug: message.shortLinkSlug, emoji: "❤️", recipientFingerprint: "fingerprint" });
      const unchanged = await store.upsertReaction({ slug: message.shortLinkSlug, emoji: "❤️", recipientFingerprint: "fingerprint" });
      const changed = await store.upsertReaction({ slug: message.shortLinkSlug, emoji: "😊", recipientFingerprint: "fingerprint" });
      assert.equal(first.reaction.notificationId, unchanged.reaction.notificationId);
      assert.notEqual(unchanged.reaction.notificationId, changed.reaction.notificationId);
      const a = await store.recordOpen({ slug: message.shortLinkSlug, recipientFingerprint: "fingerprint" });
      const b = await store.recordOpen({ slug: message.shortLinkSlug, recipientFingerprint: "fingerprint" });
      assert.equal(a.notificationKey, b.notificationKey);
      const originalNow = Date.now;
      const OriginalDate = Date;
      const future = originalNow() + 31 * 60 * 1000;
      // Store uses new Date for open timestamps, so advance both constructors and Date.now.
      globalThis.Date = class extends OriginalDate { constructor(value?: string | number) { super(value ?? future); } static now() { return future; } } as DateConstructor;
      try { assert.notEqual((await store.recordOpen({ slug: message.shortLinkSlug, recipientFingerprint: "fingerprint" })).notificationKey, a.notificationKey); } finally { globalThis.Date = OriginalDate; }
    });
    await t.test("signed complaints persist once and suppress every email type and Gmail alias", async () => {
      assert.equal((await webhook.POST(signedRequest("email.complained", "first.last+one@gmail.com", "event-complaint"))).status, 200);
      assert.equal((await webhook.POST(signedRequest("email.complained", "first.last+one@gmail.com", "event-complaint"))).status, 200);
      assert.equal(await store.isEmailSuppressed("firstlast+two@googlemail.com"), true);
      const db = JSON.parse(await readFile(path.join(directory, "tinykind.json"), "utf8"));
      assert.equal(db.emailSuppressions.length, 1);
      assert.equal(db.emailWebhookEvents.filter((id: string) => id === "event-complaint").length, 1);
      let calls = 0;
      globalThis.fetch = async () => { calls++; return success(); };
      const toEmail = "firstlast@gmail.com";
      for (const result of await Promise.all([
        sendLoginLinkEmail({ toEmail, loginUrl: "https://tinykind.example/auth/callback?token=test" }),
        sendWeeklyReminderEmail({ toEmail, appUrl: "https://tinykind.example" }),
        sendReactionNotification({ toEmail, senderName: "Sender", recipientName: "Recipient", emoji: "❤️", messageUrl: "https://tinykind.example/t/test" }),
        sendOpenNotification({ toEmail, senderName: "Sender", recipientName: "Recipient", messageUrl: "https://tinykind.example/t/test" }),
      ])) assert.equal(result.reason, "recipient-suppressed");
      assert.equal(calls, 0);
    });
    await t.test("forged, stale and altered webhooks cannot suppress; unrelated sender and soft bounces stay unaffected", async () => {
      const valid = signedRequest("email.complained", "untouched@example.test", "forged-event");
      const body = await valid.text();
      const headers = new Headers(valid.headers);
      assert.equal((await webhook.POST(new Request(valid.url, { method: "POST", body: body.replace("untouched", "victim"), headers }))).status, 400);
      headers.set("svix-timestamp", "1");
      assert.equal((await webhook.POST(new Request(valid.url, { method: "POST", body, headers }))).status, 400);
      assert.equal(await store.isEmailSuppressed("victim@example.test"), false);
      assert.equal((await webhook.POST(signedRequest("email.complained", "unrelated@example.test", "other-sender-event", "Permanent", "Other <other@example.test>"))).status, 200);
      assert.equal(await store.isEmailSuppressed("unrelated@example.test"), false);
      assert.equal((await webhook.POST(signedRequest("email.bounced", "soft@example.test", "soft-event", "Transient"))).status, 200);
      assert.equal(await store.isEmailSuppressed("soft@example.test"), false);
      assert.equal((await webhook.POST(signedRequest("email.bounced", "hard@example.test", "hard-event"))).status, 200);
      assert.equal(await store.isEmailSuppressed("hard@example.test"), true);
      assert.equal((await webhook.POST(new Request(valid.url, { method: "POST", body: "x".repeat(65*1024), headers: valid.headers }))).status, 400);
    });
    await t.test("suppression arriving during a failed send prevents further retries", async () => {
      let calls = 0;
      globalThis.fetch = async () => { calls++; await store.recordEmailSuppression("during-send", ["during@example.test"], "complaint"); return new Response("temporary error", { status: 500 }); };
      const result = await sendTinyKindEmail({ ...sample, toEmail: "during@example.test", idempotencyKey: "during-event" });
      assert.equal(result.reason, "recipient-suppressed");
      assert.equal(calls, 1);
    });
    await t.test("bot verification rejects invalid action, hostname, missing token and provider failures", async () => {
      process.env.TURNSTILE_ENABLED = "1";
      process.env.TURNSTILE_SITE_KEY = "local-test-site-key";
      process.env.TURNSTILE_SECRET_KEY = "local-test-secret-key";
      assert.equal(await verifyLoginChallenge(undefined), false);
      for (const value of [ {success:false}, {success:true, hostname:"evil.example", action:"auth-login"}, {success:true, hostname:"tinykind.app", action:"wrong-action"} ]) {
        globalThis.fetch = async () => new Response(JSON.stringify(value));
        assert.equal(await verifyLoginChallenge("token"), false);
      }
      globalThis.fetch = async () => { throw new Error("verification unavailable"); };
      assert.equal(await verifyLoginChallenge("token"), false);
      delete process.env.TURNSTILE_SECRET_KEY;
      assert.equal(await verifyLoginChallenge("token"), false);
      process.env.TURNSTILE_SECRET_KEY = "local-test-secret-key";
    });
    await t.test("failed challenge reserves no quota or email; verified challenge allows legitimate send", async () => {
      let providerCalls = 0;
      globalThis.fetch = async (url) => {
        if (String(url).includes("siteverify")) return new Response(JSON.stringify({ success:false }));
        providerCalls++; return success();
      };
      const request = () => new NextRequest("https://tinykind.app/api/auth/request-link", { method: "POST", headers: { "Content-Type":"application/json", "x-forwarded-for":"192.0.2.15" }, body: JSON.stringify({ email:"bot-control@example.test", challengeToken:"token" }) });
      const before = JSON.parse(await readFile(path.join(directory,"tinykind.json"),"utf8")).authRequests.length;
      assert.equal((await login.POST(request())).status, 403);
      assert.equal(JSON.parse(await readFile(path.join(directory,"tinykind.json"),"utf8")).authRequests.length, before);
      assert.equal(providerCalls, 0);
      globalThis.fetch = async (url) => {
        if (String(url).includes("siteverify")) return new Response(JSON.stringify({ success:true, hostname:"tinykind.app", action:"auth-login" }));
        providerCalls++; return success();
      };
      assert.equal((await login.POST(request())).status, 200);
      assert.equal(providerCalls, 1);
    });
  } finally { globalThis.fetch = originalFetch; await rm(directory, { recursive:true, force:true }); }
});
