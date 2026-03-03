"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ALLOWED_REACTIONS, type AllowedReactionEmoji } from "@/lib/types";

interface RecipientLandingProps {
  slug: string;
  senderName: string;
  recipientName: string;
  body: string;
  voiceUrl: string | null;
  initialReaction: string | null;
  autoOpen: boolean;
}

interface ReactionApiResponse {
  reaction: {
    emoji: AllowedReactionEmoji;
  };
  notification?: {
    attempted: boolean;
    sent: boolean;
    reason?: string;
  };
}

interface OpenApiResponse {
  recorded: boolean;
  notification?: {
    attempted: boolean;
    sent: boolean;
    reason?: string;
  };
}

const REPORT_REASONS = [
  { value: "spam", label: "Spam" },
  { value: "harassment", label: "Harassment" },
  { value: "scam", label: "Scam / phishing" },
  { value: "hate", label: "Hate or harmful content" },
  { value: "other", label: "Other" },
] as const;

export default function RecipientLanding({
  slug,
  senderName,
  recipientName,
  body,
  voiceUrl,
  initialReaction,
  autoOpen,
}: RecipientLandingProps) {
  const [opened, setOpened] = useState(autoOpen);
  const [selectedReaction, setSelectedReaction] = useState<string | null>(initialReaction);
  const [sending, setSending] = useState(false);
  const [reactionNotice, setReactionNotice] = useState<string>("");
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState<string>("spam");
  const [reportDetails, setReportDetails] = useState("");
  const [reporterEmail, setReporterEmail] = useState("");
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [reportNotice, setReportNotice] = useState("");

  useEffect(() => {
    if (autoOpen) {
      setOpened(true);
    }
  }, [autoOpen]);

  useEffect(() => {
    let aborted = false;
    const run = async (): Promise<void> => {
      try {
        const response = await fetch("/api/opens", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ slug }),
        });
        if (!response.ok || aborted) {
          return;
        }
        const payload = (await response.json()) as OpenApiResponse;
        if (payload.notification?.attempted && !payload.notification.sent) {
          console.warn("[tinykind] open notification unavailable", payload.notification.reason);
        }
      } catch {
        // Keep recipient flow uninterrupted.
      }
    };
    void run();
    return () => {
      aborted = true;
    };
  }, [slug]);

  function openNote(): void {
    setOpened(true);
  }

  async function onShare(): Promise<void> {
    if (typeof window === "undefined") {
      return;
    }
    const shareUrl = window.location.href.replace(/\?open=1$/, "");
    const data = {
      title: "TinyKind",
      text: `A tiny thank-you from ${senderName}`,
      url: shareUrl,
    };
    try {
      if (navigator.share) {
        await navigator.share(data);
        return;
      }
    } catch {
      // fall through to clipboard fallback
    }
    await navigator.clipboard.writeText(shareUrl);
    setReactionNotice("Link copied");
    setTimeout(() => setReactionNotice(""), 1600);
  }

  async function sendReaction(emoji: AllowedReactionEmoji): Promise<void> {
    try {
      setSending(true);
      setReactionNotice("");

      const response = await fetch("/api/reactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, emoji }),
      });

      const payload = (await response.json()) as ReactionApiResponse | { error?: string };
      if (!response.ok) {
        throw new Error("error" in payload ? payload.error : "Failed to save reaction.");
      }

      const reactionPayload = payload as ReactionApiResponse;
      setSelectedReaction(reactionPayload.reaction.emoji);
      if (reactionPayload.notification?.attempted && !reactionPayload.notification.sent) {
        setReactionNotice("Reaction saved. Sender notification is currently unavailable.");
      } else if (!reactionPayload.notification?.attempted) {
        if (reactionPayload.notification?.reason === "sender-notification-email-missing") {
          setReactionNotice("Reaction saved. Sender did not enable reaction notifications.");
        } else {
          setReactionNotice("Reaction saved.");
        }
      } else {
        setReactionNotice(`Sent to ${senderName}`);
      }
    } catch (error) {
      setReactionNotice(error instanceof Error ? error.message : "Could not save reaction.");
    } finally {
      setSending(false);
    }
  }

  async function submitReport(): Promise<void> {
    if (!reportReason) {
      setReportNotice("Choose a reason.");
      return;
    }
    try {
      setReportSubmitting(true);
      setReportNotice("");
      const response = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug,
          reason: reportReason,
          details: reportDetails,
          reporterEmail,
        }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to submit report.");
      }
      setReportNotice("Report submitted. Thank you.");
      setReportOpen(false);
      setReportDetails("");
      setTimeout(() => setReportNotice(""), 2000);
    } catch (error) {
      setReportNotice(error instanceof Error ? error.message : "Unable to submit report.");
    } finally {
      setReportSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#F7F6F4] text-[#2E2E2E]">
      <header className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-4 px-6 pt-6 sm:pt-8">
        <Image
          alt="tinykind"
          className="h-auto w-[136px] sm:w-[172px]"
          height={109}
          priority
          src="/branding-tinykind-dark.png"
          unoptimized
          width={427}
        />
        <div className="flex items-center gap-3">
          <Link
            className="rounded-full border border-[#E8E6E3] bg-white px-4 py-2 text-sm text-[#6B6B6B] transition duration-150 ease-out hover:bg-[#FAFAF9] hover:text-[#2E2E2E]"
            href="/"
          >
            Make your own
          </Link>
          <button
            aria-label="Share"
            className="rounded-full border border-[#E8E6E3] bg-white px-4 py-2 text-sm text-[#6B6B6B] transition duration-150 ease-out hover:bg-[#FAFAF9] hover:text-[#2E2E2E]"
            onClick={onShare}
            type="button"
          >
            Share
          </button>
        </div>
      </header>

      <section className="mx-auto w-full max-w-[720px] px-6 pb-20 pt-14 sm:pt-20">
        <div className="text-center">
          <p className="text-sm text-[#6B6B6B]">tinykind note</p>
          <h1 className="mt-3 text-[36px] font-medium leading-[1.2] tracking-[-0.02em] sm:text-[44px]">
            Hi {recipientName},
          </h1>
          <p className="mt-4 text-[22px] leading-[1.3] text-[#6B6B6B]">
            {opened ? `A note from ${senderName}.` : `${senderName} sent something kind your way.`}
          </p>
        </div>

        <section className="panel mt-10 overflow-hidden transition duration-300 ease-out">
          {!opened ? (
            <div className="flex min-h-[220px] flex-col items-center justify-center gap-5 px-6 py-8 text-center">
              <p className="max-w-[34ch] text-base leading-relaxed text-[#6B6B6B]">
                Open whenever you have a quiet moment.
              </p>
              <button
                className="rounded-full bg-[#B7C4C7] px-6 py-2.5 text-base font-medium text-white transition duration-150 ease-out hover:bg-[#A6B4B8]"
                onClick={openNote}
                type="button"
              >
                Open note
              </button>
            </div>
          ) : (
            <article className="space-y-5 px-6 py-7 sm:px-8">
              <p className="text-sm uppercase tracking-[0.12em] text-[#6B6B6B]">From {senderName}</p>
              <p className="whitespace-pre-wrap text-[18px] leading-[1.6] text-[#2E2E2E]">{body}</p>
              {voiceUrl ? (
                <audio className="w-full" controls preload="none" src={voiceUrl}>
                  Your browser does not support audio playback.
                </audio>
              ) : null}
            </article>
          )}

          <div className="flex flex-wrap items-center justify-between gap-4 border-t border-[#EFEDEB] px-6 py-4 sm:px-8">
            <div className="text-sm text-[#6B6B6B]">
              {reactionNotice || reportNotice || (opened ? "How did this make you feel?" : "Open the note to react")}
            </div>
            <div className="flex gap-2">
              <Link
                className="rounded-full border border-[#E8E6E3] bg-white px-4 py-2 text-sm text-[#6B6B6B] transition duration-150 ease-out hover:bg-[#F1F1EF] hover:text-[#2E2E2E]"
                href="/"
              >
                Send one back
              </Link>
              <button
                className="rounded-full border border-[#E8E6E3] bg-white px-4 py-2 text-sm text-[#6B6B6B] transition duration-150 ease-out hover:bg-[#F1F1EF] hover:text-[#2E2E2E]"
                onClick={() => setReportOpen(true)}
                type="button"
              >
                Report
              </button>
            </div>
          </div>
        </section>

        {opened ? (
          <div className="mt-8 flex flex-wrap justify-center gap-2">
            {ALLOWED_REACTIONS.map((emoji) => {
              const isActive = selectedReaction === emoji;
              return (
                <button
                  className={[
                    "rounded-full border px-3 py-1.5 text-xl transition duration-150 ease-out",
                    isActive
                      ? "border-[#B7C4C7] bg-[#E6ECEE]"
                      : "border-[#E8E6E3] bg-white hover:bg-[#F1F1EF]",
                  ].join(" ")}
                  disabled={sending}
                  key={emoji}
                  onClick={() => sendReaction(emoji)}
                  type="button"
                >
                  {emoji}
                </button>
              );
            })}
          </div>
        ) : (
          <div className="mt-8 text-center text-sm text-[#6B6B6B]">
            <button
              className="rounded-full bg-transparent px-3 py-1.5 transition duration-150 ease-out hover:bg-[#F1F1EF] hover:text-[#2E2E2E]"
              onClick={openNote}
              type="button"
            >
              Tap to open
            </button>
          </div>
        )}
      </section>

      {reportOpen ? (
        <div className="fixed inset-0 z-40 grid place-items-center bg-[#2E2E2E1A] px-4">
          <section className="w-full max-w-md rounded-2xl border border-[#E8E6E3] bg-[#FFFFFF] p-5 text-[#2E2E2E] shadow-[0_10px_26px_rgba(0,0,0,0.06)]">
            <h2 className="text-lg font-medium">Report TinyKind</h2>
            <p className="mt-1 text-sm text-[#6B6B6B]">Help us prevent abuse. This sends a private report to TinyKind admin.</p>

            <label className="mt-3 grid gap-1 text-sm text-[#2E2E2E]">
              Reason
              <select className="field" onChange={(event) => setReportReason(event.target.value)} value={reportReason}>
                {REPORT_REASONS.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="mt-3 grid gap-1 text-sm text-[#2E2E2E]">
              Details (optional)
              <textarea
                className="field min-h-24 resize-y"
                maxLength={300}
                onChange={(event) => setReportDetails(event.target.value)}
                placeholder="Add context"
                value={reportDetails}
              />
            </label>

            <label className="mt-3 grid gap-1 text-sm text-[#2E2E2E]">
              Your email (optional)
              <input
                className="field mono"
                onChange={(event) => setReporterEmail(event.target.value)}
                placeholder="you@email.com"
                type="email"
                value={reporterEmail}
              />
            </label>

            <div className="mt-4 flex flex-wrap gap-2">
              <button className="btn btn-primary" disabled={reportSubmitting} onClick={submitReport} type="button">
                {reportSubmitting ? "Submitting..." : "Submit report"}
              </button>
              <button className="btn" onClick={() => setReportOpen(false)} type="button">
                Cancel
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}
