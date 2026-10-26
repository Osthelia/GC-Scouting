/**
 * GC-Scouting - gcs-mark
 *
 * GC Stats mark.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

import { cn } from "@/lib/utils";

/** GC Stats logo, in GC Stats' own colors whatever the site palette. */
export function GcsMark({ size = 24, className }: { size?: number; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn("flex flex-none items-center justify-center bg-[#e4ae22] font-black tracking-tight text-[#0e0e0e]", className)}
      style={{ width: size, height: size, borderRadius: size * 0.3, fontSize: size * 0.42 }}
    >
      GC
    </span>
  );
}
