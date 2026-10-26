/**
 * GC-Scouting - account-card
 *
 * Titled card that wraps a section of the account page.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function AccountCard({ title, description, danger, children }: { title: string; description?: string; danger?: boolean; children: ReactNode }) {
  return (
    <section className={cn("rounded-2xl border bg-[var(--sc-surface)] p-4 sm:p-6", danger ? "border-red-500/30" : "border-neutral-800")}>
      <h2 className={cn("text-[16px] font-bold tracking-tight", danger ? "text-red-300" : "text-neutral-50")}>{title}</h2>
      {description && <p className="mt-1 text-[13px] leading-relaxed text-neutral-500">{description}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}
