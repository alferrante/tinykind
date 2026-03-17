import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import AccountMenu from "@/components/AccountMenu";
import DashboardReminderForm from "@/components/DashboardReminderForm";
import { getAuthenticatedSenderEmail } from "@/lib/senderAuth";
import { getSenderProfile, getSenderStreakSummary, listMessagesBySenderEmail, listSenderActivityByEmail } from "@/lib/store";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "TinyKind Dashboard",
};

function formatTimestamp(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function activityLabel(item: Awaited<ReturnType<typeof listSenderActivityByEmail>>[number]): string {
  if (item.type === "opened") {
    return `${item.recipientName} opened your TinyKind`;
  }
  if (item.type === "reaction") {
    return `${item.recipientName} reacted ${item.emoji ?? ""}`.trim();
  }
  return `You sent a TinyKind to ${item.recipientName}`;
}

export default async function DashboardPage() {
  const senderEmail = await getAuthenticatedSenderEmail();
  if (!senderEmail) {
    redirect("/login?next=%2Fdashboard");
  }

  const profile = await getSenderProfile(senderEmail);
  const senderTimezone = profile?.reminder.timezone ?? "America/Los_Angeles";
  const [messages, streakSummary, activity] = await Promise.all([
    listMessagesBySenderEmail(senderEmail, 200),
    getSenderStreakSummary(senderEmail, senderTimezone),
    listSenderActivityByEmail(senderEmail, 10),
  ]);

  return (
    <main className="min-h-screen bg-[#F7F6F4] text-[#2E2E2E]">
      <section className="shell px-1 py-8 md:py-12">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-medium md:text-4xl">Your TinyKinds</h1>
            <p className="mt-2 text-sm text-[#6B6B6B]">Signed in as {profile?.displayName || senderEmail}</p>
          </div>
          <AccountMenu
            displayName={profile?.displayName}
            senderEmail={senderEmail}
            sentCount={messages.length}
            showDashboardLink={false}
            showNewTinyKindLink
          />
        </header>

        <div className="grid gap-4">
          <section className="panel p-5 md:p-7">
            <div className="flex flex-wrap items-center gap-3">
              <div className="rounded-full border border-[#E8E6E3] bg-[#FFFFFF] px-4 py-2 text-sm text-[#2E2E2E]">
                {streakSummary.sentThisWeek ? "You sent a TinyKind this week ✓" : "No TinyKind sent yet this week"}
              </div>
              {streakSummary.currentStreak > 0 ? (
                <div className="rounded-full border border-[#F2D9A6] bg-[#FFF8EA] px-4 py-2 text-sm font-medium text-[#8B5D1A]">
                  🔥 {streakSummary.currentStreak}-week kindness streak
                </div>
              ) : null}
            </div>
          </section>

          <DashboardReminderForm
            initial={{
              enabled: profile?.reminder.enabled ?? false,
              weekday: profile?.reminder.weekday ?? 0,
              hour: profile?.reminder.hour ?? 15,
              minute: profile?.reminder.minute ?? 0,
              timezone: profile?.reminder.timezone ?? "America/Los_Angeles",
            }}
          />

          <section className="panel p-5 md:p-7">
            <h2 className="text-2xl font-medium leading-tight">Recent activity</h2>
            <p className="mt-2 text-sm text-[#6B6B6B]">Open and reaction updates land here after your notification emails go out.</p>

            {activity.length === 0 ? (
              <p className="mt-4 text-sm text-[#6B6B6B]">No activity yet. Your next open or reaction will show up here.</p>
            ) : (
              <ul className="mt-4 grid gap-3">
                {activity.map((item) => (
                  <li key={item.id} className="rounded-xl border border-[#E8E6E3] bg-[#FFFFFF] p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                      <strong>{activityLabel(item)}</strong>
                      <span className="text-xs text-[#6B6B6B]">{formatTimestamp(item.createdAt)}</span>
                    </div>
                    {item.slug ? (
                      <div className="mt-3">
                        <Link className="mono text-xs text-[#6B6B6B] underline" href={`/t/${item.slug}`} target="_blank">
                          /t/{item.slug}
                        </Link>
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="panel p-5 md:p-7">
            <h2 className="text-2xl font-medium leading-tight">Sent history</h2>
            <p className="mt-2 text-sm text-[#6B6B6B]">
              {messages.length} TinyKind{messages.length === 1 ? "" : "s"} tied to your sender email.
            </p>

            {messages.length === 0 ? (
              <p className="mt-4 text-sm text-[#6B6B6B]">No TinyKinds found yet.</p>
            ) : (
              <ul className="mt-4 grid gap-3">
                {messages.map(({ message, latestReaction }) => (
                  <li key={message.id} className="rounded-xl border border-[#E8E6E3] bg-[#FFFFFF] p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                      <div>
                        <strong>{message.recipientName}</strong>
                      </div>
                      <div className="text-xs text-[#6B6B6B]">{formatTimestamp(message.createdAt)}</div>
                    </div>
                    <p className="mt-2 text-sm text-[#2E2E2E]">{message.body}</p>
                    <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-[#6B6B6B]">
                      <span>Reaction: {latestReaction ? latestReaction.emoji : "none"}</span>
                      <Link className="mono text-[#6B6B6B] underline" href={`/t/${message.shortLinkSlug}`} target="_blank">
                        /t/{message.shortLinkSlug}
                      </Link>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </section>
    </main>
  );
}
