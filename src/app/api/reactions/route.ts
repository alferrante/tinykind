import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { enforceRateLimit } from "@/lib/rateLimit";
import { sendReactionNotification } from "@/lib/reactionNotification";
import { addOperationalEvent, makeRecipientFingerprint, markReactionNotificationSent, upsertReaction } from "@/lib/store";

interface ReactionRequest {
  slug?: string;
  emoji?: string;
}

interface ReactionNotificationStatus {
  attempted: boolean;
  sent: boolean;
  reason?: string;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const limiter = await enforceRateLimit(request, {
      scope: "reactions",
      maxHits: 60,
      windowMs: 60_000,
    });
    if (!limiter.ok) {
      return NextResponse.json(
        { error: "Too many reactions. Please try again shortly." },
        {
          status: 429,
          headers: { "Retry-After": String(limiter.retryAfterSeconds) },
        },
      );
    }

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
    const hasSenderEmail = Boolean(message.senderNotifyEmail);
    let notification: ReactionNotificationStatus = {
      attempted: false,
      sent: false,
      reason: hasSenderEmail ? "not-required" : "sender-notification-email-missing",
    };

    const shouldAttemptNotification = hasSenderEmail && (changed || !reaction.notifiedAt);
    if (shouldAttemptNotification && message.senderNotifyEmail) {
      const retryUnchanged = !changed && !reaction.notifiedAt;
      notification.attempted = true;
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? request.nextUrl.origin;
      const messageUrl = `${baseUrl}/t/${message.shortLinkSlug}`;
      try {
        const result = await sendReactionNotification({
          toEmail: message.senderNotifyEmail,
          senderName: message.senderName,
          recipientName: message.recipientName,
          emoji: reaction.emoji,
          messageUrl,
        });
        notification = {
          attempted: true,
          sent: result.sent,
          reason: result.reason,
        };
        if (!result.sent) {
          await addOperationalEvent("reaction_notify_failed", {
            messageId: message.id,
            senderEmail: message.senderNotifyEmail,
            metadata: {
              slug,
              changed,
              retryUnchanged,
              attempts: result.attempts,
              durationMs: result.durationMs,
              providerMessageId: result.providerMessageId ?? null,
              reason: result.reason ?? "unknown",
            },
          });
          console.warn("[tinykind] reaction notification not sent", {
            slug,
            toEmail: message.senderNotifyEmail,
            changed,
            retryUnchanged,
            attempts: result.attempts,
            durationMs: result.durationMs,
            providerMessageId: result.providerMessageId ?? null,
            reason: result.reason ?? "unknown",
          });
        } else {
          await markReactionNotificationSent(reaction.id);
          await addOperationalEvent("reaction_notify_sent", {
            messageId: message.id,
            senderEmail: message.senderNotifyEmail,
            metadata: {
              slug,
              emoji: reaction.emoji,
              changed,
              retryUnchanged,
              attempts: result.attempts,
              durationMs: result.durationMs,
              providerMessageId: result.providerMessageId ?? null,
            },
          });
        }
      } catch (notifyError) {
        notification = {
          attempted: true,
          sent: false,
          reason: notifyError instanceof Error ? notifyError.message : "unknown-error",
        };
        await addOperationalEvent("reaction_notify_failed", {
          messageId: message.id,
          senderEmail: message.senderNotifyEmail,
          metadata: {
            slug,
            changed,
            retryUnchanged,
            reason: notification.reason ?? "unknown-error",
          },
        });
        console.error("Failed to send TinyKind reaction email", notifyError);
      }
    } else if (hasSenderEmail) {
      notification.reason = "already-notified";
    }

    const response = NextResponse.json({ reaction, notification }, { status: 201 });
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
