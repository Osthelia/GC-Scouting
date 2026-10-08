/**
 * GC-Scouting - agent-icon
 *
 * Agent icon with fallback.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

"use client";

import { useState } from "react";
import { AGENTS_BY_SLUG, agentIconUrl } from "@/lib/agents";
import { cn } from "@/lib/utils";
import { useImageFallback } from "@/lib/use-image-fallback";

export function AgentIcon({ slug, size = 36, className }: { slug: string; size?: number; className?: string }) {
  const [failed, setFailed] = useState(false);
  const fallback = useImageFallback(() => setFailed(true));
  const name = AGENTS_BY_SLUG[slug]?.name ?? slug;

  return (
    <div
      title={name}
      className={cn("flex flex-none items-center justify-center overflow-hidden rounded-md bg-[var(--sc-surface-3)]", className)}
      style={{ width: size, height: size }}
    >
      {failed ? (
        <span className="text-[10px] font-bold text-neutral-500 uppercase">{name.slice(0, 2)}</span>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={agentIconUrl(slug)} alt={name} width={size} height={size} loading="lazy" draggable={false} {...fallback} className="h-full w-full object-cover select-none" />
      )}
    </div>
  );
}
