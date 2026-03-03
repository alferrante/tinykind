import Image from "next/image";
import Link from "next/link";

export default function NotFoundPage() {
  return (
    <main className="min-h-screen bg-[#F7F6F4] px-6 py-14 text-[#2E2E2E]">
      <section className="mx-auto max-w-[640px] rounded-[20px] border border-[#E8E6E3] bg-[#FAFAF9] px-8 py-10 text-center">
        <Image
          alt="tinykind"
          className="mx-auto h-auto w-[136px] sm:w-[172px]"
          height={109}
          priority
          src="/branding-tinykind-dark.png"
          unoptimized
          width={427}
        />
        <h1 className="mt-6 text-3xl font-medium leading-tight sm:text-4xl">This note is unavailable</h1>
        <p className="mt-4 text-base leading-relaxed text-[#6B6B6B]">
          The TinyKind link may be expired or deleted.
        </p>
        <Link
          className="mt-7 inline-flex rounded-full border border-[#E8E6E3] bg-white px-4 py-2 text-sm text-[#6B6B6B] transition duration-150 ease-out hover:bg-[#F1F1EF] hover:text-[#2E2E2E]"
          href="/"
        >
          Return home
        </Link>
      </section>
    </main>
  );
}
