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
  googleEnabled: boolean;
  greetingName: string;
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
    className: "h-7 w-7",
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
        <path d="M6.6 18.2 4.5 20l.7-3A6.9 6.9 0 1 1 18.5 14" />
        <path d="M8.8 10.5h6.4" />
        <path d="M8.8 13.4h4.3" />
      </svg>
    );
  }
  if (kind === "whatsapp") {
    return (
      <svg {...common}>
        <path d="M12 20a7.9 7.9 0 0 1-4-.9L4.5 20l1-3.4a7.9 7.9 0 1 1 6.5 3.4Z" />
        <path d="M9.7 8.9c.2-.4.4-.4.6-.4h.5c.2 0 .5 0 .7.5.2.5.7 1.8.8 2 .1.2.1.4 0 .6-.1.2-.2.3-.4.5l-.4.4c-.1.1-.3.2-.1.5.2.4.9 1.5 2 2.1 1.4.8 2.5 1 2.9 1.1.3.1.5 0 .7-.2l.8-.9c.2-.2.4-.3.7-.2.3.1 1.8.8 2.1 1 .3.2.4.3.4.5 0 .2-.1 1-.6 1.6-.5.6-1.1.8-1.8.9-.6.1-1.5 0-3-.6-1.5-.6-2.8-1.5-4-2.7-1.1-1.1-2-2.4-2.6-3.8-.6-1.4-.6-2.4-.5-3 0-.6.3-1.1.6-1.5Z" />
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
      <path d="M8.5 16.5 6 18.5l1-3A6 6 0 1 1 18.5 9" />
      <path d="M10 8.9h4" />
      <path d="M9 12.1h6" />
      <path d="M8.8 15.3h3.6" />
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
    ["left-[5%] top-[73%]", "#D9ECDC", "6s", "0.2s"],
    ["left-[16%] top-[84%]", "#F5D5B2", "7.1s", "1.4s"],
    ["left-[28%] top-[63%]", "#F2B6A0", "5.8s", "0.7s"],
    ["left-[34%] top-[77%]", "#CFC7FF", "6.5s", "2.2s"],
    ["left-[41%] top-[71%]", "#F6D89E", "7.4s", "0.9s"],
    ["left-[49%] top-[82%]", "#BEE5E7", "5.9s", "1.8s"],
    ["left-[58%] top-[67%]", "#F9CDBA", "6.8s", "0.4s"],
    ["left-[69%] top-[75%]", "#DAD1F7", "7.5s", "1.1s"],
    ["left-[84%] top-[88%]", "#D9ECDC", "6.2s", "0.6s"],
    ["left-[92%] top-[66%]", "#F5D5B2", "7.2s", "1.6s"],
  ] as const;

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {pieces.map(([position, color, duration, delay], index) => (
        <span
          className={`tk-confettiPiece ${position}`}
          key={`${position}-${index}`}
          style={{ backgroundColor: color, animationDuration: duration, animationDelay: delay }}
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
  googleEnabled,
  greetingName,
  promptSuggestions,
  senderSentCount,
  streakSummary,
}: CreateTinyKindCardProps) {
  const composeTextareaRef = useRef<HTMLTextAreaElement | null>(null);
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

  const googleStartHref = "/api/auth/google/start?next=%2F";
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

  const createTinyKind = useCallback(async (): Promise<void> => {
    if (bodyTooLong) {
      setError("Message exceeds 500 characters.");
      return;
    }
    if (!body.trim()) {
      setError("Write your TinyKind first.");
      return;
    }
    if (!senderEmail && !looksLikeEmail(senderNotifyEmail)) {
      setError("Sign in, or add your email so we can send reactions back to you.");
      return;
    }

    try {
      setLoading(true);
      setError(null);
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
    setCreated(null);
    setError(null);
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
          <div className="mb-8 text-center sm:mb-9">
            {streakSummary ? (
              <div className="mb-6 flex flex-wrap items-center justify-center gap-3 text-center sm:mb-7">
                {streakSummary.currentStreak > 0 ? (
                  <span className="rounded-full border border-[#F2C275] bg-[#FFF7E7] px-4 py-1.5 text-[13px] font-medium text-[#B8771E] sm:text-[14px]">
                    🔥 {streakSummary.currentStreak}-week streak
                  </span>
                ) : null}
                <span className="text-[14px] text-[#8D7C67] sm:text-[15px]">
                  {senderSentCount && senderSentCount > 0
                    ? `You've sent ${senderSentCount} TinyKind${senderSentCount === 1 ? "" : "s"} · keep it going`
                    : streakSummary.sentThisWeek
                      ? "You sent a TinyKind this week ✓"
                      : "Your next TinyKind starts the streak."}
                </span>
              </div>
            ) : null}

            <h1 className="text-[38px] font-medium leading-[1.08] tracking-[-0.03em] text-[#1F1F1F] sm:text-[56px]">
              Hi {greetingName},
            </h1>
            <p className="mt-3 text-[22px] leading-[1.22] text-[#3C3B39] sm:text-[24px]">
              Who would you like to appreciate today?
            </p>
          </div>

          {!senderEmail ? (
            <div className="mb-4 rounded-[18px] border border-[#E8E2DA] bg-[#FFFCF8] px-4 py-4 text-sm text-[#6B6B6B]">
              <p className="text-[#2E2E2E]">Sign in, or add your email, so we can notify you when your TinyKind lands.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {googleEnabled ? (
                  <a className="btn btn-primary inline-block px-4 py-2 text-sm" href={googleStartHref}>
                    Continue with Google
                  </a>
                ) : null}
                <a className="btn inline-block px-4 py-2 text-sm" href={emailLoginHref}>
                  Email sign-in link
                </a>
              </div>
            </div>
          ) : null}

          <div
            className={[
              "overflow-hidden rounded-[18px] border bg-[#FAFAF9] transition duration-200 ease-out focus-within:border-[#DFC09C] focus-within:shadow-[0_0_0_4px_rgba(223,192,156,0.22)]",
              suggestionPulse ? "border-[#DFC09C] shadow-[0_0_0_4px_rgba(223,192,156,0.18)]" : "border-[#E8C9BD]",
            ].join(" ")}
          >
            <textarea
              className="min-h-[132px] w-full resize-none bg-transparent px-5 py-5 text-[16px] leading-[1.6] placeholder:text-[#9A9A9A] focus:outline-none sm:min-h-[144px] sm:px-6 sm:py-6 sm:text-[17px]"
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

            <div className="border-t border-[#EFE2D8] px-5 py-3 sm:px-6">
              <label className="flex items-center gap-2 text-[15px] text-[#A18D7A] sm:text-[16px]">
                <span className="font-semibold text-[#A5917D]">For</span>
                <input
                  className="min-w-0 flex-1 border-0 bg-transparent p-0 text-[#7C6A5A] placeholder:text-[#C0B2A5] focus:outline-none"
                  onChange={(event) => setRecipientName(event.target.value)}
                  placeholder="Joey, Sarah... (optional)"
                  value={recipientName}
                />
              </label>
            </div>

            {!senderEmail ? (
              <div className="border-t border-[#EFE2D8] px-5 py-3 sm:px-6">
                <label className="flex items-center gap-3 text-[15px] text-[#A18D7A] sm:text-[16px]">
                  <span className="font-semibold text-[#A5917D]">Your email</span>
                  <input
                    className="min-w-0 flex-1 border-0 bg-transparent p-0 text-[#7C6A5A] placeholder:text-[#C0B2A5] focus:outline-none"
                    onChange={(event) => setSenderNotifyEmail(event.target.value)}
                    placeholder="you@email.com"
                    type="email"
                    value={senderNotifyEmail}
                  />
                </label>
              </div>
            ) : null}

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#EFE2D8] px-5 py-3.5 sm:px-6 sm:py-4">
              <span className={`text-sm transition-colors duration-150 ${counterClassName}`}>
                {charCount}/500 {bodyTooLong ? "(too long)" : ""}
              </span>
              <button
                className={[
                  "inline-flex min-w-[216px] items-center justify-center gap-2 rounded-full border px-5 py-2.5 text-[15px] font-semibold text-white transition duration-150 ease-out focus:outline-none focus-visible:ring-4 focus-visible:ring-[#F2C8BB] sm:px-6 sm:text-base",
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
