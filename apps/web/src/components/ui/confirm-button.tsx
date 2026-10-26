/**
 * GC-Scouting - confirm-button
 *
 * Button that asks for a second click before acting.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

"use client";

import { useState, useTransition, type ReactNode } from "react";
import { Loader2Icon } from "lucide-react";
import { cn } from "@/lib/utils";

const base = "inline-flex h-9 items-center gap-1.5 rounded-[9px] border px-3 text-[13px] font-semibold transition-all active:scale-[0.97] disabled:opacity-70";
const neutral = "border-neutral-800 bg-[var(--sc-surface)] text-neutral-300 hover:bg-[var(--sc-hover)] hover:text-neutral-100";
const danger = "border-red-500/40 bg-red-500/10 text-red-400 hover:bg-red-500/20";

/** Two step button: the action only runs once confirmed in place. `onConfirm` resolves once done. */
export function ConfirmButton({
  label,
  confirmLabel,
  cancelLabel,
  icon,
  danger: isDanger,
  onConfirm,
}: {
  label: string;
  confirmLabel: string;
  cancelLabel: string;
  icon?: ReactNode;
  danger?: boolean;
  onConfirm: () => Promise<void>;
}) {
  const [asking, setAsking] = useState(false);
  const [pending, startTransition] = useTransition();

  if (!asking) {
    return (
      <button type="button" onClick={() => setAsking(true)} className={cn(base, neutral)}>
        {icon}
        {label}
      </button>
    );
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <button
        type="button"
        disabled={pending}
        aria-busy={pending}
        onClick={() =>
          startTransition(async () => {
            await onConfirm();
            setAsking(false);
          })
        }
        className={cn(base, isDanger ? danger : "border-transparent bg-[var(--sc-accent)] text-[var(--sc-accent-ink)] hover:brightness-110")}
      >
        {pending && <Loader2Icon className="h-3.5 w-3.5 animate-spin" />}
        {confirmLabel}
      </button>
      <button type="button" disabled={pending} onClick={() => setAsking(false)} className={cn(base, neutral)}>
        {cancelLabel}
      </button>
    </span>
  );
}
