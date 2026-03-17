import { sendTinyKindEmail } from "@/lib/email";

interface OpenNotificationInput {
  toEmail: string;
  senderName: string;
  recipientName: string;
  messageUrl: string;
}

export async function sendOpenNotification(
  input: OpenNotificationInput,
): Promise<{ sent: boolean; reason?: string; attempts: number; durationMs: number; providerMessageId?: string }> {
  const subject = `${input.recipientName} just opened your TinyKind`;
  const text = [
    `Hi ${input.senderName},`,
    "",
    `${input.recipientName} just opened your TinyKind.`,
    `See the note: ${input.messageUrl}`,
    "",
    "— tinykind",
  ].join("\n");

  const html = [
    `<p>Hi ${escapeHtml(input.senderName)},</p>`,
    `<p><strong>${escapeHtml(input.recipientName)}</strong> just opened your TinyKind.</p>`,
    `<p><a href="${escapeHtml(input.messageUrl)}">See the note</a></p>`,
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
