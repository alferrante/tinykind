import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { sendOpenNotification } from "@/lib/openNotification";
import { enforceRateLimit } from "@/lib/rateLimit";
import { addOperationalEvent, makeRecipientFingerprint, markOpenNotificationSent, recordOpen } from "@/lib/store";

interface OpenRequest {
  slug?: string;
}

interface OpenNotificationStatus {
  attempted: boolean;
  sent: boolean;
  reason?: string;
}

function openNotifyEnabled(): boolean {
  return process.env.OPEN_NOTIFY_ENABLED === "1";
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const limiter = await enforceRateLimit(request, {
      scope: "opens",
      maxHits: 120,
      windowMs: 60_000,
    });
    if (!limiter.ok) {
      return NextResponse.json(
        { error: "Too many open events. Please try again shortly." },
        {
          status: 429,
          headers: { "Retry-After": String(limiter.retryAfterSeconds) },
        },
      );
    }

    const payload = (await request.json()) as OpenRequest;
    const slug = payload.slug?.trim();
    if (!slug) {
      return NextResponse.json({ error: "slug is required." }, { status: 400 });
    }

    const existingCookie = request.cookies.get("tk_fp")?.value ?? null;
    const stableSeed = existingCookie ?? randomUUID();
    const recipientFingerprint = makeRecipientFingerprint(stableSeed);
    const { open, message, shouldNotify } = await recordOpen({ slug, recipientFingerprint });

    let notification: OpenNotificationStatus = {
      attempted: false,
      sent: false,
    };

    if (openNotifyEnabled() && shouldNotify && message.senderNotifyEmail) {
      notification.attempted = true;
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? request.nextUrl.origin;
      const messageUrl = `${baseUrl}/t/${message.shortLinkSlug}?open=1`;
      const result = await sendOpenNotification({
        toEmail: message.senderNotifyEmail,
        senderName: message.senderName,
        recipientName: message.recipientName,
        messageUrl,
      });

      notification = {
        attempted: true,
        sent: result.sent,
        reason: result.reason,
      };

      if (result.sent) {
        await markOpenNotificationSent(open.id);
        await addOperationalEvent("open_notify_sent", {
          messageId: message.id,
          senderEmail: message.senderNotifyEmail,
          metadata: {
            slug,
            attempts: result.attempts,
            durationMs: result.durationMs,
            providerMessageId: result.providerMessageId ?? null,
          },
        });
      } else {
        await addOperationalEvent("open_notify_failed", {
          messageId: message.id,
          senderEmail: message.senderNotifyEmail,
          metadata: {
            slug,
            attempts: result.attempts,
            durationMs: result.durationMs,
            providerMessageId: result.providerMessageId ?? null,
            reason: result.reason ?? "unknown",
          },
        });
      }
    }

    const response = NextResponse.json(
      {
        recorded: true,
        notification,
      },
      { status: 201 },
    );
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
    const details = error instanceof Error ? error.message : "Unable to record message open.";
    return NextResponse.json({ error: details }, { status: 400 });
  }
}
