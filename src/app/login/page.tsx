import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getAuthenticatedSenderEmail, isGoogleAuthConfigured } from "@/lib/senderAuth";
import LoginCard from "@/components/LoginCard";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "TinyKind Sign In",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string; email?: string }>;
}) {
  const senderEmail = await getAuthenticatedSenderEmail();
  if (senderEmail) {
    redirect("/dashboard");
  }

  const params = searchParams ? await searchParams : undefined;
  const error = params?.error;
  const email = params?.email ?? "";
  const googleEnabled = isGoogleAuthConfigured();

  return (
    <main className="shell min-h-screen py-8 md:py-12">
      <header className="mb-5 md:mb-8">
        <h1 className="mt-2 text-4xl leading-[1.05] text-[#fff5df] md:text-5xl">TinyKind login</h1>
      </header>

      <div className="max-w-[560px]">
        <LoginCard googleEnabled={googleEnabled} initialEmail={email} />
        {error ? (
          <div className="mt-3 rounded-lg border border-[#a22d2d55] bg-[#fff5f5] px-4 py-3 text-sm text-[#a22d2d]">
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
    </main>
  );
}
