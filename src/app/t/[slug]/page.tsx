import type { Metadata } from "next";
import { notFound } from "next/navigation";
import RecipientLanding from "@/components/RecipientLanding";
import { getMessageBySlug, getMessageWithLatestReactionBySlug } from "@/lib/store";

export const dynamic = "force-dynamic";

function titleFromSender(senderName: string | null | undefined): string {
  const cleaned = senderName?.trim();
  return cleaned ? `${cleaned} sent you a TinyKind` : "You've received a TinyKind";
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const message = await getMessageBySlug(slug);

  if (!message) {
    return {
      title: "TinyKind",
    };
  }

  return {
    title: titleFromSender(message.senderName),
  };
}

export default async function RecipientPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ open?: string }>;
}) {
  const { slug } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const autoOpen = resolvedSearchParams?.open === "1";
  const payload = await getMessageWithLatestReactionBySlug(slug);
  if (!payload) {
    notFound();
  }

  return (
    <RecipientLanding
      slug={payload.message.shortLinkSlug}
      senderName={payload.message.senderName}
      recipientName={payload.message.recipientName}
      body={payload.message.body}
      voiceUrl={payload.message.voiceUrl}
      initialReaction={payload.latestReaction?.emoji ?? null}
      autoOpen={autoOpen}
    />
  );
}
