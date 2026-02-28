import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { enforceRateLimit } from "@/lib/rateLimit";
import { createAbuseReport, makeRecipientFingerprint } from "@/lib/store";

interface ReportRequest {
  slug?: string;
  reason?: string;
  details?: string;
  reporterEmail?: string;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const limiter = enforceRateLimit(request, {
      scope: "reports",
      maxHits: 20,
      windowMs: 60_000,
    });
    if (!limiter.ok) {
      return NextResponse.json(
        { error: "Too many report attempts. Please try again shortly." },
        {
          status: 429,
          headers: { "Retry-After": String(limiter.retryAfterSeconds) },
        },
      );
    }

    const payload = (await request.json()) as ReportRequest;
    const slug = payload.slug?.trim();
    const reason = payload.reason?.trim();
    if (!slug || !reason) {
      return NextResponse.json({ error: "slug and reason are required." }, { status: 400 });
    }

    const existingCookie = request.cookies.get("tk_fp")?.value ?? null;
    const stableSeed = existingCookie ?? randomUUID();
    const recipientFingerprint = makeRecipientFingerprint(stableSeed);
    const perMessageLimiter = enforceRateLimit(request, {
      scope: "reports-per-message",
      maxHits: 4,
      windowMs: 60 * 60_000,
      keySuffix: `${slug}:${recipientFingerprint}`,
    });
    if (!perMessageLimiter.ok) {
      return NextResponse.json(
        { error: "You have already submitted several reports for this TinyKind." },
        {
          status: 429,
          headers: { "Retry-After": String(perMessageLimiter.retryAfterSeconds) },
        },
      );
    }

    const { report } = await createAbuseReport({
      slug,
      reason,
      details: payload.details?.trim() || null,
      reporterFingerprint: recipientFingerprint,
      reporterEmail: payload.reporterEmail?.trim() || null,
    });

    const response = NextResponse.json({ reported: true, reportId: report.id }, { status: 201 });
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
    const details = error instanceof Error ? error.message : "Unable to submit report.";
    return NextResponse.json({ error: details }, { status: 400 });
  }
}
