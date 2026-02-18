import { notFound } from "next/navigation";
import RecipientLanding from "@/components/RecipientLanding";
import { getMessageWithLatestReactionBySlug } from "@/lib/store";

export const dynamic = "force-dynamic";

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
      unwrapStyle={payload.message.unwrapStyle}
      initialReaction={payload.latestReaction?.emoji ?? null}
      autoOpen={autoOpen}
    />
  );
}
