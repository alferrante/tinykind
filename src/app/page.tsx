import Image from "next/image";
import Link from "next/link";
import CreateTinyKindCard from "@/components/CreateTinyKindCard";
import { getAuthenticatedSenderEmail, isGoogleAuthConfigured } from "@/lib/senderAuth";
import { countSentBySenderEmail, getSenderProfile } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const senderEmail = await getAuthenticatedSenderEmail();
  const googleEnabled = isGoogleAuthConfigured();
  const [sentCount, senderProfile] = senderEmail
    ? await Promise.all([countSentBySenderEmail(senderEmail), getSenderProfile(senderEmail)])
    : [null, null];
  const senderDefaultName = senderProfile?.displayName?.trim() || (senderEmail ? senderEmail.split("@")[0] ?? "" : "");

  return (
    <main className="shell min-h-screen py-8 md:py-12">
      <header className="mb-5 md:mb-8">
        <div className="mb-4 flex items-center justify-between gap-4">
          <Image
            alt="tinykind"
            className="h-auto w-[170px] md:w-[210px]"
            height={48}
            priority
            src="/branding-tinykind-light.png"
            width={220}
          />
          {senderEmail ? (
            <div className="flex items-center gap-2">
              <span className="rounded-full border border-[#ffffff45] bg-[#0f1d3199] px-3 py-1 text-xs text-[#dce7ff]">
                You&apos;re signed in as {senderEmail}
              </span>
              <Link className="btn" href="/dashboard">
                Dashboard
              </Link>
            </div>
          ) : (
            <Link className="btn" href="/login?next=%2F">
              Sign in
            </Link>
          )}
        </div>
        <h1 className="text-4xl leading-[1.05] text-[#fff5df] md:text-5xl">
          Make someone feel seen.
        </h1>
        {senderEmail && sentCount !== null ? (
          <div className="mt-3">
            <Link className="rounded-full border border-[#ffffff45] bg-[#0f1d3199] px-3 py-1 text-sm text-[#dce7ff]" href="/dashboard">
              {sentCount} TinyKinds sent
            </Link>
          </div>
        ) : null}
      </header>

      <div className="max-w-[860px]">
        <CreateTinyKindCard googleEnabled={googleEnabled} senderDefaultName={senderDefaultName} senderEmail={senderEmail} />
      </div>
    </main>
  );
}
