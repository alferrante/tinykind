import { NextRequest, NextResponse } from "next/server";
import { createMessage, listRecentMessages } from "@/lib/store";
import { isAdminRequest } from "@/lib/adminAuth";
import type { Channel, UnwrapStyle } from "@/lib/types";

interface CreateMessageRequest {
  senderName?: string;
  recipientName?: string;
  recipientContact?: string;
  body?: string;
  channel?: Channel;
  unwrapStyle?: UnwrapStyle;
  rawText?: string | null;
  voiceUrl?: string | null;
  voiceDurationSeconds?: number | null;
  transcriptRaw?: string | null;
  transcriptCleaned?: string | null;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  const messages = await listRecentMessages();
  return NextResponse.json({ messages });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  try {
    const payload = (await request.json()) as CreateMessageRequest;
    const message = await createMessage({
      senderName: payload.senderName ?? "",
      recipientName: payload.recipientName ?? "",
      recipientContact: payload.recipientContact ?? "",
      body: payload.body ?? "",
      channel: payload.channel,
      unwrapStyle: payload.unwrapStyle,
      rawText: payload.rawText,
      voiceUrl: payload.voiceUrl,
      voiceDurationSeconds: payload.voiceDurationSeconds,
      transcriptRaw: payload.transcriptRaw,
      transcriptCleaned: payload.transcriptCleaned,
    });

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? request.nextUrl.origin;
    const messageUrl = `${baseUrl}/t/${message.shortLinkSlug}`;
    return NextResponse.json({ message, messageUrl }, { status: 201 });
  } catch (error) {
    const details = error instanceof Error ? error.message : "Unable to create message.";
    return NextResponse.json({ error: details }, { status: 400 });
  }
}
