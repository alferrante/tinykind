import { sendTinyKindEmail } from "@/lib/email";

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

  return sendTinyKindEmail({
    toEmail: input.toEmail,
    subject,
    text,
    html,
  });
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
