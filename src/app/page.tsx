import Image from "next/image";
import CreateTinyKindCard from "@/components/CreateTinyKindCard";

export const dynamic = "force-dynamic";

export default function HomePage() {
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
        <h1 className="mt-2 text-4xl leading-[1.05] text-[#fff5df] md:text-5xl">
          Write once.
          <br />
          Send warmth in one link.
        </h1>
      </header>

      <div className="max-w-[860px]">
        <CreateTinyKindCard />
      </div>
    </main>
  );
}
