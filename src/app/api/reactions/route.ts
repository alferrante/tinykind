import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { sendReactionNotification } from "@/lib/reactionNotification";
import { makeRecipientFingerprint, upsertReaction } from "@/lib/store";

interface ReactionRequest {
  slug?: string;
  emoji?: string;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const payload = (await request.json()) as ReactionRequest;
    const slug = payload.slug?.trim();
    const emoji = payload.emoji?.trim();
    if (!slug || !emoji) {
      return NextResponse.json({ error: "slug and emoji are required." }, { status: 400 });
    }

    const existingCookie = request.cookies.get("tk_fp")?.value ?? null;
    const stableSeed = existingCookie ?? randomUUID();
    const recipientFingerprint = makeRecipientFingerprint(stableSeed);
    const { reaction, message, changed } = await upsertReaction({ slug, emoji, recipientFingerprint });
    if (changed && message.senderNotifyEmail) {
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? request.nextUrl.origin;
      const messageUrl = `${baseUrl}/t/${message.shortLinkSlug}`;
      try {
        await sendReactionNotification({
          toEmail: message.senderNotifyEmail,
          senderName: message.senderName,
          recipientName: message.recipientName,
          emoji: reaction.emoji,
          messageUrl,
        });
      } catch (notifyError) {
        console.error("Failed to send TinyKind reaction email", notifyError);
      }
    }

    const response = NextResponse.json({ reaction }, { status: 201 });
    if (!existingCookie) {
      response.cookies.set({
        name: "tk_fp",
        value: stableSeed,
        path: "/",
        sameSite: "lax",
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        maxAge: 60 * 60 * 24 * 365,
      });
    }
    return response;
  } catch (error) {
    const details = error instanceof Error ? error.message : "Unable to save reaction.";
    return NextResponse.json({ error: details }, { status: 400 });
  }
}
