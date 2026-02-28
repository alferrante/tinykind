import { createHash } from "node:crypto";
import { NextRequest } from "next/server";

interface Bucket {
  hits: number[];
}

const buckets = new Map<string, Bucket>();

function nowMs(): number {
  return Date.now();
}

function getClientKey(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "";
  const userAgent = request.headers.get("user-agent") ?? "";
  const base = `${forwarded}|${userAgent}`;
  return createHash("sha256").update(base).digest("hex").slice(0, 24);
}

export function enforceRateLimit(
  request: NextRequest,
  options: { scope: string; maxHits: number; windowMs: number; keySuffix?: string | null },
): { ok: true } | { ok: false; retryAfterSeconds: number } {
  const suffix = options.keySuffix ? `:${createHash("sha256").update(options.keySuffix).digest("hex").slice(0, 16)}` : "";
  const key = `${options.scope}:${getClientKey(request)}${suffix}`;
  const timestamp = nowMs();
  const windowStart = timestamp - options.windowMs;
  const existing = buckets.get(key) ?? { hits: [] };
  existing.hits = existing.hits.filter((hit) => hit >= windowStart);

  if (existing.hits.length >= options.maxHits) {
    const oldest = existing.hits[0];
    const retryAfterSeconds = Math.max(1, Math.ceil((oldest + options.windowMs - timestamp) / 1000));
    buckets.set(key, existing);
    return { ok: false, retryAfterSeconds };
  }

  existing.hits.push(timestamp);
  buckets.set(key, existing);
  return { ok: true };
}
