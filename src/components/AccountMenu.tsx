"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

interface AccountMenuProps {
  senderEmail: string;
  displayName?: string | null;
  sentCount?: number | null;
  showDashboardLink?: boolean;
  showNewTinyKindLink?: boolean;
}

function titleCaseWords(value: string): string {
  return value
    .split(/[\s._-]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function getDisplayName(displayName: string | null | undefined, senderEmail: string): string {
  const cleaned = (displayName ?? "").trim();
  if (cleaned) {
    return cleaned;
  }
  const localPart = senderEmail.split("@")[0] ?? senderEmail;
  return titleCaseWords(localPart);
}

export default function AccountMenu({
  senderEmail,
  displayName,
  sentCount = null,
  showDashboardLink = true,
  showNewTinyKindLink = true,
}: AccountMenuProps) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  const resolvedName = useMemo(() => getDisplayName(displayName, senderEmail), [displayName, senderEmail]);
  const initial = resolvedName.charAt(0).toUpperCase() || "A";

  useEffect(() => {
    function onPointerDown(event: MouseEvent): void {
      if (!wrapperRef.current) {
        return;
      }
      const target = event.target as Node | null;
      if (target && !wrapperRef.current.contains(target)) {
        setOpen(false);
      }
    }

    function onEscape(event: KeyboardEvent): void {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onEscape);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onEscape);
    };
  }, []);

  return (
    <div className="relative" ref={wrapperRef}>
      <button
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex h-11 items-center gap-2 rounded-full border border-[#E8E6E3] bg-[#F7F6F4] px-2.5 text-left text-[#2E2E2E] transition duration-150 ease-out hover:bg-[#FAFAF9]"
        onClick={() => setOpen((value) => !value)}
        type="button"
      >
        <span className="grid h-7 w-7 place-items-center rounded-full bg-gradient-to-b from-[#EFEDEC] to-[#DAD7D2] p-[1px]">
          <span className="grid h-full w-full place-items-center rounded-full bg-[#E6ECEE] text-xs font-medium text-[#4E5556]">
            {initial}
          </span>
        </span>
        <span className="max-w-[180px] truncate text-base font-medium">{resolvedName}</span>
        <span className="text-xs text-[#6B6B6B]">▼</span>
      </button>

      {open ? (
        <div
          className="absolute right-0 z-30 mt-3 w-[300px] overflow-hidden rounded-2xl border border-[#E8E6E3] bg-[#FFFFFF] text-[#2E2E2E] shadow-[0_10px_26px_rgba(0,0,0,0.06)]"
          role="menu"
        >
          <div className="border-b border-[#EFEDEB] px-4 py-4">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-full bg-gradient-to-b from-[#EFEDEC] to-[#DAD7D2] p-[1px]">
                <span className="grid h-full w-full place-items-center rounded-full bg-[#E6ECEE] text-base font-medium text-[#4E5556]">
                  {initial}
                </span>
              </span>
              <div>
                <div className="text-base font-medium">{resolvedName}</div>
                <div className="mt-0.5 text-xs text-[#6B6B6B]">{senderEmail}</div>
              </div>
            </div>
            {typeof sentCount === "number" ? (
              <div className="mt-3 inline-flex rounded-full border border-[#E8E6E3] bg-[#FAFAF9] px-3 py-1 text-xs text-[#6B6B6B]">
                {sentCount} TinyKinds sent
              </div>
            ) : null}
          </div>

          <div className="px-2 py-2">
            {showDashboardLink ? (
              <Link
                className="block rounded-xl px-3 py-2 text-sm text-[#6B6B6B] transition duration-150 ease-out hover:bg-[#F1F1EF] hover:text-[#2E2E2E]"
                href="/dashboard"
                onClick={() => setOpen(false)}
                role="menuitem"
              >
                View dashboard
              </Link>
            ) : null}
            {showNewTinyKindLink ? (
              <Link
                className="block rounded-xl px-3 py-2 text-sm text-[#6B6B6B] transition duration-150 ease-out hover:bg-[#F1F1EF] hover:text-[#2E2E2E]"
                href="/"
                onClick={() => setOpen(false)}
                role="menuitem"
              >
                New TinyKind
              </Link>
            ) : null}
          </div>

          <div className="border-t border-[#EFEDEB] px-2 py-2">
            <form action="/api/auth/logout" method="post">
              <button
                className="block w-full rounded-xl px-3 py-2 text-left text-sm text-[#6B6B6B] transition duration-150 ease-out hover:bg-[#F1F1EF] hover:text-[#2E2E2E]"
                role="menuitem"
                type="submit"
              >
                Log out
              </button>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
