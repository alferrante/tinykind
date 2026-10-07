import { NextResponse } from "next/server";
import { Webhook } from "svix";
import { recordEmailSuppression } from "@/lib/store";

export const runtime = "nodejs";
const MAX_BODY_BYTES = 64 * 1024;

async function readBody(request: Request): Promise<string> {
  if (Number(request.headers.get("content-length")) > MAX_BODY_BYTES) throw new Error("body-too-large");
  const reader = request.body?.getReader();
  if (!reader) throw new Error("missing-body");
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_BODY_BYTES) { await reader.cancel(); throw new Error("body-too-large"); }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString("utf8");
}

function mailbox(value: string): string {
  return (value.match(/<([^<>]+)>/)?.[1] ?? value).trim().toLowerCase();
}

export async function POST(request: Request): Promise<NextResponse> {
  const secret = process.env.RESEND_WEBHOOK_SECRET?.trim();
  if (!secret) return NextResponse.json({ error: "Webhook not configured." }, { status: 503 });
  let verified: unknown;
  const eventId = request.headers.get("svix-id") ?? "";
  try {
    const body = await readBody(request);
    new Webhook(secret).verify(body, {
      "svix-id": eventId,
      "svix-timestamp": request.headers.get("svix-timestamp") ?? "",
      "svix-signature": request.headers.get("svix-signature") ?? "",
    });
    verified = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: "Invalid webhook." }, { status: 400 });
  }
  if (!verified || typeof verified !== "object") return NextResponse.json({ error: "Invalid event." }, { status: 400 });
  const event = verified as { type?: unknown; data?: { from?: unknown; to?: unknown; bounce?: { type?: unknown } } };
  const complaint = event.type === "email.complained";
  const hardBounce = event.type === "email.bounced" && event.data?.bounce?.type === "Permanent";
  if (!complaint && !hardBounce) return NextResponse.json({ ok: true });
  const from = event.data?.from;
  const expected = process.env.TINYKIND_REACTION_FROM_EMAIL;
  if (!expected) return NextResponse.json({ error: "Sender not configured." }, { status: 503 });
  if (typeof from !== "string" || mailbox(from) !== mailbox(expected)) return NextResponse.json({ ok: true });
  const addresses = event.data?.to;
  if (!Array.isArray(addresses) || !addresses.length || addresses.length > 100 ||
    addresses.some((address) => typeof address !== "string" || address.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address))) {
    return NextResponse.json({ error: "Invalid recipients." }, { status: 400 });
  }
  try {
    await recordEmailSuppression(eventId, addresses, complaint ? "complaint" : "hard-bounce");
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Unable to persist event." }, { status: 503 });
  }
}
