/**
 * GC-Scouting - badges
 *
 * Badges of a post: type, profile status and rank.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

import { useTranslations } from "next-intl";
import { POST_TYPE_BY_KEY, type PostType } from "@/lib/post-types";
import { RANK_BY_KEY, type Rank } from "@/lib/ranks";
import { RankIcon } from "./rank-icon";
import type { ProfileStatus } from "@/lib/posts";
import { cn } from "@/lib/utils";

export function PostTypeBadge({ type, className }: { type: PostType; className?: string }) {
  const def = POST_TYPE_BY_KEY[type];
  return (
    <span
      className={cn("inline-flex items-center rounded-md px-1.5 py-0.5 font-mono text-[11px] font-black tracking-wider", className)}
      style={{ color: def.color, background: `color-mix(in oklab, ${def.color} 14%, transparent)` }}
    >
      {def.code}
    </span>
  );
}

export function ProfileBadge({ status, label }: { status: Exclude<ProfileStatus, "none">; label?: string }) {
  const t = useTranslations("post");
  const verified = status === "verified";
  const text = label ?? t(verified ? "verified" : "pending");
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold whitespace-nowrap",
        verified ? "bg-[color-mix(in_oklab,var(--sc-accent)_14%,transparent)] text-[var(--sc-accent)]" : "bg-neutral-800/70 text-neutral-400"
      )}
    >
      {verified ? <CheckIcon /> : <ClockIcon />}
      {text}
    </span>
  );
}

export function RankChip({ rank, rankMax }: { rank: Rank; rankMax?: Rank }) {
  const from = RANK_BY_KEY[rank];
  const to = rankMax ? RANK_BY_KEY[rankMax] : null;
  return (
    <span className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold whitespace-nowrap text-neutral-200">
      <RankIcon rank={rank} />
      {from.label}
      {to && (
        <>
          <span className="text-neutral-600">-</span>
          <RankIcon rank={rankMax!} />
          {to.label}
        </>
      )}
    </span>
  );
}

export function CheckIcon({ className = "h-3 w-3" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  );
}

export function ClockIcon({ className = "h-3 w-3" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true">
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </svg>
  );
}
