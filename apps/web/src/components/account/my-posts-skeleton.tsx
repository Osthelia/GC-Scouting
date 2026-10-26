/**
 * GC-Scouting - my-posts-skeleton
 *
 * Loading skeleton of the my posts page.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

"use client";

import { useTranslations } from "next-intl";

/** Placeholder while the author's posts load. */
export function MyPostsSkeleton() {
  const t = useTranslations("myPosts");
  return (
    <div role="status" aria-label={t("loading")} className="mx-auto max-w-[960px] px-4 py-8 sm:px-6 sm:py-10">
      <div className="h-10 w-56 animate-pulse rounded-lg bg-[var(--sc-surface)]" />
      <div className="mt-3 h-5 w-full max-w-xl animate-pulse rounded-md bg-[var(--sc-surface)]" />
      <div className="mt-7 flex flex-col gap-2.5">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-[74px] animate-pulse rounded-xl border border-neutral-800 bg-[var(--sc-surface)]" />
        ))}
      </div>
    </div>
  );
}
