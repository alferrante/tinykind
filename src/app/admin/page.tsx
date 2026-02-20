import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { isAdminFromCookies } from "@/lib/adminAuth";
import { getStorageDiagnostics, listRecentMessagesWithLatestReaction } from "@/lib/store";

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
  const rows = await listRecentMessagesWithLatestReaction(500);
  const diagnostics = await getStorageDiagnostics();

  return (
    <main className="shell min-h-screen py-8 md:py-12">
      <header className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl text-[#fff5df] md:text-4xl">TinyKind Admin</h1>
          <p className="mt-2 text-sm text-[#dce7ff]">
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
        <div className="text-sm text-[#263346]">
          <strong>Storage diagnostics</strong>
        </div>
        <div className="mt-2 grid gap-1 text-xs text-[#4b5d77]">
          <div>Data file: {diagnostics.dataFile}</div>
          <div>Backup dir: {diagnostics.backupDir}</div>
          <div>Backups: {diagnostics.backupCount}</div>
          <div>Messages in file: {diagnostics.messageCount}</div>
        </div>
      </section>

      <section className="panel p-5 md:p-7">
        {rows.length === 0 ? (
          <p className="text-sm text-[var(--ink-soft)]">No TinyKinds found yet.</p>
        ) : (
          <ul className="grid gap-3">
            {rows.map(({ message, latestReaction }) => (
              <li key={message.id} className="rounded-xl border border-[var(--line)] bg-[#fff8ee] p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="text-sm text-[#263346]">
                    <strong>{message.senderName}</strong> to <strong>{message.recipientName}</strong>
                  </div>
                  <div className="text-xs text-[#4b5d77]">{formatTimestamp(message.createdAt)}</div>
                </div>

                <div className="mt-2 whitespace-pre-wrap break-words text-sm text-[#263346]">
                  {message.body}
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-[#4b5d77]">
                  <span>Contact: {message.recipientContact ?? "not provided"}</span>
                  <span>Channel: {message.channel}</span>
                  <span>
                    Sender email: {message.senderNotifyEmail ? message.senderNotifyEmail : "not provided"}
                  </span>
                  <span>
                    Latest reaction: {latestReaction ? `${latestReaction.emoji} (${formatTimestamp(latestReaction.createdAt)})` : "none"}
                  </span>
                  <Link className="mono text-[#174a8c] underline" href={`/t/${message.shortLinkSlug}`} target="_blank">
                    /t/{message.shortLinkSlug}
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
