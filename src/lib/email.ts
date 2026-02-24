interface SendEmailInput {
  toEmail: string;
  subject: string;
  text: string;
  html?: string;
}

export interface EmailSendResult {
  sent: boolean;
  reason?: string;
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
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

export async function sendTinyKindEmail(input: SendEmailInput): Promise<EmailSendResult> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const fromEmail = process.env.TINYKIND_REACTION_FROM_EMAIL?.trim();
  if (!apiKey || !fromEmail) {
    return { sent: false, reason: "missing-email-config" };
  }
  const timeoutMs = Number(process.env.TINYKIND_EMAIL_TIMEOUT_MS ?? "10000");
  const maxAttempts = Math.max(1, Number(process.env.TINYKIND_EMAIL_MAX_ATTEMPTS ?? "3"));
  const payload = JSON.stringify({
    from: fromEmail,
    to: [input.toEmail],
    subject: input.subject,
    text: input.text,
    html: input.html ?? textToHtml(input.text),
  });
  let lastReason = "unknown-error";

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const response = await postResendEmail(apiKey, payload, timeoutMs);
      if (response.ok) {
        return { sent: true };
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
        return { sent: false, reason: lastReason };
      }
    } catch (error) {
      if (error instanceof Error) {
        lastReason = error.name === "AbortError" ? "timeout" : `fetch-error: ${error.message}`;
      } else {
        lastReason = "fetch-error";
      }
      if (attempt === maxAttempts) {
        return { sent: false, reason: lastReason };
      }
    }

    await pause(Math.min(250 * 2 ** (attempt - 1), 2000));
  }

  return { sent: false, reason: lastReason };
}
