import { NextRequest, NextResponse } from "next/server";
import { enforceRateLimit } from "@/lib/rateLimit";
import { getAuthenticatedSenderEmailFromRequest } from "@/lib/senderAuth";
import { createMessage } from "@/lib/store";
import type { Channel, DeliveryMode, UnwrapStyle } from "@/lib/types";

interface SendRequest {
  senderName?: string;
  senderNotifyEmail?: string;
  recipientName?: string;
  recipientEmail?: string;
  recipientContact?: string;
  body?: string;
  website?: string;
  deliveryMode?: DeliveryMode;
  channel?: Channel;
  unwrapStyle?: UnwrapStyle;
}

function countUrls(value: string): number {
  const matches = value.match(/https?:\/\/|www\./gi);
  return matches ? matches.length : 0;
}

function looksLikeSpamBody(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  if (countUrls(trimmed) > 2) {
    return "Please keep TinyKind notes personal and avoid multiple links.";
  }
  if (/(.)\1{11,}/.test(trimmed)) {
    return "Please rewrite your note in plain language.";
  }
  const upperCount = (trimmed.match(/[A-Z]/g) ?? []).length;
  if (trimmed.length >= 30 && upperCount / trimmed.length > 0.6) {
    return "Please use normal sentence case for your TinyKind note.";
  }
  return null;
}

function looksLikeEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function buildShareEmail(senderName: string, messageUrl: string): {
  subject: string;
  body: string;
  preview: string;
} {
  const subject = `A TinyKind from ${senderName}`;
  const bodyLines = [`You've received a TinyKind from ${senderName}: ${messageUrl}`, "", "Made with tinykind"];
  const body = bodyLines.join("\n");
  const preview = `You've received a TinyKind from ${senderName}: ${messageUrl}`;
  return { subject, body, preview };
}

function buildGmailComposeUrl(to: string | null, subject: string, body: string): string {
  const params = new URLSearchParams({
    view: "cm",
    fs: "1",
    su: subject,
    body,
  });
  if (to) {
    params.set("to", to);
  }
  return `https://mail.google.com/mail/?${params.toString()}`;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const limiter = enforceRateLimit(request, {
      scope: "send",
      maxHits: 20,
      windowMs: 60_000,
    });
    if (!limiter.ok) {
      return NextResponse.json(
        { error: "Too many send attempts. Please wait a minute and try again." },
        { status: 429, headers: { "Retry-After": String(limiter.retryAfterSeconds) } },
      );
    }

    const payload = (await request.json()) as SendRequest;
    if ((payload.website ?? "").trim()) {
      return NextResponse.json({ error: "Unable to process request." }, { status: 400 });
    }
    const bodyText = payload.body?.trim() ?? "";
    const spamReason = looksLikeSpamBody(bodyText);
    if (spamReason) {
      return NextResponse.json({ error: spamReason }, { status: 400 });
    }
    const recipientEmailInput = payload.recipientEmail?.trim() || payload.recipientContact?.trim() || "";
    const requestedDeliveryMode: DeliveryMode | null =
      payload.deliveryMode === "email" || payload.deliveryMode === "link" ? payload.deliveryMode : null;
    const deliveryMode: DeliveryMode = requestedDeliveryMode ?? (recipientEmailInput ? "email" : "link");
    const authenticatedEmail = getAuthenticatedSenderEmailFromRequest(request);
    const senderNotifyEmail = payload.senderNotifyEmail?.trim() || authenticatedEmail || null;
    if (requestedDeliveryMode === "email" && !recipientEmailInput) {
      throw new Error("Recipient email is required when delivery mode is Send in email.");
    }
    if (recipientEmailInput && !looksLikeEmail(recipientEmailInput)) {
      throw new Error("Recipient email must be a valid email address.");
    }
    if (recipientEmailInput) {
      const recipientLimiter = enforceRateLimit(request, {
        scope: "send-recipient",
        maxHits: 8,
        windowMs: 60 * 60 * 1000,
        keySuffix: recipientEmailInput.toLowerCase(),
      });
      if (!recipientLimiter.ok) {
        return NextResponse.json(
          { error: "That recipient has reached the hourly send limit. Try again later." },
          { status: 429, headers: { "Retry-After": String(recipientLimiter.retryAfterSeconds) } },
        );
      }
    }

    const message = await createMessage({
      senderName: payload.senderName ?? "",
      senderNotifyEmail,
      recipientName: payload.recipientName ?? "",
      recipientContact: recipientEmailInput || null,
      body: bodyText,
      deliveryMode,
      channel: payload.channel ?? (deliveryMode === "email" ? "email" : "sms"),
      unwrapStyle: payload.unwrapStyle,
    });

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? request.nextUrl.origin;
    const messageUrl = `${baseUrl}/t/${message.shortLinkSlug}`;
    const recipientEmail =
      message.recipientContact && looksLikeEmail(message.recipientContact)
        ? message.recipientContact
        : null;
    const emailDraft = buildShareEmail(message.senderName, messageUrl);
    const gmailComposeUrl =
      deliveryMode === "email" ? buildGmailComposeUrl(recipientEmail, emailDraft.subject, emailDraft.body) : null;

    return NextResponse.json(
      {
        message,
        messageUrl,
        deliveryMode,
        recipientEmail,
        gmailComposeUrl,
        emailSubject: emailDraft.subject,
        emailBody: emailDraft.body,
        sharePreview: emailDraft.preview,
      },
      { status: 201 },
    );
  } catch (error) {
    const details = error instanceof Error ? error.message : "Unable to send TinyKind.";
    return NextResponse.json({ error: details }, { status: 400 });
  }
}
