"use client";

import { useState } from "react";

interface CreatedMessage {
  id: string;
  shortLinkSlug: string;
}

interface CreateResponse {
  message: CreatedMessage;
  messageUrl: string;
  recipientEmail: string | null;
  gmailComposeUrl: string;
  emailSubject: string;
  emailBody: string;
  sharePreview: string;
}

export default function CreateTinyKindCard() {
  const [senderName, setSenderName] = useState("");
  const [senderNotifyEmail, setSenderNotifyEmail] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<CreateResponse | null>(null);
  const [copied, setCopied] = useState<string>("");
  const [gmailOpened, setGmailOpened] = useState(false);
  const [sendMarked, setSendMarked] = useState(false);

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
      setError("Body exceeds 500 characters.");
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
          senderNotifyEmail,
          recipientName,
          recipientContact: recipientEmail,
          body,
          channel: "email",
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
    if (!created) {
      return;
    }
    window.open(created.gmailComposeUrl, "_blank", "noopener,noreferrer");
    setGmailOpened(true);
    setSendMarked(false);
  }

  return (
    <section className="panel p-5 md:p-7">
      <div className="mb-4 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl leading-tight">Create TinyKind</h2>
        </div>
      </div>

      <form className="grid gap-3" onSubmit={onSubmit}>
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
          Your email (optional - to receive reaction notifications)
          <input
            className="field mono"
            onChange={(event) => setSenderNotifyEmail(event.target.value)}
            placeholder="you@email.com"
            value={senderNotifyEmail}
          />
        </label>

        <label className="grid gap-1 text-sm font-medium">
          To name
          <input
            className="field"
            value={recipientName}
            onChange={(event) => setRecipientName(event.target.value)}
            placeholder="Recipient name"
          />
        </label>

        <label className="grid gap-1 text-sm font-medium">
          Recipient email (optional, prefills Gmail To:)
          <input
            className="field mono"
            value={recipientEmail}
            onChange={(event) => setRecipientEmail(event.target.value)}
            placeholder="recipient@email.com"
          />
        </label>

        <label className="grid gap-1 text-sm font-medium">
          Body
          <textarea
            className="field min-h-28 resize-y"
            value={body}
            onChange={(event) => setBody(event.target.value)}
            maxLength={500}
            placeholder="I appreciate you because..."
          />
        </label>

        <div className="text-sm text-[var(--ink-soft)]">
          {charCount}/500 {bodyTooLong ? "(too long)" : ""}
        </div>

        <div className="mt-1 flex items-center gap-3">
          <button type="submit" className="btn btn-primary" disabled={loading || bodyTooLong}>
            {loading ? "Creating..." : "Create link + Gmail draft"}
          </button>
          {error ? <span className="text-sm text-[#a22d2d]">{error}</span> : null}
        </div>
      </form>

      {created ? (
        <div className="mt-5 rounded-xl border border-[var(--line)] bg-[#fff8ee] p-4">
          <div className="text-sm font-semibold">Message created</div>
          <a href={created.messageUrl} className="mono mt-2 block text-sm text-[#174a8c] underline">
            {created.messageUrl}
          </a>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              className="btn btn-primary inline-block text-sm"
              onClick={openGmailDraft}
              type="button"
            >
              Open Gmail draft (you send)
            </button>
            <button
              className="btn text-sm"
              onClick={() => copyToClipboard("Link", created.messageUrl)}
              type="button"
            >
              Copy link
            </button>
            <button
              className="btn text-sm"
              onClick={() => {
                setSendMarked(true);
                setCopied("Marked as sent");
                setTimeout(() => setCopied(""), 1500);
              }}
              disabled={!gmailOpened}
              type="button"
            >
              I sent it
            </button>
          </div>
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
