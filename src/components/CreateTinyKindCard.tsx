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
  const [recipientName, setRecipientName] = useState("");
  const [recipientContact, setRecipientContact] = useState("");
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<CreateResponse | null>(null);
  const [copied, setCopied] = useState<string>("");

  const charCount = body.length;
  const bodyTooLong = charCount > 240;

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
      setError("Body exceeds 240 characters.");
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
          senderName,
          recipientName,
          recipientContact,
          body,
          channel: "sms",
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

  return (
    <section className="panel p-5 md:p-7">
      <div className="mb-4 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl leading-tight">Create TinyKind</h2>
          <p className="mt-1 text-sm text-[var(--ink-soft)]">
            Creates a new message + unique share URL on every send at{" "}
            <span className="mono">/t/&lt;slug&gt;</span>.
          </p>
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
          To name
          <input
            className="field"
            value={recipientName}
            onChange={(event) => setRecipientName(event.target.value)}
            placeholder="Recipient name"
          />
        </label>

        <label className="grid gap-1 text-sm font-medium">
          To contact (phone/email)
          <input
            className="field mono"
            value={recipientContact}
            onChange={(event) => setRecipientContact(event.target.value)}
            placeholder="name@email.com or +1..."
          />
        </label>

        <label className="grid gap-1 text-sm font-medium">
          Body
          <textarea
            className="field min-h-28 resize-y"
            value={body}
            onChange={(event) => setBody(event.target.value)}
            maxLength={240}
            placeholder="I appreciate you because..."
          />
        </label>

        <div className="text-sm text-[var(--ink-soft)]">
          {charCount}/240 {bodyTooLong ? "(too long)" : ""}
        </div>

        <div className="mt-1 flex items-center gap-3">
          <button type="submit" className="btn btn-primary" disabled={loading || bodyTooLong}>
            {loading ? "Creating..." : "Create link + draft email"}
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
            <a
              className="btn btn-primary inline-block text-sm"
              href={created.gmailComposeUrl}
              rel="noreferrer"
              target="_blank"
            >
              Open Gmail draft
            </a>
            <button
              className="btn text-sm"
              onClick={() => copyToClipboard("Link", created.messageUrl)}
              type="button"
            >
              Copy link
            </button>
            <button
              className="btn text-sm"
              onClick={() => copyToClipboard("Email subject", created.emailSubject)}
              type="button"
            >
              Copy subject
            </button>
            <button
              className="btn text-sm"
              onClick={() => copyToClipboard("Email body", created.emailBody)}
              type="button"
            >
              Copy body
            </button>
          </div>
          <div className="mt-3 text-sm text-[var(--ink-soft)]">
            Recipient email: {created.recipientEmail ?? "Add recipient in Gmail compose"}
          </div>
          <div className="mt-2 text-sm text-[var(--ink-soft)]">Email preview:</div>
          <pre className="mono mt-2 overflow-x-auto rounded-lg bg-[#1e2834] p-3 text-xs text-[#d7e7ff]">
            {created.emailSubject}
            {"\n\n"}
            {created.emailBody}
          </pre>
          {copied ? <div className="mt-2 text-xs text-[#174a8c]">{copied}</div> : null}
        </div>
      ) : null}
    </section>
  );
}
