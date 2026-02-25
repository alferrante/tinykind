"use client";

import { useEffect, useState } from "react";
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

interface CreateTinyKindCardProps {
  senderDefaultName?: string;
  senderEmail: string | null;
}

export default function CreateTinyKindCard({ senderDefaultName = "", senderEmail }: CreateTinyKindCardProps) {
  const [senderName, setSenderName] = useState(senderDefaultName);
  const [senderNotifyEmail, setSenderNotifyEmail] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [body, setBody] = useState("");
  const [website, setWebsite] = useState("");
  const [deliveryMode, setDeliveryMode] = useState<DeliveryMode>("link");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<CreateResponse | null>(null);
  const [copied, setCopied] = useState<string>("");
  const [gmailOpened, setGmailOpened] = useState(false);
  const [sendMarked, setSendMarked] = useState(false);

  useEffect(() => {
    if (senderDefaultName) {
      setSenderName(senderDefaultName);
    }
  }, [senderDefaultName]);

  const charCount = body.length;
  const bodyTooLong = charCount > 500;

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

  async function onSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (bodyTooLong) {
      setError("Message exceeds 500 characters.");
      return;
    }
    if (deliveryMode === "email" && !recipientEmail.trim()) {
      setError("Recipient email is required for Send in email.");
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
          senderName,
          senderNotifyEmail: senderEmail ?? senderNotifyEmail,
          recipientName,
          recipientEmail: deliveryMode === "email" ? recipientEmail : null,
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
      <form className="grid gap-3" onSubmit={onSubmit}>
        <label aria-hidden="true" className="hidden">
          Website
          <input
            autoComplete="off"
            onChange={(event) => setWebsite(event.target.value)}
            tabIndex={-1}
            value={website}
          />
        </label>

        <div className="inline-flex w-fit rounded-full border border-[var(--line)] bg-[#fff4e6] p-1">
          <button
            className={`rounded-full px-3 py-1 text-sm ${deliveryMode === "link" ? "bg-[#1f2a38] text-white" : "text-[#263346]"}`}
            onClick={() => setDeliveryMode("link")}
            type="button"
          >
            Share a link
          </button>
          <button
            className={`rounded-full px-3 py-1 text-sm ${deliveryMode === "email" ? "bg-[#1f2a38] text-white" : "text-[#263346]"}`}
            onClick={() => setDeliveryMode("email")}
            type="button"
          >
            Send in email
          </button>
        </div>

        <label className="grid gap-1 text-sm font-medium">
          From
          <input
            className="field"
            onChange={(event) => setSenderName(event.target.value)}
            placeholder="Your name"
            value={senderName}
          />
        </label>

        <label className="grid gap-1 text-sm font-medium">
          To
          <input
            className="field"
            onChange={(event) => setRecipientName(event.target.value)}
            placeholder="Who is this for?"
            value={recipientName}
          />
        </label>

        {deliveryMode === "email" ? (
          <label className="grid gap-1 text-sm font-medium">
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

        {!senderEmail ? (
          <label className="grid gap-1 text-sm font-medium">
            Your email (optional - for reaction notifications)
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
            className="field min-h-28 resize-y"
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
          <button className="btn btn-primary" disabled={loading || bodyTooLong} type="submit">
            {loading
              ? "Creating..."
              : deliveryMode === "email"
                ? "Create link + Gmail draft"
                : "Create TinyKind link"}
          </button>
          {error ? <span className="text-sm text-[#a22d2d]">{error}</span> : null}
        </div>
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
              <div className="mt-1 text-xs text-[var(--ink-soft)]">
                This does not send automatically until you click Send in Gmail.
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

          {!senderEmail && senderNotifyEmail ? (
            <div className="mt-2 text-xs text-[var(--ink-soft)]">
              Want history and reminders?{" "}
              <a className="underline" href={`/login?email=${encodeURIComponent(senderNotifyEmail)}`}>
                Sign in with this email
              </a>
              .
            </div>
          ) : null}

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
