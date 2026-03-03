import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getAuthenticatedSenderEmail, isGoogleAuthConfigured, sanitizePostAuthPath } from "@/lib/senderAuth";
import LoginCard from "@/components/LoginCard";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "TinyKind Sign In",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string; email?: string; next?: string }>;
}) {
  const params = searchParams ? await searchParams : undefined;
  const nextPath = sanitizePostAuthPath(params?.next, "/dashboard");
  const senderEmail = await getAuthenticatedSenderEmail();
  if (senderEmail) {
    redirect(nextPath);
  }

  const error = params?.error;
  const email = params?.email ?? "";
  const googleEnabled = isGoogleAuthConfigured();

  return (
    <main className="min-h-screen bg-[#F7F6F4] text-[#2E2E2E]">
      <section className="shell px-1 py-8 md:py-12">
        <header className="mb-5 md:mb-8">
          <h1 className="mt-2 text-4xl font-medium leading-[1.15] md:text-5xl">TinyKind login</h1>
        </header>

        <div className="max-w-[560px]">
          <LoginCard googleEnabled={googleEnabled} initialEmail={email} nextPath={nextPath} />
          {error ? (
            <div className="mt-3 rounded-lg border border-[#a22d2d44] bg-[#fff5f5] px-4 py-3 text-sm text-[#a22d2d]">
              {error === "google_unavailable"
                ? "Google sign-in is not configured yet. Use email sign-in for now."
                : error === "google_state_invalid"
                  ? "Google sign-in session expired. Try again."
                  : error === "google_failed"
                    ? "Google sign-in failed. Try again or use email sign-in."
                    : "Sign-in link is invalid or expired. Request a new one."}
            </div>
          ) : null}
        </div>
      </section>
    </main>
  );
}
