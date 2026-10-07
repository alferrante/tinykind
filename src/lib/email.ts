import { createHash, randomUUID } from "node:crypto";
import { claimEmailDelivery, finishEmailDelivery, isEmailSuppressed } from "@/lib/store";

interface SendEmailInput {
  toEmail: string;
  subject: string;
  text: string;
  html?: string;
  idempotencyKey?: string;
}

export interface EmailSendResult {
  sent: boolean;
  reason?: string;
  attempts: number;
  durationMs: number;
  providerMessageId?: string;
}

export function isTinyKindEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY?.trim() && process.env.TINYKIND_REACTION_FROM_EMAIL?.trim());
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function textToHtml(text: string): string {
  return `<pre style="font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;white-space:pre-wrap;line-height:1.5;">${escapeHtml(text)}</pre>`;
}

function pause(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function shouldRetryStatus(status: number): boolean {
  return status === 429 || status >= 500;
}

async function postResendEmail(
  apiKey: string,
  body: string,
  timeoutMs: number,
  idempotencyKey: string,
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey,
      },
      body,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

export async function sendTinyKindEmail(input: SendEmailInput): Promise<EmailSendResult> {
  const startedAt = Date.now();
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const fromEmail = process.env.TINYKIND_REACTION_FROM_EMAIL?.trim();
  if (!apiKey || !fromEmail) {
    return { sent: false, reason: "missing-email-config", attempts: 0, durationMs: Date.now() - startedAt };
  }
  const timeoutMs = Math.min(30_000, Math.max(1_000, Number(process.env.TINYKIND_EMAIL_TIMEOUT_MS) || 10_000));
  const maxAttempts = Math.min(5, Math.max(1, Number(process.env.TINYKIND_EMAIL_MAX_ATTEMPTS) || 3));
  const payload = JSON.stringify({
    from: fromEmail,
    to: [input.toEmail],
    subject: input.subject,
    text: input.text,
    html: input.html ?? textToHtml(input.text),
  });
  if (await isEmailSuppressed(input.toEmail)) {
    return { sent: false, reason: "recipient-suppressed", attempts: 0, durationMs: Date.now() - startedAt };
  }
  const idempotencyKey = createHash("sha256").update(input.idempotencyKey ?? randomUUID()).digest("hex");
  const claim = await claimEmailDelivery(idempotencyKey, createHash("sha256").update(payload).digest("hex"));
  if (claim.state === "sent") return { sent: true, attempts: 0, durationMs: Date.now() - startedAt, providerMessageId: claim.providerMessageId };
  if (claim.state === "blocked") return { sent: false, reason: claim.reason, attempts: 0, durationMs: Date.now() - startedAt };
  async function failure(reason: string, attempts: number): Promise<EmailSendResult> {
    await finishEmailDelivery(idempotencyKey, claim.state === "claimed" ? claim.claimId : "", false);
    return { sent: false, reason, attempts, durationMs: Date.now() - startedAt };
  }
  let lastReason = "unknown-error";

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      if (await isEmailSuppressed(input.toEmail)) return failure("recipient-suppressed", attempt - 1);
      const response = await postResendEmail(apiKey, payload, timeoutMs, idempotencyKey);
      if (response.ok) {
        let providerMessageId: string | undefined;
        try {
          const json = (await response.json()) as { id?: string };
          providerMessageId = typeof json?.id === "string" ? json.id : undefined;
        } catch {
          providerMessageId = undefined;
        }
        await finishEmailDelivery(idempotencyKey, claim.claimId, true, providerMessageId);
        return {
          sent: true,
          attempts: attempt,
          durationMs: Date.now() - startedAt,
          providerMessageId,
        };
      }

      let details = "";
      try {
        details = await response.text();
      } catch {
        details = "";
      }
      const compact = details.replace(/\s+/g, " ").trim().slice(0, 240);
      lastReason = compact ? `resend-${response.status}: ${compact}` : `resend-${response.status}`;

      if (!shouldRetryStatus(response.status) || attempt === maxAttempts) {
        return failure(lastReason, attempt);
      }
    } catch (error) {
      if (error instanceof Error) {
        lastReason = error.name === "AbortError" ? "timeout" : `fetch-error: ${error.message}`;
      } else {
        lastReason = "fetch-error";
      }
      if (attempt === maxAttempts) {
        return failure(lastReason, attempt);
      }
    }

    await pause(Math.min(250 * 2 ** (attempt - 1), 2000));
  }

  return failure(lastReason, maxAttempts);
}
