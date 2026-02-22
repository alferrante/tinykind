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

export async function sendTinyKindEmail(input: SendEmailInput): Promise<EmailSendResult> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const fromEmail = process.env.TINYKIND_REACTION_FROM_EMAIL?.trim();
  if (!apiKey || !fromEmail) {
    return { sent: false, reason: "missing-email-config" };
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: fromEmail,
      to: [input.toEmail],
      subject: input.subject,
      text: input.text,
      html: input.html ?? textToHtml(input.text),
    }),
  });

  if (!response.ok) {
    let details = "";
    try {
      details = await response.text();
    } catch {
      details = "";
    }
    const compact = details.replace(/\s+/g, " ").trim().slice(0, 240);
    return { sent: false, reason: compact ? `resend-${response.status}: ${compact}` : `resend-${response.status}` };
  }

  return { sent: true };
}

