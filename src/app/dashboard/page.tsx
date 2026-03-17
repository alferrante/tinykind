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

function formatRelativeTimestamp(iso: string): string {
  try {
    const value = new Date(iso);
    const diffMs = value.getTime() - Date.now();
    const diffSeconds = Math.round(diffMs / 1000);
    const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
    const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [
      ["year", 60 * 60 * 24 * 365],
      ["month", 60 * 60 * 24 * 30],
      ["week", 60 * 60 * 24 * 7],
      ["day", 60 * 60 * 24],
      ["hour", 60 * 60],
      ["minute", 60],
    ];

    for (const [unit, seconds] of units) {
      if (Math.abs(diffSeconds) >= seconds || unit === "minute") {
        return rtf.format(Math.round(diffSeconds / seconds), unit);
      }
    }
    return "just now";
  } catch {
    return iso;
  }
}

type SenderActivityItem = Awaited<ReturnType<typeof listSenderActivityByEmail>>[number];

interface ActivityGroup {
  key: string;
  messageId: string | null;
  slug: string | null;
  recipientName: string;
  sentAt: string | null;
  latestAt: string;
  items: SenderActivityItem[];
}

function groupActivity(items: SenderActivityItem[]): ActivityGroup[] {
  const groups = new Map<string, ActivityGroup>();

  for (const item of items) {
    const key = item.messageId ?? item.slug ?? item.id;
    const existing = groups.get(key);
    if (existing) {
      existing.items.push(item);
      if (!existing.sentAt && item.type === "sent") {
        existing.sentAt = item.createdAt;
      }
      if (item.createdAt > existing.latestAt) {
        existing.latestAt = item.createdAt;
      }
      continue;
    }

    groups.set(key, {
      key,
      messageId: item.messageId,
      slug: item.slug,
      recipientName: item.recipientName,
      sentAt: item.type === "sent" ? item.createdAt : null,
      latestAt: item.createdAt,
      items: [item],
    });
  }

  return [...groups.values()]
    .map((group) => ({
      ...group,
      items: group.items.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)),
    }))
    .sort((a, b) => (a.latestAt < b.latestAt ? 1 : -1));
}

function groupedActivityLabel(item: SenderActivityItem): string {
  if (item.type === "opened") {
    return "Opened your TinyKind";
  }
  if (item.type === "reaction") {
    return `Reacted ${item.emoji ?? ""}`.trim();
  }
  return "TinyKind sent";
}

function groupTitle(group: ActivityGroup): string {
  return `You sent a TinyKind to ${group.recipientName}`;
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
    listSenderActivityByEmail(senderEmail, 40),
  ]);
  const activityGroups = groupActivity(activity).slice(0, 10);

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

            {activityGroups.length === 0 ? (
              <p className="mt-4 text-sm text-[#6B6B6B]">No activity yet. Your next open or reaction will show up here.</p>
            ) : (
              <ul className="mt-4 grid gap-3">
                {activityGroups.map((group) => (
                  <li key={group.key} className="rounded-xl border border-[#E8E6E3] bg-[#FFFFFF] p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                      <strong>{groupTitle(group)}</strong>
                      <span className="text-xs text-[#6B6B6B]" title={formatTimestamp(group.latestAt)}>
                        {formatRelativeTimestamp(group.latestAt)}
                      </span>
                    </div>
                    <div className="mt-3 grid gap-2 rounded-lg bg-[#FAF8F5] px-3 py-3">
                      {group.items
                        .filter((item) => item.type !== "sent")
                        .map((item) => (
                          <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#6B6B6B]">
                            <span>{groupedActivityLabel(item)}</span>
                            <span title={formatTimestamp(item.createdAt)}>
                              {formatRelativeTimestamp(item.createdAt)}
                            </span>
                          </div>
                        ))}
                      {group.items.every((item) => item.type === "sent") ? (
                        <div className="text-xs text-[#8B847C]">No opens or reactions yet.</div>
                      ) : null}
                    </div>
                    {group.slug ? (
                      <div className="mt-3">
                        <Link className="mono text-xs text-[#6B6B6B] underline" href={`/t/${group.slug}`} target="_blank">
                          /t/{group.slug}
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
                      <div className="text-xs text-[#6B6B6B]" title={formatTimestamp(message.createdAt)}>
                        {formatRelativeTimestamp(message.createdAt)}
                      </div>
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
