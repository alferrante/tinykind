"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

interface AccountMenuProps {
  senderEmail: string;
  displayName?: string | null;
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
        className="grid h-11 w-11 place-items-center rounded-full border border-[#ffffff4d] bg-[#d6e4ff] text-xl font-semibold text-[#1f3d73] shadow-md transition hover:brightness-105"
        onClick={() => setOpen((value) => !value)}
        type="button"
      >
        {initial}
      </button>

      {open ? (
        <div
          className="absolute right-0 z-30 mt-3 w-[260px] overflow-hidden rounded-2xl border border-[#ffffff2b] bg-[#0f1d31f2] text-[#e7efff] shadow-2xl backdrop-blur-md"
          role="menu"
        >
          <div className="border-b border-[#ffffff1f] px-4 py-4">
            <div className="text-base font-semibold">{resolvedName}</div>
            <div className="mt-1 text-xs text-[#dce7ffcc]">{senderEmail}</div>
          </div>

          <div className="px-2 py-2">
            {showDashboardLink ? (
              <Link
                className="block rounded-xl px-3 py-2 text-sm hover:bg-[#ffffff14]"
                href="/dashboard"
                onClick={() => setOpen(false)}
                role="menuitem"
              >
                View dashboard
              </Link>
            ) : null}
            {showNewTinyKindLink ? (
              <Link
                className="block rounded-xl px-3 py-2 text-sm hover:bg-[#ffffff14]"
                href="/"
                onClick={() => setOpen(false)}
                role="menuitem"
              >
                New TinyKind
              </Link>
            ) : null}
          </div>

          <div className="border-t border-[#ffffff1f] px-2 py-2">
            <form action="/api/auth/logout" method="post">
              <button className="block w-full rounded-xl px-3 py-2 text-left text-sm hover:bg-[#ffffff14]" role="menuitem" type="submit">
                Log out
              </button>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
