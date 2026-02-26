"use client";

import { useEffect, useMemo, useState } from "react";
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
  emailSubject: string;
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
}

const DRAFT_STORAGE_KEY = "tinykind-compose-draft-v3";

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
  const [website, setWebsite] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<CreateResponse | null>(null);
  const [copied, setCopied] = useState<string>("");
  const [gmailOpened, setGmailOpened] = useState(false);
  const [sendMarked, setSendMarked] = useState(false);
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
    });
  }, [draftLoaded, step, senderName, senderNotifyEmail, recipientName, recipientEmail, body]);

  const charCount = body.length;
  const bodyTooLong = charCount > 500;
  const deliveryMode: DeliveryMode = recipientEmail.trim() ? "email" : "link";

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
      setCopied(`${label} copied`);
      setTimeout(() => setCopied(""), 1500);
    } catch {
      setCopied("Clipboard blocked");
      setTimeout(() => setCopied(""), 1500);
    }
  }

  function goToDetails(): void {
    if (!body.trim()) {
      setError("Write your TinyKind message first.");
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
    if (!recipientName.trim()) {
      setError("Add who this TinyKind is for.");
      return;
    }

    const effectiveSenderName = senderEmail ? senderDefaultName.trim() || senderName.trim() : senderName.trim();
    if (!effectiveSenderName) {
      setError("Add your name, or sign in to autofill it.");
      return;
    }

    if (!senderEmail && !senderNotifyEmail.trim()) {
      setError("Add your email for reaction updates, or sign in.");
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setCreated(null);
      setGmailOpened(false);
      setSendMarked(false);

      const response = await fetch("/api/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          senderName: effectiveSenderName,
          senderNotifyEmail: senderEmail ?? senderNotifyEmail,
          recipientName,
          recipientEmail: recipientEmail.trim() || null,
          body,
          website,
          deliveryMode,
        }),
      });

      const payload = (await response.json()) as CreateResponse | { error?: string };
      if (!response.ok) {
        throw new Error("error" in payload ? payload.error : "Failed to create message.");
      }
      clearDraft();
      setCreated(payload as CreateResponse);
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
    setGmailOpened(true);
    setSendMarked(false);
  }

  return (
    <section className="panel p-5 md:p-7">
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
            <label className="grid gap-1 text-sm font-medium">
              Message
              <textarea
                className="field min-h-32 resize-y"
                maxLength={500}
                onChange={(event) => setBody(event.target.value)}
                placeholder="I appreciate you because..."
                value={body}
              />
            </label>

            <div className="text-sm text-[var(--ink-soft)]">
              {charCount}/500 {bodyTooLong ? "(too long)" : ""}
            </div>

            <div className="mt-1 flex items-center gap-3">
              <button className="btn btn-primary" disabled={bodyTooLong || loading} onClick={goToDetails} type="button">
                Continue
              </button>
              {error ? <span className="text-sm text-[#a22d2d]">{error}</span> : null}
            </div>
          </>
        ) : (
          <>
            {!senderEmail ? (
              <div className="rounded-xl border border-[var(--line)] bg-[#fff8ee] p-3 text-sm text-[var(--ink-soft)]">
                <p className="text-[var(--ink)]">Sign in to autofill your info and save your TinyKind history.</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
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
            ) : (
              <div className="rounded-xl border border-[var(--line)] bg-[#fff8ee] px-3 py-2 text-sm text-[var(--ink)]">
                From <strong>{senderDefaultName || senderName}</strong> ({senderEmail})
              </div>
            )}

            {!senderEmail ? (
              <label className="grid gap-1 text-sm font-medium">
                From
                <input
                  className="field"
                  onChange={(event) => setSenderName(event.target.value)}
                  placeholder="Your name"
                  value={senderName}
                />
              </label>
            ) : null}

            <label className="grid gap-1 text-sm font-medium">
              To
              <input
                className="field"
                onChange={(event) => setRecipientName(event.target.value)}
                placeholder="Who is this for?"
                value={recipientName}
              />
            </label>

            <label className="grid gap-1 text-sm font-medium">
              Recipient email (optional)
              <input
                className="field mono"
                onChange={(event) => setRecipientEmail(event.target.value)}
                placeholder="recipient@email.com"
                type="email"
                value={recipientEmail}
              />
            </label>

            {!senderEmail ? (
              <label className="grid gap-1 text-sm font-medium">
                Your email (for reactions)
                <input
                  className="field mono"
                  onChange={(event) => setSenderNotifyEmail(event.target.value)}
                  placeholder="you@email.com"
                  type="email"
                  value={senderNotifyEmail}
                />
              </label>
            ) : null}

            <label className="grid gap-1 text-sm font-medium">
              Message
              <textarea
                className="field min-h-32 resize-y"
                maxLength={500}
                onChange={(event) => setBody(event.target.value)}
                placeholder="I appreciate you because..."
                value={body}
              />
            </label>

            <div className="text-sm text-[var(--ink-soft)]">
              {charCount}/500 {bodyTooLong ? "(too long)" : ""}
            </div>

            <div className="mt-1 flex flex-wrap items-center gap-3">
              <button className="btn" onClick={() => setStep("compose")} type="button">
                Back
              </button>
              <button className="btn btn-primary" disabled={loading || bodyTooLong} type="submit">
                {loading
                  ? "Creating..."
                  : deliveryMode === "email"
                    ? "Create link + Gmail draft"
                    : "Create TinyKind link"}
              </button>
              {error ? <span className="text-sm text-[#a22d2d]">{error}</span> : null}
            </div>
          </>
        )}
      </form>

      {created ? (
        <div className="mt-5 rounded-xl border border-[var(--line)] bg-[#fff8ee] p-4">
          <div className="text-sm font-semibold">Message created</div>
          <a className="mono mt-2 block text-sm text-[#174a8c] underline" href={created.messageUrl}>
            {created.messageUrl}
          </a>

          <div className="mt-3 flex flex-wrap gap-2">
            {created.deliveryMode === "email" && created.gmailComposeUrl ? (
              <button className="btn btn-primary inline-block text-sm" onClick={openGmailDraft} type="button">
                Open Gmail draft (you send)
              </button>
            ) : null}
            <button className="btn text-sm" onClick={() => copyToClipboard("Link", created.messageUrl)} type="button">
              Copy link
            </button>
            {created.deliveryMode === "email" && created.gmailComposeUrl ? (
              <button
                className="btn text-sm"
                disabled={!gmailOpened}
                onClick={() => {
                  setSendMarked(true);
                }}
                type="button"
              >
                I sent it
              </button>
            ) : null}
          </div>

          {created.deliveryMode === "email" ? (
            <>
              <div className="mt-3 text-sm text-[var(--ink-soft)]">
                Recipient email: {created.recipientEmail ?? "Not provided (add recipient in Gmail)"}
              </div>
              {gmailOpened && !sendMarked ? (
                <div className="mt-1 text-xs text-[var(--ink-soft)]">
                  After sending in Gmail, click &quot;I sent it&quot; here.
                </div>
              ) : null}
              {sendMarked ? <div className="mt-1 text-xs text-[#174a8c]">Sent confirmed.</div> : null}
            </>
          ) : (
            <div className="mt-2 text-xs text-[var(--ink-soft)]">{created.sharePreview}</div>
          )}

          <div className="mt-2 text-sm text-[var(--ink-soft)]">Email preview:</div>
          <div className="relative">
            <button
              aria-label="Copy full email body"
              className="btn absolute right-2 top-2 px-3 py-1 text-xs"
              onClick={() => copyToClipboard("Body", created.emailBody)}
              title="Copy body"
              type="button"
            >
              ⧉
            </button>
            <pre className="mono mt-2 overflow-x-auto rounded-lg bg-[#1e2834] p-3 pr-20 text-xs text-[#d7e7ff]">
              {created.emailSubject}
              {"\n\n"}
              {created.emailBody}
            </pre>
          </div>
          {copied ? (
            <div className="fixed bottom-5 right-5 z-20 rounded-full bg-[#1e2834] px-4 py-2 text-xs text-[#d7e7ff] shadow-lg">
              {copied}
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
