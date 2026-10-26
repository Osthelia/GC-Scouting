/**
 * GC-Scouting - check-row
 *
 * Styled checkbox row.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

"use client";

import { CheckIcon, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/** Checkbox styled as a row: icon, label and a detail line. */
export function CheckRow({
  icon: Icon,
  checked,
  disabled,
  onChange,
  label,
  detail,
  invalid,
}: {
  icon: LucideIcon;
  checked: boolean;
  disabled?: boolean;
  onChange: (value: boolean) => void;
  label: string;
  detail: string;
  invalid?: boolean;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-invalid={invalid || undefined}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "flex items-center gap-3 rounded-xl border px-3.5 py-3 text-left transition-all active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50",
        checked ? "border-[color-mix(in_oklab,var(--sc-accent)_45%,transparent)] bg-[color-mix(in_oklab,var(--sc-accent)_8%,transparent)]" : "border-neutral-800 bg-[var(--sc-surface-2)] hover:bg-[var(--sc-hover)]",
        invalid && "border-red-500/70"
      )}
    >
      <span
        className={cn(
          "flex h-[18px] w-[18px] flex-none items-center justify-center rounded-[5px] border transition-colors",
          checked ? "border-[var(--sc-accent)] bg-[var(--sc-accent)] text-[var(--sc-accent-ink)]" : "border-neutral-700"
        )}
      >
        {checked && <CheckIcon className="h-3 w-3" strokeWidth={3.5} />}
      </span>
      <Icon className={cn("h-4 w-4 flex-none", checked ? "text-[var(--sc-accent)]" : "text-neutral-500")} />
      <span className="min-w-0">
        <span className="block text-[13.5px] font-semibold text-neutral-100">{label}</span>
        <span className="block truncate text-[12.5px] text-neutral-500">{detail}</span>
      </span>
    </button>
  );
}
