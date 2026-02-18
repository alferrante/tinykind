import { NextRequest, NextResponse } from "next/server";
import { deleteMessageById, getLatestReactionForMessage, getMessageById } from "@/lib/store";
import { isAdminRequest } from "@/lib/adminAuth";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  const { id } = await context.params;
  const message = await getMessageById(id);
  if (!message) {
    return NextResponse.json({ error: "Message not found." }, { status: 404 });
  }

  const latestReaction = await getLatestReactionForMessage(message.id);
  return NextResponse.json({ message, latestReaction });
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  const { id } = await context.params;
  const deleted = await deleteMessageById(id);
  if (!deleted) {
    return NextResponse.json({ error: "Message not found." }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
