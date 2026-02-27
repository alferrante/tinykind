import Image from "next/image";
import Link from "next/link";
import AccountMenu from "@/components/AccountMenu";
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
      <header className="mb-6 md:mb-8">
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
            <AccountMenu
              displayName={senderProfile?.displayName}
              senderEmail={senderEmail}
              sentCount={sentCount ?? undefined}
              showDashboardLink
            />
          ) : (
            <Link className="btn" href="/login?next=%2F">
              Sign in
            </Link>
          )}
        </div>
        <h1 className="text-4xl leading-[1.05] text-[#fff5df] md:text-5xl">
          Make someone feel seen.
        </h1>
      </header>

      <div className="max-w-[860px]">
        <CreateTinyKindCard googleEnabled={googleEnabled} senderDefaultName={senderDefaultName} senderEmail={senderEmail} />
      </div>
    </main>
  );
}
