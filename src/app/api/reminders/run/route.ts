import { NextRequest, NextResponse } from "next/server";
import { sendWeeklyReminderEmail } from "@/lib/authNotification";
import { addOperationalEvent, listDueReminders, markReminderSent } from "@/lib/store";

function authorized(request: NextRequest): boolean {
  const expected = process.env.TINYKIND_CRON_TOKEN?.trim();
  if (!expected) {
    return false;
  }
  const provided = request.headers.get("x-tinykind-cron-token")?.trim();
  return Boolean(provided && provided === expected);
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const due = await listDueReminders(new Date());
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? request.nextUrl.origin;
  const results: Array<{ email: string; sent: boolean; reason?: string }> = [];

  for (const reminder of due) {
    const result = await sendWeeklyReminderEmail({
      toEmail: reminder.senderEmail,
      appUrl: baseUrl,
    });
    if (result.sent) {
      await markReminderSent(reminder.senderEmail, new Date());
      await addOperationalEvent("reminder_email_sent", {
        senderEmail: reminder.senderEmail,
        metadata: { profileId: reminder.profileId },
      });
    } else {
      await addOperationalEvent("reminder_email_failed", {
        senderEmail: reminder.senderEmail,
        metadata: {
          profileId: reminder.profileId,
          reason: result.reason ?? "unknown",
        },
      });
    }
    results.push({
      email: reminder.senderEmail,
      sent: result.sent,
      reason: result.reason,
    });
  }

  return NextResponse.json({
    checked: due.length,
    sent: results.filter((item) => item.sent).length,
    results,
  });
}

