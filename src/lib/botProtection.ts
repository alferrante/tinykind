export function botProtectionConfig(): { enabled: boolean; siteKey: string } {
  return {
    enabled: process.env.TURNSTILE_ENABLED === "1" || Boolean(process.env.TURNSTILE_SITE_KEY || process.env.TURNSTILE_SECRET_KEY),
    siteKey: process.env.TURNSTILE_SITE_KEY?.trim() ?? "",
  };
}

export async function verifyLoginChallenge(token: unknown): Promise<boolean> {
  const config = botProtectionConfig();
  if (!config.enabled) return true;
  const secret = process.env.TURNSTILE_SECRET_KEY?.trim();
  if (!secret || !config.siteKey || typeof token !== "string" || !token || token.length > 2048) return false;
  try {
    const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ secret, response: token }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) return false;
    const result = await response.json() as { success?: boolean; hostname?: string; action?: string };
    const hostname = new URL(process.env.NEXT_PUBLIC_BASE_URL ?? "https://tinykind.app").hostname;
    return result.success === true && result.hostname === hostname && result.action === "auth-login";
  } catch { return false; }
}
