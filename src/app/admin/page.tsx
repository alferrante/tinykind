import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { isAdminFromCookies } from "@/lib/adminAuth";
import { getStorageDiagnostics, listRecentEvents, listRecentMessagesWithLatestReaction, listRecentReports } from "@/lib/store";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "TinyKind Admin",
  robots: {
    index: false,
    follow: false,
  },
};

function formatTimestamp(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export default async function AdminPage({
  searchParams,
}: {
  searchParams?: Promise<{ backup?: string }>;
}) {
  const cookieStore = await cookies();
  if (!isAdminFromCookies(cookieStore)) {
    redirect("/admin/login");
  }

  const params = searchParams ? await searchParams : undefined;
  const [rows, events] = await Promise.all([
    listRecentMessagesWithLatestReaction(500),
    listRecentEvents(120),
  ]);
  const reports = await listRecentReports(120);
  const diagnostics = await getStorageDiagnostics();
  const failedNotifications = events.filter((event) => event.type === "reaction_notify_failed");
  const sentNotifications = events.filter((event) => event.type === "reaction_notify_sent");
  const openNotifyFailures = events.filter((event) => event.type === "open_notify_failed");
  const openNotifySent = events.filter((event) => event.type === "open_notify_sent");
  const openedEvents = events.filter((event) => event.type === "message_opened");

  return (
    <main className="min-h-screen bg-[#F7F6F4] text-[#2E2E2E]">
      <section className="shell px-1 py-8 md:py-12">
      <header className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-medium md:text-4xl">TinyKind Admin</h1>
          <p className="mt-2 text-sm text-[#6B6B6B]">
            Showing {rows.length} most recent submission{rows.length === 1 ? "" : "s"}.
          </p>
        </div>
        <div className="flex gap-2">
          <form action="/api/admin/backup" method="post">
            <button className="btn" type="submit">
              Backup now
            </button>
          </form>
          <form action="/api/admin/logout" method="post">
            <button className="btn" type="submit">
              Log out
            </button>
          </form>
        </div>
      </header>

      {params?.backup === "ok" ? (
        <div className="mb-4 rounded-xl border border-[#b8ceb0] bg-[#f4ffef] px-4 py-3 text-sm text-[#2f5d2f]">
          Backup created successfully.
        </div>
      ) : null}

      <section className="panel mb-4 p-4 md:p-5">
        <div className="text-sm text-[#2E2E2E]">
          <strong>Storage diagnostics</strong>
        </div>
        <div className="mt-2 grid gap-1 text-xs text-[#6B6B6B]">
          <div>Data file: {diagnostics.dataFile}</div>
          <div>Backup dir: {diagnostics.backupDir}</div>
          <div>Backups: {diagnostics.backupCount}</div>
          <div>Messages in file: {diagnostics.messageCount}</div>
          <div>Notify failures logged: {failedNotifications.length}</div>
          <div>Open events logged: {openedEvents.length}</div>
          <div>Open notify failures: {openNotifyFailures.length}</div>
          <div>Abuse reports: {reports.length}</div>
        </div>
      </section>

      {reports.length > 0 ? (
        <section className="panel mb-4 p-4 md:p-5">
          <div className="text-sm text-[#2E2E2E]">
            <strong>Recent abuse reports</strong>
          </div>
          <ul className="mt-2 grid gap-2 text-xs text-[#6B6B6B]">
            {reports.slice(0, 20).map((report) => (
              <li key={report.id}>
                {formatTimestamp(report.createdAt)} · /t/{report.slug} · {report.reason}
                {report.reporterEmail ? ` · ${report.reporterEmail}` : ""}
                {report.details ? ` · ${report.details}` : ""}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {failedNotifications.length > 0 ? (
        <section className="panel mb-4 p-4 md:p-5">
          <div className="text-sm text-[#2E2E2E]">
            <strong>Recent notification failures</strong>
          </div>
          <ul className="mt-2 grid gap-2 text-xs text-[#6B6B6B]">
            {failedNotifications.slice(0, 10).map((event) => (
              <li key={event.id}>
                {formatTimestamp(event.createdAt)} · {event.senderEmail ?? "unknown"} · {event.metadata.reason ?? "unknown reason"}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {sentNotifications.length > 0 ? (
        <section className="panel mb-4 p-4 md:p-5">
          <div className="text-sm text-[#2E2E2E]">
            <strong>Recent notification sends</strong>
          </div>
          <ul className="mt-2 grid gap-2 text-xs text-[#6B6B6B]">
            {sentNotifications.slice(0, 10).map((event) => (
              <li key={event.id}>
                {formatTimestamp(event.createdAt)} · {event.senderEmail ?? "unknown"} · {event.metadata.emoji ?? "?"} ·
                {" "}duration {event.metadata.durationMs ?? "?"}ms · attempts {event.metadata.attempts ?? "?"}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {openNotifyFailures.length > 0 ? (
        <section className="panel mb-4 p-4 md:p-5">
          <div className="text-sm text-[#2E2E2E]">
            <strong>Recent open notification failures</strong>
          </div>
          <ul className="mt-2 grid gap-2 text-xs text-[#6B6B6B]">
            {openNotifyFailures.slice(0, 10).map((event) => (
              <li key={event.id}>
                {formatTimestamp(event.createdAt)} · {event.senderEmail ?? "unknown"} ·
                {" "}duration {event.metadata.durationMs ?? "?"}ms · attempts {event.metadata.attempts ?? "?"} ·
                {" "}reason {event.metadata.reason ?? "unknown"}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {openNotifySent.length > 0 ? (
        <section className="panel mb-4 p-4 md:p-5">
          <div className="text-sm text-[#2E2E2E]">
            <strong>Recent open notification sends</strong>
          </div>
          <ul className="mt-2 grid gap-2 text-xs text-[#6B6B6B]">
            {openNotifySent.slice(0, 10).map((event) => (
              <li key={event.id}>
                {formatTimestamp(event.createdAt)} · {event.senderEmail ?? "unknown"} · duration{" "}
                {event.metadata.durationMs ?? "?"}ms · attempts {event.metadata.attempts ?? "?"}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="panel p-5 md:p-7">
        {rows.length === 0 ? (
          <p className="text-sm text-[#6B6B6B]">No TinyKinds found yet.</p>
        ) : (
          <ul className="grid gap-3">
            {rows.map(({ message, latestReaction }) => (
              <li key={message.id} className="rounded-xl border border-[#E8E6E3] bg-[#FFFFFF] p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="text-sm text-[#2E2E2E]">
                    <strong>{message.senderName}</strong> to <strong>{message.recipientName}</strong>
                  </div>
                  <div className="text-xs text-[#6B6B6B]">{formatTimestamp(message.createdAt)}</div>
                </div>

                <div className="mt-2 whitespace-pre-wrap break-words text-sm text-[#2E2E2E]">
                  {message.body}
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-[#6B6B6B]">
                  <span>Contact: {message.recipientContact ?? "not provided"}</span>
                  <span>Channel: {message.channel}</span>
                  <span>
                    Sender email: {message.senderNotifyEmail ? message.senderNotifyEmail : "not provided"}
                  </span>
                  <span>
                    Latest reaction: {latestReaction ? `${latestReaction.emoji} (${formatTimestamp(latestReaction.createdAt)})` : "none"}
                  </span>
                  <Link className="mono text-[#6B6B6B] underline" href={`/t/${message.shortLinkSlug}`} target="_blank">
                    /t/{message.shortLinkSlug}
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
      </section>
    </main>
  );
}
