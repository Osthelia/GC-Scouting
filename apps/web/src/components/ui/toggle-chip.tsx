/**
 * GC-Scouting - toggle-chip
 *
 * Toggleable chip.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** On/off chip used by multi choice filters. `color` overrides the accent when active. */
export function ToggleChip({ active, onClick, children, color }: { active: boolean; onClick: () => void; children: ReactNode; color?: string }) {
  const tint = color ?? "var(--sc-accent)";
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "inline-flex h-[30px] items-center gap-1.5 rounded-lg border px-2.5 text-[12.5px] transition-all active:scale-[0.95]",
        active ? "font-semibold" : "border-neutral-800 bg-[var(--sc-surface)] font-medium text-neutral-400 hover:bg-[var(--sc-hover)] hover:text-neutral-100"
      )}
      style={active ? { color: tint, borderColor: `color-mix(in oklab, ${tint} 45%, transparent)`, background: `color-mix(in oklab, ${tint} 14%, transparent)` } : undefined}
    >
      {children}
    </button>
  );
}
