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
}

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
  const [reduceMotion, setReduceMotion] = useState(false);
  const [tiltX, setTiltX] = useState(0);
  const [tiltY, setTiltY] = useState(0);

  useEffect(() => {
    if (autoOpen) {
      setOpened(true);
    }
  }, [autoOpen]);

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

      setSelectedReaction((payload as ReactionApiResponse).reaction.emoji);
      setReactionNotice(`Sent to ${senderName}`);
    } catch (error) {
      setReactionNotice(error instanceof Error ? error.message : "Could not save reaction.");
    } finally {
      setSending(false);
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
            ↗
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
      </div>

      <div className="tk-dockNotice" data-visible={reactionNotice ? "true" : "false"}>
        {reactionNotice}
      </div>
    </main>
  );
}
