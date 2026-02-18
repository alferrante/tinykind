import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { makeRecipientFingerprint, upsertReaction } from "@/lib/store";

interface ReactionRequest {
  slug?: string;
  emoji?: string;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const payload = (await request.json()) as ReactionRequest;
    const slug = payload.slug?.trim();
    const emoji = payload.emoji?.trim();
    if (!slug || !emoji) {
      return NextResponse.json({ error: "slug and emoji are required." }, { status: 400 });
    }

    const existingCookie = request.cookies.get("tk_fp")?.value ?? null;
    const stableSeed = existingCookie ?? randomUUID();
    const recipientFingerprint = makeRecipientFingerprint(stableSeed);
    const reaction = await upsertReaction({ slug, emoji, recipientFingerprint });

    const response = NextResponse.json({ reaction }, { status: 201 });
    if (!existingCookie) {
      response.cookies.set({
        name: "tk_fp",
        value: stableSeed,
        path: "/",
        sameSite: "lax",
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        maxAge: 60 * 60 * 24 * 365,
      });
    }
    return response;
  } catch (error) {
    const details = error instanceof Error ? error.message : "Unable to save reaction.";
    return NextResponse.json({ error: details }, { status: 400 });
  }
}

