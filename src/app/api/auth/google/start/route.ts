import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { buildAppUrl, getAppBaseUrl } from "@/lib/baseUrl";
import { getGoogleClientId, getGoogleRedirectUri, isGoogleAuthConfigured } from "@/lib/senderAuth";

const GOOGLE_STATE_COOKIE = "tinykind_google_state";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const baseUrl = getAppBaseUrl(request.nextUrl.origin);
  if (!isGoogleAuthConfigured()) {
    return NextResponse.redirect(buildAppUrl("/login?error=google_unavailable", baseUrl));
  }

  const clientId = getGoogleClientId();
  const redirectUri = getGoogleRedirectUri(baseUrl);
  const state = randomBytes(18).toString("base64url");

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state,
    prompt: "select_account",
    access_type: "online",
  });
  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  const response = NextResponse.redirect(authUrl);
  response.cookies.set({
    name: GOOGLE_STATE_COOKIE,
    value: state,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 10 * 60,
  });
  return response;
}
