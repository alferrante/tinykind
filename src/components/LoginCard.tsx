"use client";

import { useState } from "react";

export default function LoginCard({ initialEmail = "" }: { initialEmail?: string }) {
  const [email, setEmail] = useState(initialEmail);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setSent(false);
    try {
      const response = await fetch("/api/auth/request-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
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
    }
  }

  return (
    <section className="panel p-5 md:p-7">
      <h2 className="text-2xl leading-tight">Sign in to save your TinyKinds</h2>
      <p className="mt-2 text-sm text-[var(--ink-soft)]">
        Optional login. We&apos;ll email you a one-time sign-in link.
      </p>

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
        <div>
          <button className="btn btn-primary" disabled={loading} type="submit">
            {loading ? "Sending..." : "Email me a sign-in link"}
          </button>
        </div>
      </form>

      {sent ? <p className="mt-3 text-sm text-[#174a8c]">Check your inbox for the sign-in link.</p> : null}
      {error ? <p className="mt-3 text-sm text-[#a22d2d]">{error}</p> : null}
    </section>
  );
}
