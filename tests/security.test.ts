import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile, rm, chmod } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createHmac } from "node:crypto";
import { NextRequest } from "next/server";

const exec = promisify(execFile);
test("security regression boundaries", async (t) => {
const directory = await mkdtemp(path.join(tmpdir(), "tinykind-security-test-"));
process.env.TINYKIND_DATA_DIR = directory;
process.env.TINYKIND_BACKUP_ON_WRITE = "0";
process.env.TINYKIND_AUTH_SECRET = "local-test-secret-not-a-production-credential";
process.env.RESEND_API_KEY = "local-test-key";
process.env.TINYKIND_REACTION_FROM_EMAIL = "test@example.test";
const store = await import("../src/lib/store");
const auth = await import("../src/lib/senderAuth");
const send = await import("../src/app/api/send/route");
const requestLink = await import("../src/app/api/auth/request-link/route");
const callback = await import("../src/app/auth/callback/route");
const reactions = await import("../src/app/api/reactions/route");
const opens = await import("../src/app/api/opens/route");
let deliveries: { to: string[]; text: string }[] = [];
const originalFetch = globalThis.fetch;
globalThis.fetch = async (_input, init) => {
  deliveries.push(JSON.parse(String(init?.body)));
  return new Response(JSON.stringify({ id: "local-provider-test" }), { status: 200 });
};
function request(url: string, body: object, cookie = "", ip = "192.0.2.1"): NextRequest {
  return new NextRequest(`https://tinykind.example${url}`, { method: "POST", headers: { "content-type": "application/json", cookie, "x-forwarded-for": ip }, body: JSON.stringify(body) });
}
const worker = (mode: string, count = 0) => exec(process.execPath, ["--import", "tsx", "tests/store-worker.ts", mode, String(count)], { env: process.env });

  try {
    await t.test("anonymous and signed-in requests cannot claim another sender", async () => {
      const guest = await send.POST(request("/api/send", { senderName: "Guest", senderNotifyEmail: "victim@example.test", body: "Thank you." }));
      assert.equal(guest.status, 201);
      const guestMessage = (await guest.json()).message;
      assert.equal(guestMessage.senderNotifyEmail, null);
      assert.equal(await store.getSenderProfile("victim@example.test"), null);
      const cookie = `${auth.SENDER_SESSION_COOKIE}=${auth.createSessionToken("owner@example.test")}`;
      const signed = await send.POST(request("/api/send", { senderName: "Owner", senderNotifyEmail: "victim@example.test", body: "Thank you." }, cookie));
      assert.equal(signed.status, 201);
      const signedMessage = (await signed.json()).message;
      assert.equal(signedMessage.senderNotifyEmail, "owner@example.test");
      assert.equal(signedMessage.senderNotifyVerified, true);
      assert.equal(await store.getSenderProfile("victim@example.test"), null);
      const legacy = await store.createMessage({ senderName: "Legacy", senderNotifyEmail: "legacy@example.test", body: "Thank you." });
      deliveries = [];
      for (const message of [guestMessage, legacy]) {
        assert.equal((await reactions.POST(request("/api/reactions", { slug: message.shortLinkSlug, emoji: "❤️" }))).status, 201);
        assert.equal((await opens.POST(request("/api/opens", { slug: message.shortLinkSlug }))).status, 201);
      }
      assert.equal(deliveries.length, 0);
      const legitimate = await reactions.POST(request("/api/reactions", { slug: signedMessage.shortLinkSlug, emoji: "❤️" }));
      assert.equal(legitimate.status, 201);
      assert.equal(deliveries.length, 1);
      assert.deepEqual(deliveries[0].to, ["owner@example.test"]);
    });
    await t.test("email cooldown survives client changes and Gmail aliases", async () => {
      deliveries = [];
      assert.equal((await requestLink.POST(request("/api/auth/request-link", { email: "First.Last+one@gmail.com" }, "", "192.0.2.2"))).status, 200);
      assert.equal((await requestLink.POST(request("/api/auth/request-link", { email: "firstlast+two@googlemail.com" }, "", "192.0.2.3"))).status, 429);
      assert.equal(deliveries.length, 1);
      assert.equal(await store.getSenderProfile("first.last+one@gmail.com"), null);
      assert.equal((await requestLink.POST(request("/api/auth/request-link", { email: "different@example.test" }, "", "192.0.2.4"))).status, 200);
    });
    await t.test("email reservations are atomic across independent processes", async () => {
      const outcomes = await Promise.all(Array.from({ length: 4 }, () => worker("reserve")));
      assert.equal(outcomes.filter(({ stdout }) => JSON.parse(stdout).ok).length, 1);
    });
    await t.test("daily destination and global budgets", async () => {
      const file = path.join(directory, "tinykind.json");
      const db = JSON.parse(await readFile(file, "utf8"));
      const saved = db.authRequests;
      const now = Date.now();
      const { createHash } = await import("node:crypto");
      const digest = createHash("sha256").update("budget@example.test").digest("hex");
      db.authRequests = [8, 6, 4].map((hours) => ({ destination: digest, timestamp: now - hours * 3600000 }));
      await writeFile(file, JSON.stringify(db));
      assert.equal((await store.reserveAuthEmail("budget@example.test")).ok, false);
      db.authRequests = Array.from({ length: 100 }, (_, i) => ({ destination: String(i), timestamp: now - 1000 }));
      await writeFile(file, JSON.stringify(db));
      assert.equal((await store.reserveAuthEmail("fresh@example.test")).ok, false);
      db.authRequests = Array.from({ length: 300 }, (_, i) => ({ destination: String(i), timestamp: now - 7200000 }));
      await writeFile(file, JSON.stringify(db));
      assert.equal((await store.reserveAuthEmail("fresh@example.test")).ok, false);
      db.authRequests = saved;
      await writeFile(file, JSON.stringify(db));
    });
    await t.test("magic and session tokens are purpose-bound; legacy and expired tokens fail", async () => {
      const magic = auth.createMagicLinkToken("person@example.test");
      const session = auth.createSessionToken("person@example.test");
      assert.equal(auth.verifyMagicLinkToken(magic).email, "person@example.test");
      assert.equal(auth.verifySessionToken(session)?.email, "person@example.test");
      assert.equal(auth.verifySessionToken(magic), null);
      assert.throws(() => auth.verifyMagicLinkToken(session));
      const payload = `v1|person@example.test|${Math.floor(Date.now()/1000)+1000}`;
      const signature = createHmac("sha256", process.env.TINYKIND_AUTH_SECRET!).update(payload).digest("base64url");
      assert.equal(auth.verifySessionToken(Buffer.from(`${payload}|${signature}`).toString("base64url")), null);
      const originalNow = Date.now;
      Date.now = () => originalNow() + 21 * 60 * 1000;
      try { assert.throws(() => auth.verifyMagicLinkToken(magic)); } finally { Date.now = originalNow; }
    });
    await t.test("parallel link redemption yields one session and replay fails", async () => {
      const token = auth.createMagicLinkToken("redeem@example.test");
      const url = `https://tinykind.example/auth/callback?token=${token}&next=/dashboard`;
      const responses = await Promise.all([callback.GET(new NextRequest(url)), callback.GET(new NextRequest(url))]);
      assert.equal(responses.filter((response) => response.cookies.get(auth.SENDER_SESSION_COOKIE)).length, 1);
      assert.equal((await callback.GET(new NextRequest(url))).cookies.get(auth.SENDER_SESSION_COOKIE), undefined);
      assert.equal((await callback.GET(new NextRequest(url.replace(token, token + "=")))).cookies.get(auth.SENDER_SESSION_COOKIE), undefined);
      assert.equal(responses.filter((response) => response.headers.get("location")?.includes("invalid_or_expired")).length, 1);
    });
    await t.test("redirect normalization rejects external, backslash and API forms", () => {
      for (const input of ["/foo/..//evil.example", "/.//evil.example", "/%2e//evil.example", "//evil.example", "/\\evil.example", "/%2e%2e/api/send", "/api/send", "/api", "/\nevil.example"]) assert.equal(auth.sanitizePostAuthPath(input), "/dashboard");
      assert.equal(auth.sanitizePostAuthPath("/dashboard?tab=sent#recent"), "/dashboard?tab=sent#recent");
      assert.equal(auth.sanitizePostAuthPath("/admin", "/admin"), "/admin");
    });
    await t.test("invalid new timezones fail and legacy bad profiles do not stop reminders", async () => {
      const input = { enabled: true, weekday: 2, hour: 12, minute: 0, timezone: "UTC" };
      await assert.rejects(store.updateReminderSettings("bad@example.test", { ...input, timezone: "invalid/timezone" }));
      await store.updateReminderSettings("healthy@example.test", input);
      await store.ensureSenderProfile("legacybad@example.test");
      const file = path.join(directory, "tinykind.json");
      const db = JSON.parse(await readFile(file, "utf8"));
      db.senderProfiles.find((profile: { email: string }) => profile.email === "legacybad@example.test").reminder = { ...input, timezone: "invalid/timezone" };
      await writeFile(file, JSON.stringify(db));
      assert.deepEqual((await store.listDueReminders(new Date("2026-10-06T12:00:00Z"))).map((entry) => entry.senderEmail), ["healthy@example.test"]);
    });
    await t.test("parallel heterogeneous writes and separate processes preserve all records", async () => {
      const before = (await store.listRecentMessages(1000)).length;
      await Promise.all([
        ...Array.from({ length: 20 }, (_, index) => store.createMessage({ senderName: `Sender ${index}`, body: "Thank you." })),
        ...Array.from({ length: 20 }, (_, index) => store.ensureSenderProfile(`parallel${index}@example.test`)),
        worker("write", 10), worker("write", 10),
      ]);
      assert.equal((await store.listRecentMessages(1000)).length, before + 40);
      const db = JSON.parse(await readFile(path.join(directory, "tinykind.json"), "utf8"));
      assert.equal(db.senderProfiles.filter((profile: { email: string }) => /^parallel\d+@/.test(profile.email)).length, 20);
    });
    await t.test("AppleScript receives malicious-looking text only as arguments", async () => {
      const executable = path.join(directory, "osascript");
      const capture = path.join(directory, "capture.json");
      await writeFile(executable, `#!${process.execPath}\nconst fs=require('node:fs');fs.writeFileSync(process.env.CAPTURE,JSON.stringify({args:process.argv.slice(2),source:fs.readFileSync(0,'utf8')}));\n`);
      await chmod(executable, 0o700);
      const body = '\\" & do shell script "touch /tmp/should-not-exist"\nsecond line';
      for (const mode of ["compose", "send"]) {
        await exec("bash", [".agents/skills/tinykind/scripts/send_imessage.sh", "--to", 'quoted\\"@example.test', "--body", body, "--mode", mode], { env: { ...process.env, PATH: `${directory}:${process.env.PATH}`, CAPTURE: capture } });
        const result = JSON.parse(await readFile(capture, "utf8"));
        assert.equal(result.args[1], 'quoted\\"@example.test');
        assert.equal(result.args[2], body);
        assert.ok(result.source.includes("on run argv"));
        assert.ok(!result.source.includes("should-not-exist"));
      }
    });
  } finally {
    globalThis.fetch = originalFetch;
    await rm(directory, { recursive: true, force: true });
  }
});
