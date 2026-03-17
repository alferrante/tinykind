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

export default async function HomePage() {
  const senderEmail = await getAuthenticatedSenderEmail();
  const googleEnabled = isGoogleAuthConfigured();
  const senderProfile = senderEmail ? await getSenderProfile(senderEmail) : null;
  const senderTimezone = senderProfile?.reminder.timezone ?? "America/Los_Angeles";
  const [sentCount, streakSummary] = senderEmail
    ? await Promise.all([countSentBySenderEmail(senderEmail), getSenderStreakSummary(senderEmail, senderTimezone)])
    : [null, null];
  const senderDefaultName = senderProfile?.displayName?.trim() || (senderEmail ? senderEmail.split("@")[0] ?? "" : "");
  const greetingName = senderDefaultName ? senderDefaultName.split(/\s+/)[0] : "Angela";
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

      <section className="mx-auto w-full max-w-[720px] px-6 pb-20 pt-16 sm:pt-24">
        <div className="text-center">
          <h1 className="text-[36px] font-medium leading-[1.2] tracking-[-0.02em] sm:text-[44px]">Hi {greetingName},</h1>
          <p className="mt-4 text-[22px] font-normal leading-[1.3] text-[#2E2E2E] sm:text-[24px]">
            Who would you like to appreciate today?
          </p>
          {streakSummary ? (
            <div className="mt-6 flex flex-wrap items-center justify-center gap-2 text-sm">
              <span className="rounded-full border border-[#E8E6E3] bg-[#FFFFFF] px-4 py-2 text-[#2E2E2E]">
                {streakSummary.sentThisWeek ? "You sent a TinyKind this week ✓" : "No TinyKind sent yet this week"}
              </span>
              {streakSummary.currentStreak > 0 ? (
                <span className="rounded-full border border-[#F2D9A6] bg-[#FFF8EA] px-4 py-2 font-medium text-[#8B5D1A]">
                  🔥 {streakSummary.currentStreak}-week streak
                </span>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="mt-10 sm:mt-12">
          <CreateTinyKindCard
            googleEnabled={googleEnabled}
            promptSuggestions={promptSuggestions}
            senderDefaultName={senderDefaultName}
            senderEmail={senderEmail}
          />
        </div>
      </section>
    </main>
  );
}
