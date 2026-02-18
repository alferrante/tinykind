import { NextRequest } from "next/server";

export function isAdminRequest(request: NextRequest): boolean {
  const expected = process.env.TINYKIND_ADMIN_TOKEN;
  if (!expected) {
    return false;
  }
  const provided = request.headers.get("x-tinykind-admin-token");
  return provided === expected;
}

