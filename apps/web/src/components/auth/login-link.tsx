/**
 * GC-Scouting - login-link
 *
 * Login link that keeps the page to come back to.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

"use client";

import { useEffect, useState } from "react";
import { useLocale } from "next-intl";
import { Loader2Icon } from "lucide-react";
import { GcsMark } from "@/components/gcs-mark";
import { cn } from "@/lib/utils";

export function loginHref(locale: string, next: string): string {
  return `/api/auth/login?${new URLSearchParams({ locale, next })}`;
}

/** "Log in with GC Stats". Comes back to `next`, or to the current page. */
export function LoginLink({ label, next, small, className }: { label: string; next?: string; small?: boolean; className?: string }) {
  const locale = useLocale();
  const [pending, setPending] = useState(false);

  // Back navigation restores the page from bfcache with the spinner still on.
  useEffect(() => {
    const reset = () => setPending(false);
    window.addEventListener("pageshow", reset);
    return () => window.removeEventListener("pageshow", reset);
  }, []);

  return (
    <a
      href={loginHref(locale, next ?? `/${locale}`)}
      onClick={(e) => {
        if (!next) e.currentTarget.href = loginHref(locale, window.location.pathname + window.location.search);
        setPending(true);
      }}
      aria-busy={pending}
      className={cn(
        "inline-flex items-center gap-2 rounded-[10px] bg-[var(--sc-accent)] font-bold text-[var(--sc-accent-ink)] transition-all hover:brightness-110 active:scale-[0.97]",
        small ? "h-[38px] px-3.5 text-[13.5px]" : "h-11 rounded-[11px] px-5 text-[14.5px]",
        pending && "pointer-events-none opacity-80",
        className
      )}
    >
      {pending ? <Loader2Icon className="h-[18px] w-[18px] animate-spin" /> : <GcsMark size={18} />}
      {label}
    </a>
  );
}
