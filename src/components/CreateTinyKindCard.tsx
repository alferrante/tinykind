"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import SuggestionRow from "@/components/SuggestionRow";
import type { DeliveryMode } from "@/lib/types";

interface CreatedMessage {
  id: string;
  shortLinkSlug: string;
}

interface CreateResponse {
  message: CreatedMessage;
  messageUrl: string;
  deliveryMode: DeliveryMode;
  recipientEmail: string | null;
  gmailComposeUrl: string | null;
  emailBody: string;
  sharePreview: string;
}

type ComposerStep = "compose" | "details";

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
  step: ComposerStep;
  senderName: string;
  senderNotifyEmail: string;
  recipientName: string;
  recipientEmail: string;
  body: string;
  sendByEmail: boolean;
}

const DRAFT_STORAGE_KEY = "tinykind-compose-draft-v4";

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
      step: parsed.step === "details" ? "details" : "compose",
      senderName: typeof parsed.senderName === "string" ? parsed.senderName : "",
      senderNotifyEmail: typeof parsed.senderNotifyEmail === "string" ? parsed.senderNotifyEmail : "",
      recipientName: typeof parsed.recipientName === "string" ? parsed.recipientName : "",
      recipientEmail: typeof parsed.recipientEmail === "string" ? parsed.recipientEmail : "",
      body: typeof parsed.body === "string" ? parsed.body : "",
      sendByEmail: typeof parsed.sendByEmail === "boolean" ? parsed.sendByEmail : false,
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

function ShareMethodIcon({ mode }: { mode: DeliveryMode }) {
  const commonProps = {
    "aria-hidden": true,
    className: "h-5 w-5 flex-none text-[#7B756D]",
    fill: "none",
    stroke: "currentColor",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    strokeWidth: 1.8,
    viewBox: "0 0 24 24",
  };

  if (mode === "email") {
    return (
      <svg {...commonProps}>
        <rect height="13" rx="2.4" width="18" x="3" y="5.5" />
        <path d="m4.9 7.9 6.3 4.9a1.4 1.4 0 0 0 1.7 0l6.2-4.9" />
      </svg>
    );
  }

  return (
    <svg {...commonProps}>
      <path d="M10 14 19 5" />
      <path d="M12.5 5H19v6.5" />
      <path d="M10 5H7.8A2.8 2.8 0 0 0 5 7.8v8.4A2.8 2.8 0 0 0 7.8 19h8.4a2.8 2.8 0 0 0 2.8-2.8V14" />
    </svg>
  );
}

function DeliveryOptionCard({
  action,
  description,
  icon,
  selected,
  title,
}: {
  action: ReactNode;
  description: string;
  icon: ReactNode;
  selected?: boolean;
  title: string;
}) {
  return (
    <div
      className={[
        "relative flex min-h-[184px] w-full flex-col items-start gap-4 rounded-[24px] border px-5 py-5 text-left",
        selected
          ? "border-[#E48A6F] bg-[#FFF5F0]"
          : "border-[#DED8D1] bg-[#FFFFFF]",
      ].join(" ")}
    >
      <span className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[#E8E1D8] bg-[#FFFCF8]">
        {icon}
      </span>
      <div>
        <div className="text-[15px] font-semibold text-[#2E2E2E] sm:text-[17px]">{title}</div>
        <div className="mt-1 max-w-[28ch] text-sm leading-[1.45] text-[#77716B] sm:text-[15px]">{description}</div>
      </div>
      {selected ? (
        <span className="absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-full bg-[#E48A6F] text-[18px] text-white">
          ✓
        </span>
      ) : null}
      <div className="mt-auto w-full">{action}</div>
    </div>
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
  const formRef = useRef<HTMLFormElement | null>(null);
  const composeTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const suggestionIntervalRef = useRef<number | null>(null);
  const suggestionTimeoutRef = useRef<number | null>(null);
  const [step, setStep] = useState<ComposerStep>("compose");
  const [senderName, setSenderName] = useState(senderDefaultName);
  const [senderNotifyEmail, setSenderNotifyEmail] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [body, setBody] = useState("");
  const [sendByEmail, setSendByEmail] = useState(false);
  const [website, setWebsite] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingMode, setLoadingMode] = useState<DeliveryMode | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<CreateResponse | null>(null);
  const [preparedSignature, setPreparedSignature] = useState<string | null>(null);
  const [copied, setCopied] = useState<string>("");
  const [draftLoaded, setDraftLoaded] = useState(false);
  const [suggestionPulse, setSuggestionPulse] = useState(false);
  const autoPreparedLinkSignatureRef = useRef<string | null>(null);

  useEffect(() => {
    if (draftLoaded) {
      return;
    }
    const draft = loadDraft();
    if (!draft) {
      setDraftLoaded(true);
      return;
    }
    setStep(draft.step);
    setSenderName(draft.senderName || senderDefaultName);
    setSenderNotifyEmail(draft.senderNotifyEmail);
    setRecipientName(draft.recipientName);
    setRecipientEmail(draft.recipientEmail);
    setBody(draft.body);
    setSendByEmail(draft.sendByEmail || Boolean(draft.recipientEmail));
    setDraftLoaded(true);
  }, [draftLoaded, senderDefaultName]);

  useEffect(() => {
    if (senderDefaultName && senderEmail && !senderName.trim()) {
      setSenderName(senderDefaultName);
    }
  }, [senderDefaultName, senderEmail, senderName]);

  useEffect(() => {
    if (!draftLoaded) {
      return;
    }
    saveDraft({
      step,
      senderName,
      senderNotifyEmail,
      recipientName,
      recipientEmail,
      body,
      sendByEmail,
    });
  }, [draftLoaded, step, senderName, senderNotifyEmail, recipientName, recipientEmail, body, sendByEmail]);

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
    return senderDefaultName.trim() || senderName.trim() || fallbackFromEmail;
  })();
  const trimmedRecipientName = recipientName.trim();
  const trimmedRecipientEmail = recipientEmail.trim();
  const canNotifySender = Boolean(senderEmail || looksLikeEmail(senderNotifyEmail));
  const linkSignature = JSON.stringify({
    mode: "link",
    senderName: effectiveSenderName,
    senderNotifyEmail: normalizedSenderNotifyEmail,
    recipientName: trimmedRecipientName,
    body,
  });
  const emailSignature = JSON.stringify({
    mode: "email",
    senderName: effectiveSenderName,
    senderNotifyEmail: normalizedSenderNotifyEmail,
    recipientName: trimmedRecipientName,
    recipientEmail: trimmedRecipientEmail,
    body,
  });
  const linkReady = created?.deliveryMode === "link" && preparedSignature === linkSignature;
  const emailReady = created?.deliveryMode === "email" && preparedSignature === emailSignature;

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
      setTimeout(() => setCopied(""), 1500);
    } catch {
      setCopied("Clipboard blocked");
      setTimeout(() => setCopied(""), 1500);
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

  function goToDetails(): void {
    if (!body.trim()) {
      setError("Add your message first.");
      return;
    }
    if (bodyTooLong) {
      setError("Message exceeds 500 characters.");
      return;
    }
    setError(null);
    setStep("details");
  }

  function handleComposeShortcut(event: React.KeyboardEvent<HTMLTextAreaElement>): void {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      goToDetails();
    }
  }

  function handleDetailsShortcut(event: React.KeyboardEvent<HTMLFormElement>): void {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      void createTinyKind(trimmedRecipientEmail ? "email" : "link");
    }
  }

  const openGmailDraft = useCallback((): void => {
    if (!created?.gmailComposeUrl) {
      return;
    }
    window.open(created.gmailComposeUrl, "_blank", "noopener,noreferrer");
  }, [created]);

  const createTinyKind = useCallback(async (
    mode: DeliveryMode,
    options?: {
      auto?: boolean;
      copyOnSuccess?: boolean;
    },
  ): Promise<void> => {
    const signature = mode === "email" ? emailSignature : linkSignature;
    if (mode === "link" && linkReady && created?.messageUrl) {
      await copyToClipboard("Link copied", created.messageUrl);
      return;
    }
    if (mode === "email" && emailReady && created?.gmailComposeUrl) {
      openGmailDraft();
      return;
    }
    if (bodyTooLong) {
      setError("Message exceeds 500 characters.");
      return;
    }
    if (!body.trim()) {
      setError("Message is required.");
      return;
    }
    if (!trimmedRecipientName) {
      setError("Add who this TinyKind is for.");
      return;
    }
    if (mode === "email" && !looksLikeEmail(trimmedRecipientEmail)) {
      setError("Add a valid recipient email.");
      return;
    }
    if (!effectiveSenderName) {
      setError("Add your email, or sign in.");
      return;
    }
    if (!senderEmail && !looksLikeEmail(senderNotifyEmail)) {
      setError("Add your email to receive reaction notifications.");
      return;
    }

    try {
      setLoading(true);
      setLoadingMode(mode);
      setError(null);
      if (suggestionIntervalRef.current) {
        window.clearInterval(suggestionIntervalRef.current);
        suggestionIntervalRef.current = null;
      }

      const response = await fetch("/api/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          senderName: effectiveSenderName,
          senderNotifyEmail: normalizedSenderNotifyEmail,
          recipientName: trimmedRecipientName,
          recipientEmail: mode === "email" ? trimmedRecipientEmail : null,
          body,
          website,
          deliveryMode: mode,
        }),
      });

      const payload = (await response.json()) as CreateResponse | { error?: string };
      if (!response.ok) {
        throw new Error("error" in payload ? payload.error : "Failed to create message.");
      }

      const createdPayload = payload as CreateResponse;
      setCreated(createdPayload);
      setPreparedSignature(signature);
      clearDraft();
      if (mode === "email" && createdPayload.gmailComposeUrl) {
        window.open(createdPayload.gmailComposeUrl, "_blank", "noopener,noreferrer");
      } else if (mode === "link" && options?.copyOnSuccess !== false) {
        await copyToClipboard("Link copied", createdPayload.messageUrl);
      }
    } catch (submitError) {
      if (options?.auto) {
        autoPreparedLinkSignatureRef.current = null;
      }
      setError(submitError instanceof Error ? submitError.message : "Failed to create message.");
    } finally {
      setLoading(false);
      setLoadingMode(null);
    }
  }, [
    body,
    bodyTooLong,
    copyToClipboard,
    created,
    effectiveSenderName,
    emailReady,
    emailSignature,
    linkReady,
    linkSignature,
    normalizedSenderNotifyEmail,
    openGmailDraft,
    senderEmail,
    senderNotifyEmail,
    trimmedRecipientEmail,
    trimmedRecipientName,
    website,
  ]);

  useEffect(() => {
    if (step !== "details") {
      return;
    }
    if (!trimmedRecipientName || !effectiveSenderName || !canNotifySender || bodyTooLong || loading || linkReady) {
      return;
    }
    if (autoPreparedLinkSignatureRef.current === linkSignature) {
      return;
    }
    const timeout = window.setTimeout(() => {
      autoPreparedLinkSignatureRef.current = linkSignature;
      void createTinyKind("link", { auto: true, copyOnSuccess: false });
    }, 320);
    return () => window.clearTimeout(timeout);
  }, [bodyTooLong, canNotifySender, createTinyKind, effectiveSenderName, linkReady, linkSignature, loading, step, trimmedRecipientName]);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    await createTinyKind(sendByEmail ? "email" : "link");
  }

  return (
    <section>
      <form className="grid gap-4" onKeyDown={step === "details" ? handleDetailsShortcut : undefined} onSubmit={onSubmit} ref={formRef}>
        <label aria-hidden="true" className="hidden">
          Website
          <input
            autoComplete="off"
            onChange={(event) => setWebsite(event.target.value)}
            tabIndex={-1}
            value={website}
          />
        </label>

        {step === "compose" ? (
          <>
            <div className="mb-10 text-center sm:mb-12">
              {streakSummary ? (
                <div className="mb-8 flex flex-wrap items-center justify-center gap-4 text-center sm:mb-10">
                  {streakSummary.currentStreak > 0 ? (
                    <span className="rounded-full border border-[#F2C275] bg-[#FFF7E7] px-5 py-2 text-[14px] font-medium text-[#B8771E]">
                      🔥 {streakSummary.currentStreak}-week streak
                    </span>
                  ) : null}
                  <span className="text-[15px] text-[#8D7C67] sm:text-[16px]">
                    {senderSentCount && senderSentCount > 0
                      ? `You've sent ${senderSentCount} TinyKind${senderSentCount === 1 ? "" : "s"} · keep it going`
                      : streakSummary.sentThisWeek
                        ? "You sent a TinyKind this week ✓"
                        : "Your next TinyKind starts the streak."}
                  </span>
                </div>
              ) : null}

              <h1 className="text-[40px] font-medium leading-[1.1] tracking-[-0.03em] text-[#1F1F1F] sm:text-[68px]">
                Hi {greetingName},
              </h1>
              <p className="mt-4 text-[24px] leading-[1.25] text-[#3C3B39] sm:text-[28px]">
                Who would you like to appreciate today?
              </p>
            </div>

            <div
              className={[
                "overflow-hidden rounded-[20px] border bg-[#FAFAF9] transition duration-200 ease-out focus-within:border-[#DFC09C] focus-within:shadow-[0_0_0_4px_rgba(223,192,156,0.22)]",
                suggestionPulse ? "border-[#DFC09C] shadow-[0_0_0_4px_rgba(223,192,156,0.18)]" : "border-[#E8E6E3]",
              ].join(" ")}
            >
              <textarea
                className="min-h-[156px] w-full resize-none bg-transparent px-6 py-6 text-[17px] leading-[1.6] placeholder:text-[#9A9A9A] focus:outline-none"
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

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#EFEDEB] px-6 py-4">
                <span className={`text-sm transition-colors duration-150 ${counterClassName}`}>
                  {charCount}/500 {bodyTooLong ? "(too long)" : ""}
                </span>
                <button
                  className={[
                    "rounded-full border px-6 py-2.5 text-base font-semibold text-white transition duration-150 ease-out focus:outline-none focus-visible:ring-4 focus-visible:ring-[#C8D5D8]",
                    isMessageEmpty || bodyTooLong
                      ? "cursor-not-allowed border-transparent bg-[#C9D3D6] text-white/80"
                      : "border-[#E48767] bg-[#E48767] hover:border-[#DD7C5F] hover:bg-[#DD7C5F] active:scale-[1.01]",
                  ].join(" ")}
                  disabled={isMessageEmpty || bodyTooLong}
                  onClick={goToDetails}
                  type="button"
                >
                  Send kindness <span aria-hidden>→</span>
                </button>
              </div>
            </div>

            <SuggestionRow onSelect={applySuggestion} suggestions={promptSuggestions} />
          </>
        ) : (
          <section className="mx-auto max-w-[760px] pt-4">
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3 sm:mb-8">
              <button
                className="inline-flex items-center gap-2 rounded-full border border-[#E8E6E3] bg-[#FFFFFF] px-4 py-2 text-sm font-medium text-[#4B4B4B] transition duration-150 ease-out hover:bg-[#F7F2EB] hover:text-[#2E2E2E]"
                onClick={() => setStep("compose")}
                type="button"
              >
                <span aria-hidden>←</span>
                Back to message
              </button>
              <div className="inline-flex items-center gap-2 rounded-full border border-[#F2C275] bg-[#FFF7E7] px-4 py-2 text-sm font-medium text-[#B8771E]">
                <span aria-hidden>✦</span>
                Your TinyKind is ready
              </div>
            </div>

            <section className="panel overflow-hidden bg-[#FCFBF9] p-0">
              <div className="border-b border-[#EAE6E0] px-5 py-5 sm:px-7 sm:py-6">
                <div className="mb-4">
                  <h2 className="text-[28px] font-medium leading-[1.08] tracking-[-0.03em] text-[#1F1F1F] sm:text-[42px]">
                    Share it
                  </h2>
                </div>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex min-w-0 items-start gap-4">
                    <span aria-hidden className="mt-1 text-[28px] leading-none text-[#8A837B] sm:text-[32px]">
                      💬
                    </span>
                    <p className="min-w-0 whitespace-pre-wrap text-[18px] font-normal italic leading-[1.5] tracking-[-0.02em] text-[#4A4A4A] sm:text-[20px]">
                      {body}
                    </p>
                  </div>
                  <button
                    className="shrink-0 rounded-full px-3 py-1.5 text-sm font-medium text-[#9A9A9A] transition duration-150 ease-out hover:bg-[#F5F0E8] hover:text-[#4B4B4B]"
                    onClick={() => setStep("compose")}
                    type="button"
                  >
                    Edit
                  </button>
                </div>
              </div>

              <div className="grid gap-6 px-5 py-5 sm:px-7 sm:py-6">
                {!senderEmail ? (
                  <div className="rounded-[18px] border border-[#E8E2DA] bg-[#FFFCF8] p-4 text-sm text-[#6B6B6B]">
                    <p className="text-[#2E2E2E]">Add your email so we can notify you when your TinyKind lands.</p>
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

                {!senderEmail ? (
                  <label className="grid gap-1.5 text-sm font-medium text-[#2E2E2E]">
                    Your email
                    <input
                      className="field mono"
                      onChange={(event) => setSenderNotifyEmail(event.target.value)}
                      placeholder="you@email.com"
                      type="email"
                      value={senderNotifyEmail}
                    />
                    <span className="text-xs font-normal text-[#6B6B6B]">Open + reaction notifications go here.</span>
                  </label>
                ) : null}

                <label className="grid gap-1.5 text-sm font-medium text-[#2E2E2E]">
                  To
                  <input
                    className="field text-[16px]"
                    onChange={(event) => setRecipientName(event.target.value)}
                    placeholder="Moe"
                    value={recipientName}
                  />
                </label>

                <div className="grid gap-3 sm:grid-cols-2">
                  <DeliveryOptionCard
                    action={
                      <button
                        className="inline-flex w-full items-center justify-between gap-3 rounded-full border border-[#DDD7CF] bg-[#FFFFFF] px-4 py-3 text-sm font-medium text-[#3D3B37] transition duration-150 ease-out hover:border-[#CFC7BD] hover:bg-[#F7F3EE] disabled:cursor-not-allowed disabled:opacity-60"
                        disabled={
                          bodyTooLong ||
                          !trimmedRecipientName ||
                          !canNotifySender ||
                          (loading && loadingMode !== "link")
                        }
                        onClick={() => void createTinyKind("link")}
                        type="button"
                      >
                        <span className="truncate">
                          {!trimmedRecipientName
                            ? "Add recipient name"
                            : loadingMode === "link"
                            ? "Preparing link..."
                            : linkReady && created?.messageUrl
                              ? created.messageUrl.replace(/^https?:\/\//, "")
                              : "Preparing link..."}
                        </span>
                        <span aria-hidden className="text-[15px] text-[#7A746D]">
                          ⧉
                        </span>
                      </button>
                    }
                    description="Copy the TinyKind link and send it however you want."
                    icon={<ShareMethodIcon mode="link" />}
                    selected={linkReady}
                    title="Copy link"
                  />
                  <DeliveryOptionCard
                    action={
                      <div className="grid gap-3">
                        <input
                          className="field mono"
                          onChange={(event) => {
                            setRecipientEmail(event.target.value);
                            setSendByEmail(true);
                          }}
                          placeholder="recipient@email.com"
                          type="email"
                          value={recipientEmail}
                        />
                        <button
                          className="tk-hoverPulse inline-flex w-full items-center justify-center gap-2 rounded-full border border-[#E48767] bg-[#E48767] px-4 py-3 text-sm font-medium text-white transition duration-150 ease-out hover:bg-[#DD7C5F] focus:outline-none focus-visible:ring-4 focus-visible:ring-[#F2C8BB] disabled:cursor-not-allowed disabled:opacity-60"
                          disabled={loading || bodyTooLong || !trimmedRecipientName || !looksLikeEmail(trimmedRecipientEmail) || !canNotifySender}
                          onClick={() => void createTinyKind("email")}
                          type="button"
                        >
                          {loadingMode === "email" ? "Opening draft..." : emailReady ? "Re-open Gmail draft" : "Open Gmail draft"}
                        </button>
                      </div>
                    }
                    description="Open a ready-made Gmail draft addressed to them."
                    icon={<ShareMethodIcon mode="email" />}
                    selected={emailReady}
                    title="Send by email"
                  />
                </div>

                {error ? <div className="text-sm text-[#A22D2D]">{error}</div> : null}
              </div>
            </section>
          </section>
        )}
      </form>

      {error && step === "compose" ? <div className="mt-3 text-sm text-[#A22D2D]">{error}</div> : null}

      {copied ? (
        <div className="fixed bottom-5 right-5 z-20 rounded-full border border-[#E8E6E3] bg-[#FFFFFF] px-4 py-2 text-xs text-[#6B6B6B] shadow-sm">
          {copied}
        </div>
      ) : null}
    </section>
  );
}
