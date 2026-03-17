import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import AccountMenu from "@/components/AccountMenu";
import CreateTinyKindCard from "@/components/CreateTinyKindCard";
import { getPromptSuggestionsForDate } from "@/lib/promptSuggestions";
import { getAuthenticatedSenderEmail, isGoogleAuthConfigured } from "@/lib/senderAuth";
import { countSentBySenderEmail, getSenderProfile, getSenderStreakSummary } from "@/lib/store";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Send a TinyKind 💛",
};

function formatGreetingName(value: string): string {
  const first = value.trim().split(/\s+/)[0] ?? "";
  if (!first) {
    return "Angela";
  }
  return first.charAt(0).toUpperCase() + first.slice(1);
}

export default async function HomePage() {
  const senderEmail = await getAuthenticatedSenderEmail();
  const googleEnabled = isGoogleAuthConfigured();
  const senderProfile = senderEmail ? await getSenderProfile(senderEmail) : null;
  const senderTimezone = senderProfile?.reminder.timezone ?? "America/Los_Angeles";
  const [sentCount, streakSummary] = senderEmail
    ? await Promise.all([countSentBySenderEmail(senderEmail), getSenderStreakSummary(senderEmail, senderTimezone)])
    : [null, null];
  const senderDefaultName = senderProfile?.displayName?.trim() || (senderEmail ? senderEmail.split("@")[0] ?? "" : "");
  const greetingName = formatGreetingName(senderDefaultName);
  const promptSuggestions = getPromptSuggestionsForDate(
    new Date(),
    senderTimezone,
  );

  return (
    <main className="min-h-screen bg-[#F7F6F4] text-[#2E2E2E]">
      <header className="shell flex flex-col gap-4 px-1 pt-6 sm:flex-row sm:items-center sm:justify-between sm:pt-8">
        <div className="flex items-center">
          <Image
            alt="tinykind"
            className="h-auto w-[136px] sm:w-[172px]"
            height={109}
            priority
            src="/branding-tinykind-dark.png"
            unoptimized
            width={427}
          />
        </div>

        {senderEmail ? (
          <AccountMenu
            displayName={senderProfile?.displayName}
            senderEmail={senderEmail}
            sentCount={sentCount ?? undefined}
            showDashboardLink
          />
        ) : (
          <Link className="btn self-end sm:self-auto" href="/login?next=%2F">
            Sign in
          </Link>
        )}
      </header>

      <section className="mx-auto w-full max-w-[860px] px-6 pb-20 pt-14 sm:pt-20">
        <CreateTinyKindCard
          googleEnabled={googleEnabled}
          greetingName={greetingName}
          promptSuggestions={promptSuggestions}
          senderDefaultName={senderDefaultName}
          senderEmail={senderEmail}
          senderSentCount={sentCount}
          streakSummary={streakSummary}
        />
      </section>
    </main>
  );
}
