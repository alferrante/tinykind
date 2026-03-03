import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import AccountMenu from "@/components/AccountMenu";
import DashboardReminderForm from "@/components/DashboardReminderForm";
import { getAuthenticatedSenderEmail } from "@/lib/senderAuth";
import { getSenderProfile, listMessagesBySenderEmail } from "@/lib/store";

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

export default async function DashboardPage() {
  const senderEmail = await getAuthenticatedSenderEmail();
  if (!senderEmail) {
    redirect("/login?next=%2Fdashboard");
  }

  const [profile, messages] = await Promise.all([
    getSenderProfile(senderEmail),
    listMessagesBySenderEmail(senderEmail, 200),
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
