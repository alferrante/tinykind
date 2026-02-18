import Image from "next/image";
import Link from "next/link";
import CreateTinyKindCard from "@/components/CreateTinyKindCard";
import { listRecentMessages } from "@/lib/store";

export const dynamic = "force-dynamic";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default async function HomePage() {
  const recent = await listRecentMessages(10);

  return (
    <main className="shell min-h-screen py-8 md:py-12">
      <header className="mb-5 md:mb-8">
        <div className="mb-4">
          <Image
            alt="tinykind"
            className="h-auto w-[170px] md:w-[210px]"
            height={48}
            priority
            src="/branding-tinykind-light.png"
            width={220}
          />
        </div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#f4dfc0]">TinyKind MVP</p>
        <h1 className="mt-2 text-4xl leading-[1.05] text-[#fff5df] md:text-5xl">
          Write once.
          <br />
          Send warmth in one link.
        </h1>
      </header>

      <div className="grid gap-5 md:grid-cols-[1.2fr_0.8fr]">
        <CreateTinyKindCard />

        <section className="panel p-5 md:p-7">
          <h2 className="text-2xl leading-tight">Recent TinyKinds</h2>
          {recent.length === 0 ? (
            <p className="mt-3 text-sm text-[var(--ink-soft)]">No messages yet. Create one to get a landing URL.</p>
          ) : (
            <ul className="mt-4 grid gap-3">
              {recent.map((message) => (
                <li className="rounded-xl border border-[var(--line)] bg-[#fff8ee] p-3" key={message.id}>
                  <p className="text-sm font-semibold text-[var(--ink)]">
                    {message.recipientName} <span className="font-normal text-[var(--ink-soft)]">({message.channel})</span>
                  </p>
                  <p className="mt-1 text-sm text-[var(--ink-soft)]">{formatDate(message.createdAt)}</p>
                  <p className="mt-2 line-clamp-2 text-sm">{message.body}</p>
                  <Link
                    className="mono mt-2 inline-block text-xs text-[#174a8c] underline"
                    href={`/t/${message.shortLinkSlug}`}
                  >
                    /t/{message.shortLinkSlug}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
