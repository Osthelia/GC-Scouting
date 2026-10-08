/**
 * GC-Scouting - radio-cards
 *
 * Radio group displayed as cards.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

"use client";

import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type RadioCardOption<T extends string> = { value: T; icon: LucideIcon; label: string; detail: string };

/** Single choice shown as cards: icon, label and a detail line. */
export function RadioCards<T extends string>({
  id,
  value,
  options,
  onChange,
  disabled,
  invalid,
}: {
  id?: string;
  value: T;
  options: RadioCardOption<T>[];
  onChange: (value: T) => void;
  disabled?: boolean;
  invalid?: boolean;
}) {
  return (
    <div id={id} role="radiogroup" aria-invalid={invalid || undefined} className="grid gap-2 sm:grid-cols-2">
      {options.map(({ value: option, icon: Icon, label, detail }) => {
        const checked = option === value;
        return (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={checked}
            disabled={disabled}
            onClick={() => onChange(option)}
            className={cn(
              "flex items-start gap-3 rounded-xl border px-3.5 py-3 text-left transition-all active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60",
              checked ? "border-[color-mix(in_oklab,var(--sc-accent)_45%,transparent)] bg-[color-mix(in_oklab,var(--sc-accent)_8%,transparent)]" : "border-neutral-800 bg-[var(--sc-surface-2)] hover:bg-[var(--sc-hover)]",
              invalid && "border-red-500/70"
            )}
          >
            <span
              className={cn(
                "mt-0.5 flex h-[18px] w-[18px] flex-none items-center justify-center rounded-full border transition-colors",
                checked ? "border-[var(--sc-accent)]" : "border-neutral-700"
              )}
            >
              {checked && <span className="h-2 w-2 rounded-full bg-[var(--sc-accent)]" />}
            </span>
            <Icon className={cn("mt-0.5 h-4 w-4 flex-none", checked ? "text-[var(--sc-accent)]" : "text-neutral-500")} />
            <span className="min-w-0">
              <span className="block text-[13.5px] font-semibold text-neutral-100">{label}</span>
              <span className="mt-0.5 block text-[12.5px] leading-snug text-neutral-500">{detail}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
