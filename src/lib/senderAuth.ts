import { createHmac, timingSafeEqual, randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { NextRequest } from "next/server";

export const SENDER_SESSION_COOKIE = "tinykind_sender_session";
const AUTH_VERSION = "v2";
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
  if (!raw.startsWith("/") || raw.startsWith("//") || /[\\\u0000-\u0020\u007f]/.test(raw) || raw.length > 300) return fallback;
  const parsed = new URL(raw, "https://tinykind.invalid");
  if (parsed.origin !== "https://tinykind.invalid" || parsed.pathname.startsWith("//") || parsed.pathname === "/api" || parsed.pathname.startsWith("/api/")) return fallback;
  return `${parsed.pathname}${parsed.search}${parsed.hash}`;
}

function createToken(email: string, purpose: "magic" | "session", ttl: number): string {
  const normalized = normalizeEmail(email);
  if (!validEmail(normalized)) throw new Error("A valid email is required.");
  const expiresAt = Math.floor(Date.now() / 1000) + ttl;
  const payload = `${AUTH_VERSION}|${purpose}|${normalized}|${expiresAt}|${randomUUID()}`;
  return Buffer.from(`${payload}|${sign(payload)}`).toString("base64url");
}

function verifyToken(token: string, purpose: "magic" | "session"): { email: string; expiresAt: number } {
  if (token.length > 2048) throw new Error("Invalid token.");
  const parts = Buffer.from(token, "base64url").toString("utf8").split("|");
  if (parts.length !== 6) throw new Error("Invalid token.");
  const [version, tokenPurpose, emailRaw, expiresRaw, nonce, signature] = parts;
  const payload = parts.slice(0, 5).join("|");
  if (version !== AUTH_VERSION || tokenPurpose !== purpose || !nonce || !safeEqual(signature, sign(payload))) throw new Error("Invalid token.");
  const email = normalizeEmail(emailRaw);
  const expiresAt = Number(expiresRaw);
  if (!validEmail(email) || !Number.isSafeInteger(expiresAt) || expiresAt <= Math.floor(Date.now() / 1000)) throw new Error("Token expired or invalid.");
  return { email, expiresAt };
}

export function createMagicLinkToken(email: string): string {
  return createToken(email, "magic", MAGIC_LINK_TTL_SECONDS);
}

export function verifyMagicLinkToken(token: string): { email: string; expiresAt: number } {
  return verifyToken(token, "magic");
}

export function createSessionToken(email: string): string {
  return createToken(email, "session", SESSION_TTL_SECONDS);
}

export function verifySessionToken(token: string): { email: string } | null {
  try { return verifyToken(token, "session"); } catch { return null; }
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
