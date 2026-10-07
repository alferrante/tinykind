"use client";

import { useEffect, useRef, useState } from "react";
import Script from "next/script";

type Turnstile = {
  render: (container: HTMLElement, options: { sitekey: string; action: string; callback: (token: string) => void; "expired-callback": () => void; "error-callback": () => void }) => string;
  reset: (widget: string) => void;
  remove: (widget: string) => void;
};
function turnstile(): Turnstile | undefined {
  return (window as Window & { turnstile?: Turnstile }).turnstile;
}

interface LoginCardProps {
  initialEmail?: string;
  googleEnabled: boolean;
  nextPath: string;
  botProtection: { enabled: boolean; siteKey: string };
}

export default function LoginCard({ initialEmail = "", googleEnabled, nextPath, botProtection }: LoginCardProps) {
  const [email, setEmail] = useState(initialEmail);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [scriptReady, setScriptReady] = useState(false);
  const [challengeToken, setChallengeToken] = useState("");
  const container = useRef<HTMLDivElement>(null);
  const widget = useRef<string | null>(null);

  useEffect(() => {
    const api = turnstile();
    if (!botProtection.enabled || !botProtection.siteKey || !scriptReady || !container.current || !api) return;
    widget.current = api.render(container.current, {
      sitekey: botProtection.siteKey, action: "auth-login", callback: setChallengeToken,
      "expired-callback": () => setChallengeToken(""),
      "error-callback": () => { setChallengeToken(""); setError("Security check unavailable. Please try again."); },
    });
    return () => { if (widget.current) api.remove(widget.current); widget.current = null; };
  }, [botProtection.enabled, botProtection.siteKey, scriptReady]);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setSent(false);
    try {
      const response = await fetch("/api/auth/request-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, next: nextPath, challengeToken }),
      });
      const payload = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Could not send sign-in link.");
      }
      setSent(true);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Could not send sign-in link.");
    } finally {
      setLoading(false);
      setChallengeToken("");
      if (widget.current) turnstile()?.reset(widget.current);
    }
  }

  return (
    <section className="panel p-5 md:p-7">
      <h2 className="text-2xl leading-tight">Sign in to save your TinyKinds</h2>
      <p className="mt-2 text-sm text-[#6B6B6B]">Use Google or get a one-time sign-in link by email.</p>

      {googleEnabled ? (
        <div className="mt-4">
          <a
            className="btn btn-primary inline-block text-sm"
            href={`/api/auth/google/start?next=${encodeURIComponent(nextPath)}`}
          >
            Continue with Google
          </a>
        </div>
      ) : null}

      <form className="mt-4 grid gap-3" onSubmit={onSubmit}>
        <label className="grid gap-1 text-sm font-medium">
          Email
          <input
            className="field mono"
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@email.com"
            type="email"
            value={email}
          />
        </label>
        {botProtection.enabled ? (
          <>
            <Script id="tinykind-turnstile" src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" onReady={() => setScriptReady(true)} onError={() => setError("Security check unavailable. Please try again.")} />
            <div ref={container} aria-label="Security check" />
          </>
        ) : null}
        <div>
          <button className="btn" disabled={loading || (botProtection.enabled && !challengeToken)} type="submit">
            {loading ? "Sending..." : "Email me a sign-in link"}
          </button>
        </div>
      </form>

      {sent ? <p className="mt-3 text-sm text-[#6B6B6B]">Check your inbox for the sign-in link.</p> : null}
      {error ? <p className="mt-3 text-sm text-[#a22d2d]">{error}</p> : null}
    </section>
  );
}
