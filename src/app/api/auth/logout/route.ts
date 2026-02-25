import { NextResponse } from "next/server";
import { buildAppUrl, getAppBaseUrl } from "@/lib/baseUrl";
import { SENDER_SESSION_COOKIE } from "@/lib/senderAuth";

export async function POST(request: Request): Promise<NextResponse> {
  const requestOrigin = (() => {
    try {
      return new URL(request.url).origin;
    } catch {
      return undefined;
    }
  })();
  const response = NextResponse.redirect(buildAppUrl("/", getAppBaseUrl(requestOrigin)));
  response.cookies.set({
    name: SENDER_SESSION_COOKIE,
    value: "",
    path: "/",
    maxAge: 0,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
  return response;
}
