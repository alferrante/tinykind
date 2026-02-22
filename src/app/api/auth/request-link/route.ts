import { NextRequest, NextResponse } from "next/server";
import { sendLoginLinkEmail } from "@/lib/authNotification";
import { ensureSenderProfile, addOperationalEvent } from "@/lib/store";
import { createMagicLinkToken } from "@/lib/senderAuth";
import { enforceRateLimit } from "@/lib/rateLimit";

interface RequestLinkPayload {
  email?: string;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const limiter = enforceRateLimit(request, {
      scope: "auth-request-link",
      maxHits: 10,
      windowMs: 60_000,
    });
    if (!limiter.ok) {
      return NextResponse.json(
        { error: "Too many login attempts. Please wait and try again." },
        { status: 429, headers: { "Retry-After": String(limiter.retryAfterSeconds) } },
      );
    }

    const payload = (await request.json()) as RequestLinkPayload;
    const email = payload.email?.trim().toLowerCase() ?? "";
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Valid email is required." }, { status: 400 });
    }

    await ensureSenderProfile(email);
    const token = createMagicLinkToken(email);
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? request.nextUrl.origin;
    const loginUrl = `${baseUrl}/auth/callback?token=${encodeURIComponent(token)}`;
    const result = await sendLoginLinkEmail({
      toEmail: email,
      loginUrl,
    });

    await addOperationalEvent("auth_link_requested", {
      senderEmail: email,
      metadata: {
        sent: result.sent,
        reason: result.reason ?? "",
      },
    });

    if (!result.sent) {
      return NextResponse.json({ error: `Unable to send link: ${result.reason ?? "unknown"}` }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    const details = error instanceof Error ? error.message : "Unable to request sign-in link.";
    return NextResponse.json({ error: details }, { status: 400 });
  }
}

