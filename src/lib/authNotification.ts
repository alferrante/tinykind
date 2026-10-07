import { sendTinyKindEmail } from "@/lib/email";

interface SendLoginLinkInput {
  toEmail: string;
  idempotencyKey?: string;
  loginUrl: string;
}

export async function sendLoginLinkEmail(input: SendLoginLinkInput): Promise<{ sent: boolean; reason?: string }> {
  const subject = "Your TinyKind sign-in link";
  const text = [
    "Use this one-time link to sign in to TinyKind:",
    input.loginUrl,
    "",
    "This link expires in 20 minutes.",
  ].join("\n");
  const html = [
    "<p>Use this one-time link to sign in to TinyKind:</p>",
    `<p><a href="${input.loginUrl}">${input.loginUrl}</a></p>`,
    "<p>This link expires in 20 minutes.</p>",
  ].join("");
  return sendTinyKindEmail({
    toEmail: input.toEmail,
    idempotencyKey: input.idempotencyKey,
    subject,
    text,
    html,
  });
}

interface SendReminderInput {
  toEmail: string;
  idempotencyKey?: string;
  appUrl: string;
}

export async function sendWeeklyReminderEmail(input: SendReminderInput): Promise<{ sent: boolean; reason?: string }> {
  const subject = "TinyKind weekly reminder";
  const text = [
    "Who made your week a little better? Send them a TinyKind.",
    "",
    `Create one now: ${input.appUrl}`,
  ].join("\n");
  const html = [
    "<p>Who made your week a little better? Send them a TinyKind.</p>",
    `<p><a href="${input.appUrl}">Create one now</a></p>`,
  ].join("");
  return sendTinyKindEmail({
    toEmail: input.toEmail,
    idempotencyKey: input.idempotencyKey,
    subject,
    text,
    html,
  });
}

