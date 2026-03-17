"use client";

import Image from "next/image";
import Link from "next/link";
import { type CSSProperties, useEffect, useMemo, useState } from "react";
import { ALLOWED_REACTIONS, type AllowedReactionEmoji, type UnwrapStyle } from "@/lib/types";

interface RecipientLandingProps {
  slug: string;
  senderName: string;
  recipientName: string;
  body: string;
  voiceUrl: string | null;
  unwrapStyle: UnwrapStyle;
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
  unwrapStyle,
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
  const [reduceMotion, setReduceMotion] = useState(false);
  const [tiltX, setTiltX] = useState(0);
  const [tiltY, setTiltY] = useState(0);

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

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = (): void => setReduceMotion(mediaQuery.matches);
    update();
    mediaQuery.addEventListener("change", update);
    return () => mediaQuery.removeEventListener("change", update);
  }, []);

  const stageTheme = useMemo(() => {
    if (unwrapStyle === "B") {
      return "bloom";
    }
    if (unwrapStyle === "C") {
      return "quiet";
    }
    return "sunrise";
  }, [unwrapStyle]);

  const envelopeStyle = useMemo(
    () =>
      ({
        "--tk-tilt-x": `${tiltX}deg`,
        "--tk-tilt-y": `${tiltY}deg`,
      }) as CSSProperties,
    [tiltX, tiltY],
  );

  function openEnvelope(): void {
    setOpened(true);
  }

  function onStageMouseMove(event: React.MouseEvent<HTMLElement>): void {
    if (reduceMotion) {
      return;
    }
    const rect = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width - 0.5;
    const y = (event.clientY - rect.top) / rect.height - 0.5;
    setTiltX(y * -2.4);
    setTiltY(x * 2.8);
  }

  function onStageMouseLeave(): void {
    setTiltX(0);
    setTiltY(0);
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
    <main className="tk-page" data-theme="midnight">
      <header className="tk-topbar">
        <div className="tk-brand">
          <Image
            alt="tinykind"
            className="tk-brandImage"
            height={42}
            priority
            src="/branding-tinykind-light.png"
            width={182}
          />
        </div>
        <div className="tk-actions">
          <Link className="tk-ghost" href="/">
            Make your own
          </Link>
          <button aria-label="Share" className="tk-ghost" onClick={onShare} type="button">
            Share
          </button>
        </div>
      </header>

      <section className="tk-shell">
        <section className="tk-copy">
          <div className="tk-kicker">TINYKIND NOTE</div>
          <h1 className="tk-h1">
            A tiny thank-you from <span className="tk-accent">{senderName}</span>.
          </h1>
          <p className="tk-sub">Open the envelope to read it.</p>

          <div className="tk-meta">
            <div className="tk-chip">To {recipientName}</div>
            {opened ? <div className="tk-chip">Made with tinykind</div> : null}
          </div>
        </section>

        <section
          aria-label="Envelope and note"
          className="tk-stage"
          data-open={opened ? "true" : "false"}
          data-style={stageTheme}
          onMouseLeave={onStageMouseLeave}
          onMouseMove={onStageMouseMove}
        >
          <div aria-hidden="true" className="tk-spotlight" />

          <div className="tk-envelopeWrap" onClick={openEnvelope} style={envelopeStyle}>
            <article className="tk-noteCard" data-open={opened ? "true" : "false"}>
              <p className="tk-noteLabel">FROM {senderName}</p>
              <p className="tk-noteText">{body}</p>
              {voiceUrl ? (
                <audio className="tk-noteVoice" controls preload="none" src={voiceUrl}>
                  Your browser does not support audio playback.
                </audio>
              ) : null}
            </article>

            <div className="tk-envelopeBack" />
            <div className="tk-envelopeFront" />
            <div className="tk-envelopeFlap" data-open={opened ? "true" : "false"} />

            {!opened ? (
              <div className="tk-seal">
                <Image alt="" fill priority sizes="90px" src="/art/wax-seal.png" />
              </div>
            ) : null}
          </div>

          {!opened ? (
            <button className="tk-openPill" onClick={openEnvelope} type="button">
              Tap to open
            </button>
          ) : null}
        </section>
      </section>

      <div className="tk-dock" data-visible={opened ? "true" : "false"}>
        <div className="tk-dockLabel">React</div>
        {ALLOWED_REACTIONS.map((emoji) => {
          const isActive = selectedReaction === emoji;
          return (
            <button
              className={`tk-emojiBtn ${isActive ? "tk-emojiBtnActive" : ""}`}
              disabled={sending}
              key={emoji}
              onClick={() => sendReaction(emoji)}
              type="button"
            >
              {emoji}
            </button>
          );
        })}
        <div className="tk-dockDivider" />
        <Link className="tk-dockCTA" href="/">
          Send one back
        </Link>
        <button className="tk-dockCTA tk-dockCTASecondary" onClick={() => setReportOpen(true)} type="button">
          Report
        </button>
      </div>

      <div className="tk-dockNotice" data-visible={reactionNotice || reportNotice ? "true" : "false"}>
        {reactionNotice || reportNotice}
      </div>

      {reportOpen ? (
        <div className="fixed inset-0 z-40 grid place-items-center bg-[#05060acc] px-4">
          <section className="w-full max-w-md rounded-2xl border border-[rgba(255,255,255,0.16)] bg-[rgba(10,14,20,0.96)] p-5 text-white shadow-[0_24px_50px_rgba(0,0,0,0.4)]">
            <h2 className="text-lg font-medium">Report TinyKind</h2>
            <p className="mt-1 text-sm text-[rgba(255,255,255,0.72)]">
              Help us prevent abuse. This sends a private report to TinyKind admin.
            </p>

            <label className="mt-3 grid gap-1 text-sm text-white">
              Reason
              <select className="field bg-[rgba(255,255,255,0.96)] text-[#2E2E2E]" onChange={(event) => setReportReason(event.target.value)} value={reportReason}>
                {REPORT_REASONS.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="mt-3 grid gap-1 text-sm text-white">
              Details (optional)
              <textarea
                className="field min-h-24 resize-y bg-[rgba(255,255,255,0.96)] text-[#2E2E2E]"
                maxLength={300}
                onChange={(event) => setReportDetails(event.target.value)}
                placeholder="Add context"
                value={reportDetails}
              />
            </label>

            <label className="mt-3 grid gap-1 text-sm text-white">
              Your email (optional)
              <input
                className="field mono bg-[rgba(255,255,255,0.96)] text-[#2E2E2E]"
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
