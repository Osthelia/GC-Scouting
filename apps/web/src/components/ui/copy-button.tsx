/**
 * GC-Scouting - copy-button
 *
 * Button that copies a value with visual feedback.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

"use client";

import { useEffect, useState, type ReactNode } from "react";
import { CheckIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/** Copies `value` (the current page URL when omitted) and shows `copiedLabel` for a moment. */
export function CopyButton({ value, label, copiedLabel, title, icon, className }: { value?: string; label: string; copiedLabel: string; title?: string; icon?: ReactNode; className?: string }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1800);
    return () => clearTimeout(timer);
  }, [copied]);

  return (
    <button
      type="button"
      title={title}
      onClick={async () => {
        await navigator.clipboard.writeText(value ?? window.location.href);
        setCopied(true);
      }}
      className={cn(
        "inline-flex h-[38px] items-center gap-2 rounded-[10px] border px-3 text-[13px] font-semibold transition-all active:scale-[0.97]",
        copied
          ? "border-[color-mix(in_oklab,var(--sc-accent)_45%,transparent)] bg-[color-mix(in_oklab,var(--sc-accent)_14%,transparent)] text-[var(--sc-accent)]"
          : "border-neutral-800 bg-[var(--sc-surface)] text-neutral-200 hover:bg-[var(--sc-hover)]",
        className
      )}
    >
      {copied ? <CheckIcon className="h-4 w-4" /> : icon}
      <span aria-live="polite">{copied ? copiedLabel : label}</span>
    </button>
  );
}
