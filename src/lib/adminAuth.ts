import { createHash, timingSafeEqual } from "node:crypto";
import { NextRequest } from "next/server";

export const ADMIN_SESSION_COOKIE = "tinykind_admin_session";
const ADMIN_SESSION_VERSION = "v1";

interface CookieReader {
  get(name: string): { value: string } | undefined;
}

function hashSessionToken(password: string): string {
  return createHash("sha256")
    .update(`${ADMIN_SESSION_VERSION}:${password}`)
    .digest("base64url");
}

function safeStringEqual(a: string, b: string): boolean {
  const bufferA = Buffer.from(a);
  const bufferB = Buffer.from(b);
  if (bufferA.length !== bufferB.length) {
    return false;
  }
  return timingSafeEqual(bufferA, bufferB);
}

function hasValidAdminHeader(request: NextRequest): boolean {
  const expected = process.env.TINYKIND_ADMIN_TOKEN;
  if (!expected) {
    return false;
  }
  const provided = request.headers.get("x-tinykind-admin-token");
  return provided ? safeStringEqual(provided, expected) : false;
}

function hasValidAdminCookieValue(cookieValue: string | undefined): boolean {
  const password = process.env.ADMIN_PASSWORD;
  if (!password || !cookieValue) {
    return false;
  }
  const expected = hashSessionToken(password);
  return safeStringEqual(cookieValue, expected);
}

export function getAdminSessionCookieValue(): string | null {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) {
    return null;
  }
  return hashSessionToken(password);
}

export function verifyAdminPassword(input: string): boolean {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) {
    return false;
  }
  return safeStringEqual(input, password);
}

export function isAdminRequest(request: NextRequest): boolean {
  if (hasValidAdminHeader(request)) {
    return true;
  }
  return hasValidAdminCookieValue(request.cookies.get(ADMIN_SESSION_COOKIE)?.value);
}

export function isAdminFromCookies(cookies: CookieReader): boolean {
  return hasValidAdminCookieValue(cookies.get(ADMIN_SESSION_COOKIE)?.value);
}
