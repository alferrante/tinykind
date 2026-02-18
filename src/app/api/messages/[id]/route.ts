import { NextRequest, NextResponse } from "next/server";
import { deleteMessageById, getLatestReactionForMessage, getMessageById } from "@/lib/store";

export async function GET(
  _: NextRequest,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await context.params;
  const message = await getMessageById(id);
  if (!message) {
    return NextResponse.json({ error: "Message not found." }, { status: 404 });
  }

  const latestReaction = await getLatestReactionForMessage(message.id);
  return NextResponse.json({ message, latestReaction });
}

export async function DELETE(
  _: NextRequest,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await context.params;
  const deleted = await deleteMessageById(id);
  if (!deleted) {
    return NextResponse.json({ error: "Message not found." }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}

