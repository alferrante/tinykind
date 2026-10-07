import { createHash } from "node:crypto";

export function canonicalEmail(email: string): string {
  const normalized = email.trim().toLowerCase();
  const [local, domain] = normalized.split("@");
  if (domain === "gmail.com" || domain === "googlemail.com") {
    return `${local.split("+")[0].replaceAll(".", "")}@gmail.com`;
  }
  return normalized;
}

export function emailDigest(email: string): string {
  return createHash("sha256").update(canonicalEmail(email)).digest("hex");
}
