"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import SuggestionRow from "@/components/SuggestionRow";

interface CreatedMessage {
  id: string;
  shortLinkSlug: string;
}

interface CreateResponse {
  message: CreatedMessage;
  messageUrl: string;
  deliveryMode: "link" | "email";
  recipientEmail: string | null;
  gmailComposeUrl: string | null;
  emailSubject: string;
  emailBody: string;
  sharePreview: string;
}

type ComposerStep = "compose" | "share";

interface CreateTinyKindCardProps {
  senderDefaultName?: string;
  senderEmail: string | null;
  greetingName: string;
  isAuthenticated: boolean;
  promptSuggestions: readonly string[];
  senderSentCount: number | null;
  streakSummary: {
    sentThisWeek: boolean;
    currentStreak: number;
  } | null;
}

interface DraftSnapshot {
  senderNotifyEmail: string;
  recipientName: string;
  body: string;
}

const DRAFT_STORAGE_KEY = "tinykind-compose-draft-v6";

function loadDraft(): DraftSnapshot | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const raw = window.localStorage.getItem(DRAFT_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as Partial<DraftSnapshot>;
    return {
      senderNotifyEmail: typeof parsed.senderNotifyEmail === "string" ? parsed.senderNotifyEmail : "",
      recipientName: typeof parsed.recipientName === "string" ? parsed.recipientName : "",
      body: typeof parsed.body === "string" ? parsed.body : "",
    };
  } catch {
    return null;
  }
}

function saveDraft(snapshot: DraftSnapshot): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    // ignore storage failures
  }
}

function clearDraft(): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.removeItem(DRAFT_STORAGE_KEY);
  } catch {
    // ignore storage failures
  }
}

function looksLikeEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function formatDisplayNameFromEmail(value: string): string {
  const localPart = value.trim().split("@")[0] ?? "";
  const cleaned = localPart.replace(/[._-]+/g, " ").trim();
  if (!cleaned) {
    return "Someone";
  }
  return cleaned.replace(/\b\w/g, (char) => char.toUpperCase());
}

function buildGmailComposeUrl(subject: string, body: string): string {
  const params = new URLSearchParams({
    view: "cm",
    fs: "1",
    su: subject,
    body,
  });
  return `https://mail.google.com/mail/?${params.toString()}`;
}

function parseSendError(raw: string, fallback: string): string {
  if (!raw) {
    return fallback;
  }
  try {
    const parsed = JSON.parse(raw) as { error?: string };
    return parsed.error || fallback;
  } catch {
    return fallback;
  }
}

function CopyIcon() {
  return (
    <svg aria-hidden className="h-5 w-5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24">
      <rect height="11" rx="2.2" width="11" x="9" y="9" />
      <path d="M7.5 15H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v1.5" />
    </svg>
  );
}

function ShareIcon({ kind }: { kind: "copy" | "message" | "whatsapp" | "email" | "slack" }) {
  const common = {
    "aria-hidden": true,
    className: "h-8 w-8",
    fill: "none",
    stroke: "currentColor",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    strokeWidth: 1.8,
    viewBox: "0 0 24 24",
  };

  if (kind === "copy") {
    return <CopyIcon />;
  }
  if (kind === "message") {
    return (
      <svg {...common}>
        <path d="M6.5 18.5 4.5 20l.6-3.3A7.8 7.8 0 1 1 20 11.8c0 4.3-3.5 7.7-7.8 7.7H6.5Z" />
        <path d="M8.7 10.9h.01" />
        <path d="M12 10.9h.01" />
        <path d="M15.3 10.9h.01" />
      </svg>
    );
  }
  if (kind === "whatsapp") {
    return (
      <svg {...common}>
        <path d="M12.1 20a7.8 7.8 0 0 1-4-.9L4.7 20l1-3.3a7.8 7.8 0 1 1 6.4 3.3Z" />
        <path d="M10 8.8c.2-.4.5-.5.8-.5h.4c.2 0 .5.1.6.4l.8 2c.1.3.1.5-.1.7l-.5.5c-.2.2-.2.3-.1.6.4.7 1 1.3 1.7 1.7.3.2.4.1.6-.1l.5-.5c.2-.2.4-.2.7-.1l2 .8c.3.1.4.4.4.6v.4c0 .3-.1.6-.5.8-.5.3-1.1.4-1.8.3-1-.1-2-.5-3.1-1.3a10.2 10.2 0 0 1-2.6-2.6c-.8-1.1-1.2-2.1-1.3-3.1-.1-.7 0-1.3.3-1.8Z" />
      </svg>
    );
  }
  if (kind === "email") {
    return (
      <svg {...common}>
        <rect height="13" rx="2.4" width="18" x="3" y="5.5" />
        <path d="m4.9 7.9 6.3 4.9a1.4 1.4 0 0 0 1.7 0l6.2-4.9" />
      </svg>
    );
  }
  return (
      <svg {...common}>
      <path d="M8.5 4.8a1.3 1.3 0 0 0-1.3 1.3v2.4H4.8a1.3 1.3 0 0 0-1.3 1.3v1.1a1.3 1.3 0 0 0 1.3 1.3h2.4v2.4a1.3 1.3 0 0 0 1.3 1.3h1.1a1.3 1.3 0 0 0 1.3-1.3v-2.4h2.4a1.3 1.3 0 0 0 1.3-1.3V9.8a1.3 1.3 0 0 0-1.3-1.3h-2.4V6.1a1.3 1.3 0 0 0-1.3-1.3H8.5Z" />
      <path d="M15.7 14.2a1.3 1.3 0 0 0-1.3 1.3V18h-2.5a1.3 1.3 0 0 0-1.3 1.3v.7a1.3 1.3 0 0 0 1.3 1.3h2.5v2.5a1.3 1.3 0 0 0 1.3 1.3h.7a1.3 1.3 0 0 0 1.3-1.3v-2.5h2.5a1.3 1.3 0 0 0 1.3-1.3v-.7a1.3 1.3 0 0 0-1.3-1.3h-2.5v-2.5a1.3 1.3 0 0 0-1.3-1.3h-.7Z" transform="scale(.72) translate(8 -1)" />
    </svg>
  );
}

function SealedEnvelope() {
  return (
    <div className="tk-shareEnvelope" aria-hidden>
      <div className="tk-shareEnvelopeFlap" />
      <div className="tk-shareEnvelopeSeal">
        <span className="tk-shareEnvelopeHeart">❤</span>
      </div>
    </div>
  );
}

function ConfettiField() {
  const pieces = [
    ["6%", "16%", "#D9ECDC", "10px", "4.3s", "0s", "-12deg"],
    ["13%", "9%", "#F5D5B2", "12px", "4.8s", "0.15s", "18deg"],
    ["21%", "18%", "#F2B6A0", "9px", "4.5s", "0.05s", "-20deg"],
    ["28%", "12%", "#CFC7FF", "13px", "4.9s", "0.22s", "14deg"],
    ["35%", "8%", "#F6D89E", "10px", "4.4s", "0.1s", "-6deg"],
    ["42%", "20%", "#BEE5E7", "11px", "4.7s", "0.28s", "22deg"],
    ["49%", "10%", "#F9CDBA", "12px", "4.6s", "0.12s", "-18deg"],
    ["56%", "18%", "#DAD1F7", "9px", "4.85s", "0.34s", "11deg"],
    ["63%", "11%", "#D9ECDC", "13px", "4.55s", "0.18s", "-24deg"],
    ["70%", "7%", "#F5D5B2", "10px", "4.75s", "0.26s", "17deg"],
    ["77%", "17%", "#F2B6A0", "11px", "4.35s", "0.08s", "-10deg"],
    ["84%", "10%", "#CFC7FF", "9px", "4.8s", "0.3s", "24deg"],
    ["91%", "16%", "#F6D89E", "12px", "4.65s", "0.2s", "-16deg"],
    ["10%", "28%", "#BEE5E7", "9px", "4.6s", "0.4s", "12deg"],
    ["24%", "30%", "#F9CDBA", "11px", "4.9s", "0.5s", "-22deg"],
    ["47%", "26%", "#DAD1F7", "10px", "4.5s", "0.38s", "8deg"],
    ["67%", "29%", "#D9ECDC", "12px", "4.7s", "0.44s", "-15deg"],
    ["88%", "27%", "#F5D5B2", "10px", "4.55s", "0.36s", "21deg"],
  ] as const;

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {pieces.map(([left, top, color, size, duration, delay, rotate], index) => (
        <span
          className="tk-confettiPiece"
          key={`${left}-${top}-${index}`}
          style={{
            left,
            top,
            backgroundColor: color,
            width: size,
            height: size,
            animationDuration: duration,
            animationDelay: delay,
            transform: `rotate(${rotate})`,
          }}
        />
      ))}
    </div>
  );
}

function ShareButton({
  label,
  icon,
  onClick,
}: {
  label: string;
  icon: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      className="group flex flex-col items-center gap-2 text-center text-[#8E8476] transition duration-150 ease-out hover:text-[#2E2E2E]"
      onClick={onClick}
      type="button"
    >
      <span className="flex h-[72px] w-[72px] items-center justify-center rounded-[20px] border border-[#E5DED5] bg-[#FFFDFC] text-[#7A7269] transition duration-150 ease-out group-hover:-translate-y-0.5 group-hover:border-[#D9D0C4] group-hover:bg-white">
        {icon}
      </span>
      <span className="text-[15px] font-medium">{label}</span>
    </button>
  );
}

export default function CreateTinyKindCard({
  senderDefaultName = "",
  senderEmail,
  greetingName,
  isAuthenticated,
  promptSuggestions,
  senderSentCount,
  streakSummary,
}: CreateTinyKindCardProps) {
  const composeTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const senderEmailInputRef = useRef<HTMLInputElement | null>(null);
  const suggestionIntervalRef = useRef<number | null>(null);
  const suggestionTimeoutRef = useRef<number | null>(null);
  const [step, setStep] = useState<ComposerStep>("compose");
  const [senderNotifyEmail, setSenderNotifyEmail] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [body, setBody] = useState("");
  const [website, setWebsite] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<CreateResponse | null>(null);
  const [copied, setCopied] = useState("");
  const [draftLoaded, setDraftLoaded] = useState(false);
  const [suggestionPulse, setSuggestionPulse] = useState(false);
  const [showSignInPrompt, setShowSignInPrompt] = useState(false);

  useEffect(() => {
    if (draftLoaded) {
      return;
    }
    const draft = loadDraft();
    if (draft) {
      setSenderNotifyEmail(draft.senderNotifyEmail);
      setRecipientName(draft.recipientName);
      setBody(draft.body);
    }
    setDraftLoaded(true);
  }, [draftLoaded]);

  useEffect(() => {
    if (!draftLoaded || step !== "compose") {
      return;
    }
    saveDraft({
      senderNotifyEmail,
      recipientName,
      body,
    });
  }, [body, draftLoaded, recipientName, senderNotifyEmail, step]);

  useEffect(() => {
    return () => {
      if (suggestionIntervalRef.current) {
        window.clearInterval(suggestionIntervalRef.current);
      }
      if (suggestionTimeoutRef.current) {
        window.clearTimeout(suggestionTimeoutRef.current);
      }
    };
  }, []);

  const charCount = body.length;
  const bodyTooLong = charCount > 500;
  const isMessageEmpty = body.trim().length === 0;
  const counterClassName =
    charCount >= 480 ? "text-[#B64B39]" : charCount >= 400 ? "text-[#A66B17]" : "text-[#9A9A9A]";
  const normalizedSenderNotifyEmail = senderEmail ?? senderNotifyEmail.trim();
  const effectiveSenderName = (() => {
    const fallbackFromEmail = normalizedSenderNotifyEmail ? formatDisplayNameFromEmail(normalizedSenderNotifyEmail) : "";
    return senderDefaultName.trim() || fallbackFromEmail || "A friend";
  })();
  const trimmedRecipientName = recipientName.trim();
  const gmailComposeUrl = created?.gmailComposeUrl ?? buildGmailComposeUrl(created?.emailSubject ?? `A TinyKind from ${effectiveSenderName}`, created?.emailBody ?? "");
  const shareSentCount = senderSentCount !== null ? senderSentCount + (created ? 1 : 0) : null;
  const shareStreakCount = streakSummary
    ? streakSummary.currentStreak + (created && !streakSummary.sentThisWeek ? 1 : 0)
    : null;
  const sendCountLabel =
    shareSentCount !== null ? `${shareSentCount} sent` : created ? "TinyKind sent" : null;
  const streakLabel =
    shareStreakCount && shareStreakCount > 0 ? `${shareStreakCount}-week streak` : null;
  const loginQuery = useMemo(() => {
    const params = new URLSearchParams({ next: "/" });
    if (senderNotifyEmail.trim()) {
      params.set("email", senderNotifyEmail.trim());
    }
    return params.toString();
  }, [senderNotifyEmail]);

  const emailLoginHref = `/login?${loginQuery}`;

  const copyToClipboard = useCallback(async (label: string, value: string): Promise<void> => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
      window.setTimeout(() => setCopied(""), 1600);
    } catch {
      setCopied("Clipboard blocked");
      window.setTimeout(() => setCopied(""), 1600);
    }
  }, []);

  function startSuggestionPulse(): void {
    setSuggestionPulse(true);
    if (suggestionTimeoutRef.current) {
      window.clearTimeout(suggestionTimeoutRef.current);
    }
    suggestionTimeoutRef.current = window.setTimeout(() => {
      setSuggestionPulse(false);
    }, 520);
  }

  function applySuggestion(suggestion: string): void {
    if (suggestionIntervalRef.current) {
      window.clearInterval(suggestionIntervalRef.current);
      suggestionIntervalRef.current = null;
    }
    setError(null);
    composeTextareaRef.current?.focus();
    startSuggestionPulse();
    setBody((current) => {
      const base = current.trim().length === 0 ? "" : current.trimEnd();
      const full = current.trim().length === 0 ? `${suggestion}: `.slice(0, 500) : `${base} ${suggestion}.`.slice(0, 500);
      const addition = full.slice(base.length);
      if (!addition) {
        return current;
      }
      let index = 0;
      suggestionIntervalRef.current = window.setInterval(() => {
        index = Math.min(index + 2, addition.length);
        setBody(base + addition.slice(0, index));
        if (index >= addition.length && suggestionIntervalRef.current) {
          window.clearInterval(suggestionIntervalRef.current);
          suggestionIntervalRef.current = null;
        }
      }, 18);
      return base;
    });
  }

  function handleComposeShortcut(event: React.KeyboardEvent<HTMLTextAreaElement>): void {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      void createTinyKind();
    }
  }

  const createTinyKind = useCallback(async (options?: { skipSignInPrompt?: boolean }): Promise<void> => {
    if (bodyTooLong) {
      setError("Message exceeds 500 characters.");
      return;
    }
    if (!body.trim()) {
      setError("Write your TinyKind first.");
      return;
    }
    if (!senderEmail && !options?.skipSignInPrompt) {
      setError(null);
      setShowSignInPrompt(true);
      window.setTimeout(() => senderEmailInputRef.current?.focus(), 30);
      return;
    }
    if (!senderEmail && !looksLikeEmail(senderNotifyEmail)) {
      setShowSignInPrompt(false);
      setError("Add your email so we can send reactions back to you.");
      window.setTimeout(() => senderEmailInputRef.current?.focus(), 30);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setShowSignInPrompt(false);
      const response = await fetch("/api/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          senderName: effectiveSenderName,
          senderNotifyEmail: normalizedSenderNotifyEmail,
          recipientName: trimmedRecipientName,
          recipientEmail: null,
          body,
          website,
          deliveryMode: "link",
        }),
      });

      const raw = await response.text();
      const fallbackError = response.ok
        ? "Unable to create TinyKind."
        : "TinyKind is temporarily unavailable. Please try again in a minute.";
      let payload: CreateResponse | { error?: string } | null = null;
      try {
        payload = raw ? (JSON.parse(raw) as CreateResponse | { error?: string }) : null;
      } catch {
        payload = null;
      }

      if (!response.ok) {
        throw new Error(
          payload && "error" in payload && payload.error ? payload.error : parseSendError(raw, fallbackError),
        );
      }

      if (!payload || !("messageUrl" in payload)) {
        throw new Error("Unable to create TinyKind.");
      }

      setCreated(payload as CreateResponse);
      setStep("share");
      clearDraft();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to create TinyKind.");
    } finally {
      setLoading(false);
    }
  }, [
    body,
    bodyTooLong,
    effectiveSenderName,
    normalizedSenderNotifyEmail,
    senderEmail,
    senderNotifyEmail,
    trimmedRecipientName,
    website,
  ]);

  const handleCopyLink = useCallback(async (): Promise<void> => {
    if (!created?.messageUrl) {
      return;
    }
    await copyToClipboard("Link copied", created.messageUrl);
  }, [copyToClipboard, created?.messageUrl]);

  const handleEmailShare = useCallback((): void => {
    if (!created) {
      return;
    }
    window.open(gmailComposeUrl, "_blank", "noopener,noreferrer");
    setCopied("Email draft opened");
    window.setTimeout(() => setCopied(""), 1600);
  }, [created, gmailComposeUrl]);

  const handleMessageShare = useCallback(async (): Promise<void> => {
    if (!created?.sharePreview) {
      return;
    }
    await copyToClipboard("Message copied", created.sharePreview);
    window.location.href = `sms:&body=${encodeURIComponent(created.sharePreview)}`;
  }, [copyToClipboard, created?.sharePreview]);

  const handleWhatsAppShare = useCallback((): void => {
    if (!created?.sharePreview) {
      return;
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(created.sharePreview)}`, "_blank", "noopener,noreferrer");
  }, [created?.sharePreview]);

  const handleSlackShare = useCallback(async (): Promise<void> => {
    if (!created?.sharePreview) {
      return;
    }
    await copyToClipboard("Slack text copied", created.sharePreview);
    window.open("https://app.slack.com/client", "_blank", "noopener,noreferrer");
  }, [copyToClipboard, created?.sharePreview]);

  function handleSendAnother(): void {
    setBody("");
    setRecipientName("");
    setSenderNotifyEmail("");
    setCreated(null);
    setError(null);
    setShowSignInPrompt(false);
    setStep("compose");
    window.setTimeout(() => composeTextareaRef.current?.focus(), 40);
  }

  return (
    <section className="relative">
      <label aria-hidden="true" className="hidden">
        Website
        <input autoComplete="off" onChange={(event) => setWebsite(event.target.value)} tabIndex={-1} value={website} />
      </label>

      {step === "compose" ? (
        <>
          <div className="mb-7 text-center sm:mb-8">
            {isAuthenticated && streakSummary ? (
              <div className="mb-5 flex flex-wrap items-center justify-center gap-2.5 text-center sm:mb-6">
                {streakSummary.currentStreak > 0 ? (
                  <span className="rounded-full border border-[#F2C275] bg-[#FFF7E7] px-3.5 py-1.5 text-[12px] font-medium text-[#B8771E] sm:px-4 sm:text-[13px]">
                    🔥 {streakSummary.currentStreak}-week streak
                  </span>
                ) : null}
                <span className="text-[13px] text-[#8D7C67] sm:text-[14px]">
                  {senderSentCount && senderSentCount > 0
                    ? `You've sent ${senderSentCount} TinyKind${senderSentCount === 1 ? "" : "s"} · keep it going`
                    : streakSummary.sentThisWeek
                      ? "You sent a TinyKind this week ✓"
                      : "Your next TinyKind starts the streak."}
                </span>
              </div>
            ) : null}

            {isAuthenticated ? (
              <>
                <h1 className="text-[34px] font-medium leading-[1.06] tracking-[-0.03em] text-[#1F1F1F] sm:text-[46px]">
                  Hi {greetingName},
                </h1>
                <p className="mt-2.5 text-[18px] leading-[1.24] text-[#3C3B39] sm:text-[20px]">
                  Who would you like to appreciate today?
                </p>
              </>
            ) : (
              <>
                <h1 className="text-[34px] font-medium leading-[1.06] tracking-[-0.03em] text-[#1F1F1F] sm:text-[44px]">
                  Send a TinyKind
                </h1>
                <p className="mt-2.5 text-[18px] leading-[1.24] text-[#3C3B39] sm:text-[20px]">
                  A small note of appreciation, ready to send in a minute.
                </p>
              </>
            )}
          </div>

          <div
            className={[
              "overflow-hidden rounded-[16px] border bg-[#FAFAF9] transition duration-200 ease-out focus-within:border-[#DFC09C] focus-within:shadow-[0_0_0_4px_rgba(223,192,156,0.22)]",
              suggestionPulse ? "border-[#DFC09C] shadow-[0_0_0_4px_rgba(223,192,156,0.18)]" : "border-[#E8C9BD]",
            ].join(" ")}
          >
            <textarea
              className="min-h-[118px] w-full resize-none bg-transparent px-4 py-4 text-[15px] leading-[1.6] placeholder:text-[#9A9A9A] focus:outline-none sm:min-h-[126px] sm:px-5 sm:py-5 sm:text-[16px]"
              maxLength={500}
              onChange={(event) => {
                if (suggestionIntervalRef.current) {
                  window.clearInterval(suggestionIntervalRef.current);
                  suggestionIntervalRef.current = null;
                }
                setBody(event.target.value);
              }}
              onKeyDown={handleComposeShortcut}
              placeholder="I appreciate you because..."
              ref={composeTextareaRef}
              value={body}
            />

            <div className="border-t border-[#EFE2D8] px-4 py-2.5 sm:px-5">
              <label className="flex items-center gap-2 text-[14px] text-[#A18D7A] sm:text-[15px]">
                <span className="font-semibold text-[#A5917D]">For</span>
                <input
                  className="min-w-0 flex-1 border-0 bg-transparent p-0 text-[#7C6A5A] placeholder:text-[#C0B2A5] focus:outline-none"
                  onChange={(event) => setRecipientName(event.target.value)}
                  placeholder="Emily"
                  value={recipientName}
                />
              </label>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#EFE2D8] px-4 py-3 sm:px-5 sm:py-3.5">
              <span className={`text-[13px] transition-colors duration-150 sm:text-sm ${counterClassName}`}>
                {charCount}/500 {bodyTooLong ? "(too long)" : ""}
              </span>
              <button
                className={[
                  "inline-flex min-w-[188px] items-center justify-center gap-2 rounded-full border px-4.5 py-2.5 text-[14px] font-semibold text-white transition duration-150 ease-out focus:outline-none focus-visible:ring-4 focus-visible:ring-[#F2C8BB] sm:min-w-[200px] sm:px-5 sm:text-[15px]",
                  isMessageEmpty || bodyTooLong || loading
                    ? "cursor-not-allowed border-transparent bg-[#E7C8BE] text-white/85"
                    : "border-[#E45A1A] bg-[#E45A1A] hover:border-[#D84F12] hover:bg-[#D84F12] active:scale-[1.01]",
                ].join(" ")}
                disabled={isMessageEmpty || bodyTooLong || loading}
                onClick={() => void createTinyKind()}
                type="button"
              >
                {loading ? (
                  <span className="tk-sendButtonBusy">
                    <span className="tk-sendButtonDots" aria-hidden>
                      <span />
                      <span />
                      <span />
                    </span>
                    Sealing your TinyKind
                  </span>
                ) : (
                  <>
                    Send kindness <span aria-hidden>→</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {showSignInPrompt && !senderEmail ? (
            <div className="mt-4 rounded-[18px] border border-[#E8E2DA] bg-[#FFFCF8] px-4 py-4 text-left sm:px-5">
              <h2 className="text-[18px] font-semibold text-[#2E2E2E] sm:text-[20px]">
                Want to save this TinyKind before you send it?
              </h2>
              <p className="mt-1.5 text-sm leading-[1.5] text-[#6B6B6B] sm:text-[15px]">
                Sign in to save your TinyKinds, track reactions, and keep your streak. Or send it as a guest with your email.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <a className="btn btn-primary inline-block px-4 py-2 text-sm" href={emailLoginHref}>
                  Sign in to save it
                </a>
              </div>
              <div className="mt-4 rounded-[16px] border border-[#EFE2D8] bg-white px-4 py-3">
                <label className="grid gap-1 text-sm font-medium text-[#2E2E2E]">
                  Continue as guest
                  <input
                    className="field mono"
                    onChange={(event) => setSenderNotifyEmail(event.target.value)}
                    placeholder="you@email.com"
                    ref={senderEmailInputRef}
                    type="email"
                    value={senderNotifyEmail}
                  />
                </label>
                <p className="mt-2 text-[13px] leading-[1.5] text-[#7B6F62]">
                  We’ll use this only to send reaction notifications back to you.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    className="btn inline-block px-4 py-2 text-sm"
                    onClick={() => {
                      void createTinyKind({ skipSignInPrompt: true });
                    }}
                    type="button"
                  >
                    Send as guest
                  </button>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  className="text-sm font-medium text-[#7B6F62] underline underline-offset-4"
                  onClick={() => {
                    setShowSignInPrompt(false);
                    setError(null);
                  }}
                  type="button"
                >
                  Back to editing
                </button>
              </div>
            </div>
          ) : null}

          <SuggestionRow onSelect={applySuggestion} suggestions={promptSuggestions} />

          {error ? <div className="mt-3 text-sm text-[#A22D2D]">{error}</div> : null}
        </>
      ) : created ? (
        <section className="tk-shareStage mx-auto max-w-[720px] px-4 pb-10 pt-6 text-center sm:px-0 sm:pt-8">
          <ConfettiField />

          <div className="relative z-[1]">
            <SealedEnvelope />
            <h2 className="mt-7 text-[34px] font-medium leading-[1.05] tracking-[-0.03em] text-[#1F1F1F] sm:text-[42px]">
              Sealed with kindness 💛
            </h2>
            <p className="mt-3 text-[20px] leading-[1.35] text-[#6B5F53] sm:text-[22px]">
              Ready to share. Send it however feels right.
            </p>

            <div className="mx-auto mt-8 flex w-full max-w-[530px] items-center gap-3 rounded-[24px] border border-[#E7DDD3] bg-[#FFFEFC] px-4 py-4 text-left">
              <span className="flex h-12 w-12 flex-none items-center justify-center rounded-[16px] bg-[#FBF2EA] text-[#7D7368]">
                <ShareIcon kind="copy" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[18px] font-semibold text-[#222222] sm:text-[20px]">
                  {created.messageUrl.replace(/^https?:\/\//, "")}
                </div>
                <div className="mt-1 text-[14px] text-[#8A7E71] sm:text-[15px]">Paste into any message, anywhere</div>
              </div>
              <button
                className="inline-flex flex-none items-center justify-center rounded-full bg-[#E45A1A] px-5 py-3 text-[16px] font-semibold text-white transition duration-150 ease-out hover:bg-[#D84F12]"
                onClick={() => void handleCopyLink()}
                type="button"
              >
                Copy
              </button>
            </div>

            <div className="mx-auto mt-6 flex max-w-[420px] flex-wrap items-start justify-center gap-4 sm:gap-5">
              <ShareButton icon={<ShareIcon kind="message" />} label="iMessage" onClick={() => void handleMessageShare()} />
              <ShareButton icon={<ShareIcon kind="whatsapp" />} label="WhatsApp" onClick={handleWhatsAppShare} />
              <ShareButton icon={<ShareIcon kind="email" />} label="Email" onClick={handleEmailShare} />
              <ShareButton icon={<ShareIcon kind="slack" />} label="Slack" onClick={() => void handleSlackShare()} />
            </div>

            {(sendCountLabel || streakLabel) ? (
              <div className="mt-8 flex flex-wrap items-center justify-center gap-2 text-[15px] text-[#A08E7D] sm:text-[16px]">
                {sendCountLabel ? <span>🎉 {sendCountLabel}</span> : null}
                {sendCountLabel && streakLabel ? <span aria-hidden>·</span> : null}
                {streakLabel ? <span>🔥 {streakLabel}</span> : null}
              </div>
            ) : null}

            <button
              className="mt-2 inline-flex items-center gap-2 text-[18px] font-semibold text-[#E45A1A] transition duration-150 ease-out hover:text-[#D84F12]"
              onClick={handleSendAnother}
              type="button"
            >
              Send another <span aria-hidden>→</span>
            </button>

            {error ? <div className="mt-4 text-sm text-[#A22D2D]">{error}</div> : null}
          </div>
        </section>
      ) : null}

      {copied ? (
        <div className="fixed bottom-5 right-5 z-20 rounded-full border border-[#E8E6E3] bg-[#FFFFFF] px-4 py-2 text-xs text-[#6B6B6B] shadow-sm">
          {copied}
        </div>
      ) : null}
    </section>
  );
}
