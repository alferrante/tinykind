interface ReactionNotificationInput {
  toEmail: string;
  senderName: string;
  recipientName: string;
  emoji: string;
  messageUrl: string;
}

export async function sendReactionNotification(
  input: ReactionNotificationInput,
): Promise<{ sent: boolean; reason?: string }> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const fromEmail = process.env.TINYKIND_REACTION_FROM_EMAIL?.trim();

  if (!apiKey || !fromEmail) {
    return { sent: false, reason: "missing-email-config" };
  }

  const subject = `${input.recipientName} reacted ${input.emoji}`;
  const text = [
    `Hi ${input.senderName},`,
    "",
    `${input.recipientName} reacted ${input.emoji} to your TinyKind.`,
    `View it: ${input.messageUrl}`,
    "",
    "— tinykind",
  ].join("\n");

  const html = [
    `<p>Hi ${escapeHtml(input.senderName)},</p>`,
    `<p><strong>${escapeHtml(input.recipientName)}</strong> reacted ${escapeHtml(input.emoji)} to your TinyKind.</p>`,
    `<p><a href="${escapeHtml(input.messageUrl)}">View TinyKind</a></p>`,
    "<p>— tinykind</p>",
  ].join("");

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: fromEmail,
      to: [input.toEmail],
      subject,
      text,
      html,
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

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
