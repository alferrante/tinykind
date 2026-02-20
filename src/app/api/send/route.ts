import { NextRequest, NextResponse } from "next/server";
import { createMessage } from "@/lib/store";
import type { Channel, UnwrapStyle } from "@/lib/types";

interface SendRequest {
  senderName?: string;
  senderNotifyEmail?: string;
  recipientName?: string;
  recipientContact?: string;
  body?: string;
  channel?: Channel;
  unwrapStyle?: UnwrapStyle;
}

function looksLikeEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function buildShareEmail(senderName: string, recipientName: string, messageUrl: string): {
  subject: string;
  body: string;
  preview: string;
} {
  const subject = `A TinyKind from ${senderName}`;
  const bodyLines = [
    `Hi ${recipientName},`,
    "",
    `You've received a TinyKind from ${senderName}.`,
    "",
    `Open your TinyKind: ${messageUrl}`,
    "",
    "Made with tinykind",
  ];
  const body = bodyLines.join("\n");
  const preview = `You've received a TinyKind from ${senderName}.\n\n${messageUrl}`;
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
    const payload = (await request.json()) as SendRequest;
    const recipientEmailInput = payload.recipientContact?.trim() ?? "";
    if (recipientEmailInput && !looksLikeEmail(recipientEmailInput)) {
      throw new Error("Recipient email must be a valid email address.");
    }

    const message = await createMessage({
      senderName: payload.senderName ?? "",
      senderNotifyEmail: payload.senderNotifyEmail ?? null,
      recipientName: payload.recipientName ?? "",
      recipientContact: recipientEmailInput || null,
      body: payload.body ?? "",
      channel: payload.channel,
      unwrapStyle: payload.unwrapStyle,
    });

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? request.nextUrl.origin;
    const messageUrl = `${baseUrl}/t/${message.shortLinkSlug}`;
    const recipientEmail =
      message.recipientContact && looksLikeEmail(message.recipientContact)
        ? message.recipientContact
        : null;
    const emailDraft = buildShareEmail(message.senderName, message.recipientName, messageUrl);
    const gmailComposeUrl = buildGmailComposeUrl(recipientEmail, emailDraft.subject, emailDraft.body);

    return NextResponse.json(
      {
        message,
        messageUrl,
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
