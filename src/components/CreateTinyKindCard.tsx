"use client";

import { useEffect, useMemo, useState } from "react";
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
const SUGGESTIONS = [
  "A teammate who helped this week",
  "Someone who showed up for you",
  "A friend who made you laugh",
] as const;

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

export default function CreateTinyKindCard({
  senderDefaultName = "",
  senderEmail,
  googleEnabled,
}: CreateTinyKindCardProps) {
  const [step, setStep] = useState<ComposerStep>("compose");
  const [senderName, setSenderName] = useState(senderDefaultName);
  const [senderNotifyEmail, setSenderNotifyEmail] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [body, setBody] = useState("");
  const [sendByEmail, setSendByEmail] = useState(false);
  const [website, setWebsite] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<CreateResponse | null>(null);
  const [copied, setCopied] = useState<string>("");
  const [draftLoaded, setDraftLoaded] = useState(false);

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

  const charCount = body.length;
  const bodyTooLong = charCount > 500;
  const deliveryMode: DeliveryMode = sendByEmail ? "email" : "link";
  const isMessageEmpty = body.trim().length === 0;

  const loginQuery = useMemo(() => {
    const params = new URLSearchParams({ next: "/" });
    if (senderNotifyEmail.trim()) {
      params.set("email", senderNotifyEmail.trim());
    }
    return params.toString();
  }, [senderNotifyEmail]);

  const googleStartHref = "/api/auth/google/start?next=%2F";
  const emailLoginHref = `/login?${loginQuery}`;

  async function copyToClipboard(label: string, value: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
      setTimeout(() => setCopied(""), 1500);
    } catch {
      setCopied("Clipboard blocked");
      setTimeout(() => setCopied(""), 1500);
    }
  }

  function applySuggestion(suggestion: string): void {
    setBody((current) => {
      if (current.trim().length === 0) {
        return `${suggestion}: `.slice(0, 500);
      }
      const next = `${current.trimEnd()} ${suggestion}.`;
      return next.slice(0, 500);
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

  async function onSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (bodyTooLong) {
      setError("Message exceeds 500 characters.");
      return;
    }
    if (!body.trim()) {
      setError("Message is required.");
      return;
    }
    if (!sendByEmail && !recipientName.trim()) {
      setError("Add who this TinyKind is for.");
      return;
    }
    if (sendByEmail && !looksLikeEmail(recipientEmail)) {
      setError("Add a valid recipient email.");
      return;
    }

    const effectiveSenderName = senderEmail ? senderDefaultName.trim() || senderName.trim() : senderName.trim();
    if (!effectiveSenderName) {
      setError("Add your name, or sign in.");
      return;
    }
    if (!senderEmail && !looksLikeEmail(senderNotifyEmail)) {
      setError("Add your email to receive reaction notifications.");
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setCreated(null);

      const response = await fetch("/api/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          senderName: effectiveSenderName,
          senderNotifyEmail: senderEmail ?? senderNotifyEmail.trim(),
          recipientName: sendByEmail ? "" : recipientName.trim(),
          recipientEmail: sendByEmail ? recipientEmail.trim() : null,
          body,
          website,
          deliveryMode,
        }),
      });

      const payload = (await response.json()) as CreateResponse | { error?: string };
      if (!response.ok) {
        throw new Error("error" in payload ? payload.error : "Failed to create message.");
      }

      setCreated(payload as CreateResponse);
      clearDraft();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Failed to create message.");
    } finally {
      setLoading(false);
    }
  }

  function openGmailDraft(): void {
    if (!created?.gmailComposeUrl) {
      return;
    }
    window.open(created.gmailComposeUrl, "_blank", "noopener,noreferrer");
  }

  return (
    <section>
      <form className="grid gap-4" onSubmit={onSubmit}>
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
            <div className="overflow-hidden rounded-[20px] border border-[#E8E6E3] bg-[#FAFAF9] transition duration-150 ease-out focus-within:border-[#B7C4C7] focus-within:shadow-[0_0_0_3px_rgba(183,196,199,0.22)]">
              <textarea
                className="min-h-[156px] w-full resize-none bg-transparent px-6 py-6 text-[17px] leading-[1.6] placeholder:text-[#9A9A9A] focus:outline-none"
                maxLength={500}
                onChange={(event) => setBody(event.target.value)}
                placeholder="I appreciate you because..."
                value={body}
              />

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#EFEDEB] px-6 py-4">
                <span className="text-sm text-[#9A9A9A]">
                  {charCount}/500 {bodyTooLong ? "(too long)" : ""}
                </span>
                <button
                  className={[
                    "rounded-full border px-6 py-2.5 text-base font-semibold text-white shadow-[0_10px_24px_rgba(87,116,122,0.18)] transition duration-150 ease-out focus:outline-none focus-visible:ring-4 focus-visible:ring-[#C8D5D8]",
                    isMessageEmpty || bodyTooLong
                      ? "cursor-not-allowed border-transparent bg-[#C9D3D6] text-white/80 shadow-none"
                      : "border-[#6E8E95] bg-[#6E8E95] hover:border-[#5C7A81] hover:bg-[#5C7A81] active:scale-[1.01]",
                  ].join(" ")}
                  disabled={isMessageEmpty || bodyTooLong}
                  onClick={goToDetails}
                  type="button"
                >
                  Send kindness <span aria-hidden>→</span>
                </button>
              </div>
            </div>

            <SuggestionRow onSelect={applySuggestion} suggestions={SUGGESTIONS} />
          </>
        ) : (
          <section className="panel p-6 sm:p-7">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-[24px] font-medium leading-tight text-[#2E2E2E]">Share this TinyKind</h2>
              <button
                className="rounded-full bg-transparent px-3 py-1.5 text-sm text-[#6B6B6B] transition duration-150 ease-out hover:bg-[#F1F1EF] hover:text-[#2E2E2E]"
                onClick={() => setStep("compose")}
                type="button"
              >
                Back to message
              </button>
            </div>

            {senderEmail ? (
              <div className="rounded-xl border border-[#E8E6E3] bg-[#FFFFFF] px-4 py-3 text-sm text-[#6B6B6B]">
                From <span className="font-medium text-[#2E2E2E]">{senderDefaultName || senderName}</span> ({senderEmail})
              </div>
            ) : (
              <div className="rounded-xl border border-[#E8E6E3] bg-[#FFFFFF] p-4 text-sm text-[#6B6B6B]">
                <p className="text-[#2E2E2E]">Sign in to save your TinyKind history and use your profile automatically.</p>
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
            )}

            <div className="mt-4 grid gap-3">
              {!senderEmail ? (
                <>
                  <label className="grid gap-1 text-sm font-medium text-[#2E2E2E]">
                    From
                    <input
                      className="field"
                      onChange={(event) => setSenderName(event.target.value)}
                      placeholder="Your name"
                      value={senderName}
                    />
                  </label>
                  <label className="grid gap-1 text-sm font-medium text-[#2E2E2E]">
                    Your email (reaction notifications)
                    <input
                      className="field mono"
                      onChange={(event) => setSenderNotifyEmail(event.target.value)}
                      placeholder="you@email.com"
                      type="email"
                      value={senderNotifyEmail}
                    />
                  </label>
                </>
              ) : null}

              <div className="grid gap-2">
                <div className="text-sm font-medium text-[#2E2E2E]">Delivery</div>
                <div className="flex flex-wrap gap-2">
                  <button
                    className={`btn px-4 py-2 text-sm ${!sendByEmail ? "btn-primary" : ""}`}
                    onClick={() => setSendByEmail(false)}
                    type="button"
                  >
                    Share a link
                  </button>
                  <button
                    className={`btn px-4 py-2 text-sm ${sendByEmail ? "btn-primary" : ""}`}
                    onClick={() => setSendByEmail(true)}
                    type="button"
                  >
                    Send in email
                  </button>
                </div>
              </div>

              {!sendByEmail ? (
                <label className="grid gap-1 text-sm font-medium text-[#2E2E2E]">
                  To
                  <input
                    className="field"
                    onChange={(event) => setRecipientName(event.target.value)}
                    placeholder="Who is this for?"
                    value={recipientName}
                  />
                </label>
              ) : null}

              {sendByEmail ? (
                <label className="grid gap-1 text-sm font-medium text-[#2E2E2E]">
                  Recipient email
                  <input
                    className="field mono"
                    onChange={(event) => setRecipientEmail(event.target.value)}
                    placeholder="recipient@email.com"
                    type="email"
                    value={recipientEmail}
                  />
                </label>
              ) : null}

              <label className="grid gap-1 text-sm font-medium text-[#2E2E2E]">
                Message
                <textarea
                  className="field min-h-28 resize-y"
                  maxLength={500}
                  onChange={(event) => setBody(event.target.value)}
                  value={body}
                />
              </label>

              <div className="text-sm text-[#6B6B6B]">
                {charCount}/500 {bodyTooLong ? "(too long)" : ""}
              </div>

              <div className="mt-1 flex flex-wrap items-center gap-3">
                <button className="btn btn-primary" disabled={loading || bodyTooLong} type="submit">
                  {loading ? "Creating..." : sendByEmail ? "Share this via Gmail" : "Share this"}
                </button>
                {error ? <span className="text-sm text-[#A22D2D]">{error}</span> : null}
              </div>
            </div>
          </section>
        )}
      </form>

      {error && step === "compose" ? <div className="mt-3 text-sm text-[#A22D2D]">{error}</div> : null}

      {created ? (
        <div className="panel mt-6 p-5 sm:p-6">
          <div className="text-lg font-medium text-[#2E2E2E]">Kindness ready to send</div>
          <div className="mt-2 flex items-center gap-2">
            <a className="mono text-sm text-[#6B6B6B] underline decoration-[#D7D4CF] underline-offset-4" href={created.messageUrl} target="_blank">
              {created.messageUrl}
            </a>
            <button
              aria-label="Copy link"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-[#E8E6E3] bg-[#FFFFFF] text-[#7A7A7A] transition duration-150 ease-out hover:bg-[#F6F4F1] hover:text-[#2E2E2E]"
              onClick={() => copyToClipboard("Link copied", created.messageUrl)}
              title="Copy link"
              type="button"
            >
              ⧉
            </button>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {created.deliveryMode === "email" && created.gmailComposeUrl ? (
              <button className="btn btn-primary inline-block text-sm" onClick={openGmailDraft} type="button">
                Open Gmail draft
              </button>
            ) : null}
          </div>

          {created.deliveryMode === "email" ? (
            <div className="mt-3 text-sm text-[#6B6B6B]">
              Recipient email: {created.recipientEmail ?? "Not provided (add recipient in Gmail)"}
            </div>
          ) : (
            <div className="mt-2 text-xs text-[#6B6B6B]">{created.sharePreview}</div>
          )}

          <div className="mt-3 text-sm text-[#6B6B6B]">Email body preview:</div>
          <div className="relative">
            <button
              aria-label="Copy full email body"
              className="btn absolute right-2 top-2 px-3 py-1 text-xs"
              onClick={() => copyToClipboard("Body copied", created.emailBody)}
              title="Copy body"
              type="button"
            >
              ⧉
            </button>
            <pre className="mono mt-2 overflow-x-auto rounded-xl border border-[#E8E6E3] bg-[#FFFFFF] p-4 pr-20 text-xs text-[#2E2E2E]">
              {created.emailBody}
            </pre>
          </div>
        </div>
      ) : null}

      {copied ? (
        <div className="fixed bottom-5 right-5 z-20 rounded-full border border-[#E8E6E3] bg-[#FFFFFF] px-4 py-2 text-xs text-[#6B6B6B] shadow-sm">
          {copied}
        </div>
      ) : null}
    </section>
  );
}
