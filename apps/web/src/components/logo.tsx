/**
 * GC-Scouting - logo
 *
 * GC Scouting wordmark.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

import { cn } from "@/lib/utils";

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("text-[17px] font-bold tracking-tight text-neutral-50", className)}>
      GC <span className="text-[var(--sc-accent)]">Scouting</span>
    </span>
  );
}
