import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { NextRequest } from "next/server";

export const SENDER_SESSION_COOKIE = "tinykind_sender_session";
const AUTH_VERSION = "v1";
const MAGIC_LINK_TTL_SECONDS = 20 * 60;
const SESSION_TTL_SECONDS = 90 * 24 * 60 * 60;

function safeEqual(a: string, b: string): boolean {
  const aBuffer = Buffer.from(a);
  const bBuffer = Buffer.from(b);
  if (aBuffer.length !== bBuffer.length) {
    return false;
  }
  return timingSafeEqual(aBuffer, bBuffer);
}

function getAuthSecret(): string {
  const secret = process.env.TINYKIND_AUTH_SECRET?.trim();
  if (secret) {
    return secret;
  }
  const fallback = process.env.ADMIN_PASSWORD?.trim();
  if (fallback) {
    return fallback;
  }
  throw new Error("TINYKIND_AUTH_SECRET is required.");
}

function sign(payload: string): string {
  return createHmac("sha256", getAuthSecret()).update(payload).digest("base64url");
}

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function validEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function sanitizePostAuthPath(value: string | null | undefined, fallback = "/dashboard"): string {
  const raw = (value ?? "").trim();
  if (!raw) {
    return fallback;
  }
  if (!raw.startsWith("/") || raw.startsWith("//")) {
    return fallback;
  }
  if (raw.startsWith("/api/")) {
    return fallback;
  }
  if (raw.length > 300) {
    return fallback;
  }
  return raw;
}

export function createMagicLinkToken(email: string): string {
  const normalized = normalizeEmail(email);
  if (!validEmail(normalized)) {
    throw new Error("A valid email is required.");
  }
  const issuedAt = Math.floor(Date.now() / 1000);
  const expiresAt = issuedAt + MAGIC_LINK_TTL_SECONDS;
  const payload = `${AUTH_VERSION}|${normalized}|${expiresAt}`;
  const signature = sign(payload);
  return Buffer.from(`${payload}|${signature}`).toString("base64url");
}

export function verifyMagicLinkToken(token: string): { email: string } {
  const decoded = Buffer.from(token, "base64url").toString("utf8");
  const parts = decoded.split("|");
  if (parts.length !== 4) {
    throw new Error("Invalid token.");
  }
  const [version, emailRaw, expiresRaw, signature] = parts;
  const payload = `${version}|${emailRaw}|${expiresRaw}`;
  if (!safeEqual(signature, sign(payload))) {
    throw new Error("Invalid token signature.");
  }
  if (version !== AUTH_VERSION) {
    throw new Error("Invalid token version.");
  }
  const email = normalizeEmail(emailRaw);
  if (!validEmail(email)) {
    throw new Error("Invalid token email.");
  }
  const expiresAt = Number(expiresRaw);
  if (!Number.isFinite(expiresAt) || expiresAt < Math.floor(Date.now() / 1000)) {
    throw new Error("Token expired.");
  }
  return { email };
}

export function createSessionToken(email: string): string {
  const normalized = normalizeEmail(email);
  const issuedAt = Math.floor(Date.now() / 1000);
  const expiresAt = issuedAt + SESSION_TTL_SECONDS;
  const payload = `${AUTH_VERSION}|${normalized}|${expiresAt}`;
  const signature = sign(payload);
  return Buffer.from(`${payload}|${signature}`).toString("base64url");
}

export function verifySessionToken(token: string): { email: string } | null {
  try {
    const decoded = Buffer.from(token, "base64url").toString("utf8");
    const parts = decoded.split("|");
    if (parts.length !== 4) {
      return null;
    }
    const [version, emailRaw, expiresRaw, signature] = parts;
    const payload = `${version}|${emailRaw}|${expiresRaw}`;
    if (!safeEqual(signature, sign(payload))) {
      return null;
    }
    if (version !== AUTH_VERSION) {
      return null;
    }
    const email = normalizeEmail(emailRaw);
    if (!validEmail(email)) {
      return null;
    }
    const expiresAt = Number(expiresRaw);
    if (!Number.isFinite(expiresAt) || expiresAt < Math.floor(Date.now() / 1000)) {
      return null;
    }
    return { email };
  } catch {
    return null;
  }
}

export async function getAuthenticatedSenderEmail(): Promise<string | null> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(SENDER_SESSION_COOKIE)?.value;
  if (!raw) {
    return null;
  }
  return verifySessionToken(raw)?.email ?? null;
}

export function getAuthenticatedSenderEmailFromRequest(request: NextRequest): string | null {
  const raw = request.cookies.get(SENDER_SESSION_COOKIE)?.value;
  if (!raw) {
    return null;
  }
  return verifySessionToken(raw)?.email ?? null;
}

export function isGoogleAuthConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID?.trim() && process.env.GOOGLE_CLIENT_SECRET?.trim());
}

export function getGoogleClientId(): string {
  return process.env.GOOGLE_CLIENT_ID?.trim() ?? "";
}

export function getGoogleClientSecret(): string {
  return process.env.GOOGLE_CLIENT_SECRET?.trim() ?? "";
}

export function getGoogleRedirectUri(baseUrl: string): string {
  // Support the new key name first, keep legacy fallback for backward compatibility.
  const configured = process.env.GOOGLE_REDIRECT_URL?.trim() || process.env.GOOGLE_REDIRECT_URI?.trim();
  if (configured) {
    return configured;
  }
  return `${baseUrl.replace(/\/$/, "")}/api/auth/google/callback`;
}
