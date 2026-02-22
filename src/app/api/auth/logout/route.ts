import { NextResponse } from "next/server";
import { SENDER_SESSION_COOKIE } from "@/lib/senderAuth";

export async function POST(request: Request): Promise<NextResponse> {
  const response = NextResponse.redirect(new URL("/", request.url));
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
