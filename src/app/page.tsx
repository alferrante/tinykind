import Image from "next/image";
import Link from "next/link";
import CreateTinyKindCard from "@/components/CreateTinyKindCard";
import { getAuthenticatedSenderEmail } from "@/lib/senderAuth";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const senderEmail = await getAuthenticatedSenderEmail();

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
            <Link className="btn" href="/dashboard">
              Dashboard
            </Link>
          ) : (
            <Link className="btn" href="/login">
              Optional sign in
            </Link>
          )}
        </div>
        <div className="mb-4">
          {senderEmail ? (
            <p className="text-sm text-[#dce7ff]">Signed in as {senderEmail}</p>
          ) : (
            <p className="text-sm text-[#dce7ff]">
              No account needed to send. Sign in to save history and weekly reminders.
            </p>
          )}
        </div>
        <h1 className="mt-2 text-4xl leading-[1.05] text-[#fff5df] md:text-5xl">
          Make someone feel seen, one tiny kind note at a time.
        </h1>
      </header>

      <div className="max-w-[860px]">
        <CreateTinyKindCard />
      </div>
    </main>
  );
}
