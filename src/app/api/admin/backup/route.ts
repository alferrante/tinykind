import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/adminAuth";
import { createManualBackupSnapshot } from "@/lib/store";

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  try {
    await createManualBackupSnapshot();
    const response = new NextResponse(null, { status: 303 });
    response.headers.set("Location", "/admin?backup=ok");
    return response;
  } catch (error) {
    const details = error instanceof Error ? error.message : "Unable to create backup.";
    return NextResponse.json({ error: details }, { status: 500 });
  }
}
