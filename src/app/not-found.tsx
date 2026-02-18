import Image from "next/image";
import Link from "next/link";

export default function NotFoundPage() {
  return (
    <main className="shell min-h-screen py-10">
      <section className="panel mx-auto max-w-xl p-8 text-center">
        <Image
          alt="tinykind"
          className="mx-auto h-auto w-[150px]"
          height={42}
          priority
          src="/branding-tinykind-dark.png"
          width={182}
        />
        <h1 className="mt-2 text-3xl">This note is unavailable</h1>
        <p className="mt-3 text-sm text-[var(--ink-soft)]">
          The TinyKind link may be expired or deleted.
        </p>
        <Link className="mt-5 inline-block text-sm font-semibold text-[#174a8c] underline" href="/">
          Return home
        </Link>
      </section>
    </main>
  );
}
