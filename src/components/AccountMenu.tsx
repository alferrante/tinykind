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
        className="flex h-11 items-center gap-2 rounded-full border border-[#ffffff4a] bg-[#0c203acc] px-2.5 text-left text-[#e9f0ff] shadow-md backdrop-blur transition hover:brightness-105"
        onClick={() => setOpen((value) => !value)}
        type="button"
      >
        <span className="grid h-7 w-7 place-items-center rounded-full bg-[#d6e4ff] text-base font-semibold text-[#1f3d73]">
          {initial}
        </span>
        <span className="hidden max-w-[150px] truncate text-sm font-medium md:block">{resolvedName}</span>
        <span className="text-xs opacity-70">▾</span>
      </button>

      {open ? (
        <div
          className="absolute right-0 z-30 mt-3 w-[300px] overflow-hidden rounded-2xl border border-[#d7deeb] bg-[#f7f9ff] text-[#1c2638] shadow-2xl"
          role="menu"
        >
          <div className="border-b border-[#dfe5f1] px-4 py-4">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-full bg-[#d6e4ff] text-xl font-semibold text-[#1f3d73]">
                {initial}
              </span>
              <div>
                <div className="text-base font-semibold">{resolvedName}</div>
                <div className="mt-0.5 text-xs text-[#4a5a75]">{senderEmail}</div>
              </div>
            </div>
            {typeof sentCount === "number" ? (
              <div className="mt-3 inline-flex rounded-full border border-[#d5deed] bg-[#edf2fb] px-3 py-1 text-xs text-[#4a5a75]">
                {sentCount} TinyKinds sent
              </div>
            ) : null}
          </div>

          <div className="px-2 py-2">
            {showDashboardLink ? (
              <Link
                className="block rounded-xl px-3 py-2 text-sm hover:bg-[#e9eef9]"
                href="/dashboard"
                onClick={() => setOpen(false)}
                role="menuitem"
              >
                View dashboard
              </Link>
            ) : null}
            {showNewTinyKindLink ? (
              <Link
                className="block rounded-xl px-3 py-2 text-sm hover:bg-[#e9eef9]"
                href="/"
                onClick={() => setOpen(false)}
                role="menuitem"
              >
                New TinyKind
              </Link>
            ) : null}
          </div>

          <div className="border-t border-[#dfe5f1] px-2 py-2">
            <form action="/api/auth/logout" method="post">
              <button className="block w-full rounded-xl px-3 py-2 text-left text-sm hover:bg-[#e9eef9]" role="menuitem" type="submit">
                Log out
              </button>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
