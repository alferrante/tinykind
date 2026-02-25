import { NextRequest, NextResponse } from "next/server";
import { addOperationalEvent, ensureSenderProfile } from "@/lib/store";
import {
  createSessionToken,
  getGoogleClientId,
  getGoogleClientSecret,
  getGoogleRedirectUri,
  isGoogleAuthConfigured,
  SENDER_SESSION_COOKIE,
} from "@/lib/senderAuth";

const GOOGLE_STATE_COOKIE = "tinykind_google_state";

interface GoogleTokenResponse {
  access_token?: string;
}

interface GoogleUserInfoResponse {
  email?: string;
  email_verified?: boolean;
}

async function exchangeCodeForAccessToken(params: {
  code: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}): Promise<string> {
  const body = new URLSearchParams({
    code: params.code,
    client_id: params.clientId,
    client_secret: params.clientSecret,
    redirect_uri: params.redirectUri,
    grant_type: "authorization_code",
  });
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  if (!response.ok) {
    throw new Error("Google token exchange failed.");
  }
  const payload = (await response.json()) as GoogleTokenResponse;
  if (!payload.access_token) {
    throw new Error("Google access token missing.");
  }
  return payload.access_token;
}

async function fetchGoogleEmail(accessToken: string): Promise<string> {
  const response = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    method: "GET",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) {
    throw new Error("Google userinfo request failed.");
  }
  const payload = (await response.json()) as GoogleUserInfoResponse;
  const email = payload.email?.trim().toLowerCase();
  if (!email || !payload.email_verified) {
    throw new Error("Google account email is unavailable or unverified.");
  }
  return email;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!isGoogleAuthConfigured()) {
    return NextResponse.redirect(new URL("/login?error=google_unavailable", request.url));
  }

  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const storedState = request.cookies.get(GOOGLE_STATE_COOKIE)?.value;
  if (!code || !state || !storedState || state !== storedState) {
    return NextResponse.redirect(new URL("/login?error=google_state_invalid", request.url));
  }

  try {
    const clientId = getGoogleClientId();
    const clientSecret = getGoogleClientSecret();
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? request.nextUrl.origin;
    const redirectUri = getGoogleRedirectUri(baseUrl);

    const accessToken = await exchangeCodeForAccessToken({
      code,
      clientId,
      clientSecret,
      redirectUri,
    });
    const email = await fetchGoogleEmail(accessToken);

    await ensureSenderProfile(email);
    await addOperationalEvent("auth_login_succeeded", {
      senderEmail: email,
      metadata: { source: "google" },
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
    response.cookies.set({
      name: GOOGLE_STATE_COOKIE,
      value: "",
      path: "/",
      maxAge: 0,
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown";
    console.error("[tinykind] google auth failed", message);
    return NextResponse.redirect(new URL("/login?error=google_failed", request.url));
  }
}
