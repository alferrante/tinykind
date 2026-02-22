import { NextRequest, NextResponse } from "next/server";
import { addOperationalEvent, ensureSenderProfile } from "@/lib/store";
import { createSessionToken, SENDER_SESSION_COOKIE, verifyMagicLinkToken } from "@/lib/senderAuth";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const token = request.nextUrl.searchParams.get("token");
  if (!token) {
    return NextResponse.redirect(new URL("/login?error=missing_token", request.url));
  }

  try {
    const { email } = verifyMagicLinkToken(token);
    await ensureSenderProfile(email);
    await addOperationalEvent("auth_login_succeeded", {
      senderEmail: email,
      metadata: { source: "magic_link" },
    });

    const sessionToken = createSessionToken(email);
    const response = NextResponse.redirect(new URL("/dashboard", request.url));
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
    return NextResponse.redirect(new URL("/login?error=invalid_or_expired", request.url));
  }
}

