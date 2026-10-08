/**
 * GC-Scouting - posts-skeleton
 *
 * Loading skeleton of the post list.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

"use client";

import { useTranslations } from "next-intl";

/** Placeholder while the post list loads. */
export function PostsSkeleton() {
  const t = useTranslations("posts");
  return (
    <div role="status" aria-label={t("loading")} className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)] lg:gap-8">
      <div className="hidden h-[640px] animate-pulse rounded-xl border border-neutral-800 bg-[var(--sc-surface-2)] lg:block" />
      <div>
        <div className="flex gap-2">
          <div className="h-[38px] flex-1 animate-pulse rounded-[10px] bg-[var(--sc-surface)]" />
          <div className="h-[38px] w-[200px] animate-pulse rounded-[10px] bg-[var(--sc-surface)]" />
        </div>
        <div className="mt-4 mb-3 h-4 w-24 animate-pulse rounded bg-[var(--sc-surface)]" />
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="h-[168px] animate-pulse rounded-xl border border-neutral-800 bg-[var(--sc-surface)]" />
          ))}
        </div>
      </div>
    </div>
  );
}
