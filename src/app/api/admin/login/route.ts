import { NextRequest, NextResponse } from "next/server";
import {
  ADMIN_SESSION_COOKIE,
  getAdminSessionCookieValue,
  verifyAdminPassword,
} from "@/lib/adminAuth";

function safeNextPath(input: string | null): string {
  if (!input || !input.startsWith("/")) {
    return "/admin";
  }
  if (input.startsWith("//")) {
    return "/admin";
  }
  return input;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const contentType = request.headers.get("content-type") ?? "";
  let password = "";
  let nextPath: string | null = "/admin";

  if (contentType.includes("application/json")) {
    const payload = (await request.json()) as { password?: string; next?: string };
    password = payload.password?.trim() ?? "";
    nextPath = payload.next ?? "/admin";
  } else {
    const form = await request.formData();
    password = String(form.get("password") ?? "").trim();
    nextPath = String(form.get("next") ?? "/admin");
  }

  const sessionValue = getAdminSessionCookieValue();
  if (!sessionValue) {
    return NextResponse.json(
      { error: "ADMIN_PASSWORD is not configured on the server." },
      { status: 500 },
    );
  }

  const destinationPath = safeNextPath(nextPath);
  if (!verifyAdminPassword(password)) {
    const failed = new NextResponse(null, { status: 303 });
    failed.headers.set("Location", "/admin/login?error=1");
    return failed;
  }

  const response = new NextResponse(null, { status: 303 });
  response.headers.set("Location", destinationPath);
  response.cookies.set({
    name: ADMIN_SESSION_COOKIE,
    value: sessionValue,
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 30,
  });
  return response;
}
