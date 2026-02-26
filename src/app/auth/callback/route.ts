import { NextRequest, NextResponse } from "next/server";
import { buildAppUrl, getAppBaseUrl } from "@/lib/baseUrl";
import { addOperationalEvent, ensureSenderProfile } from "@/lib/store";
import { createSessionToken, sanitizePostAuthPath, SENDER_SESSION_COOKIE, verifyMagicLinkToken } from "@/lib/senderAuth";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const baseUrl = getAppBaseUrl(request.nextUrl.origin);
  const nextPath = sanitizePostAuthPath(request.nextUrl.searchParams.get("next"), "/dashboard");
  const token = request.nextUrl.searchParams.get("token");
  if (!token) {
    return NextResponse.redirect(buildAppUrl(`/login?error=missing_token&next=${encodeURIComponent(nextPath)}`, baseUrl));
  }

  try {
    const { email } = verifyMagicLinkToken(token);
    await ensureSenderProfile(email);
    await addOperationalEvent("auth_login_succeeded", {
      senderEmail: email,
      metadata: { source: "magic_link" },
    });

    const sessionToken = createSessionToken(email);
    const response = NextResponse.redirect(buildAppUrl(nextPath, baseUrl));
    response.cookies.set({
      name: SENDER_SESSION_COOKIE,
      value: sessionToken,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 90 * 24 * 60 * 60,
    });
    return response;
  } catch {
    return NextResponse.redirect(buildAppUrl(`/login?error=invalid_or_expired&next=${encodeURIComponent(nextPath)}`, baseUrl));
  }
}
