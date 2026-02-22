import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedSenderEmailFromRequest } from "@/lib/senderAuth";
import { getSenderProfile, updateReminderSettings } from "@/lib/store";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const senderEmail = getAuthenticatedSenderEmailFromRequest(request);
  if (!senderEmail) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const profile = await getSenderProfile(senderEmail);
  return NextResponse.json({
    reminder: profile?.reminder ?? null,
  });
}

interface ReminderPayload {
  enabled?: boolean;
  weekday?: number;
  hour?: number;
  minute?: number;
  timezone?: string;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const senderEmail = getAuthenticatedSenderEmailFromRequest(request);
  if (!senderEmail) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const payload = (await request.json()) as ReminderPayload;
    const profile = await updateReminderSettings(senderEmail, {
      enabled: Boolean(payload.enabled),
      weekday: Number(payload.weekday ?? 0),
      hour: Number(payload.hour ?? 15),
      minute: Number(payload.minute ?? 0),
      timezone: String(payload.timezone ?? "America/Los_Angeles"),
    });
    return NextResponse.json({ reminder: profile.reminder });
  } catch (error) {
    const details = error instanceof Error ? error.message : "Unable to save reminder settings.";
    return NextResponse.json({ error: details }, { status: 400 });
  }
}

