/**
 * GC-Scouting - post-skeleton
 *
 * Loading skeleton of a post.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

"use client";

import { useTranslations } from "next-intl";

/** Placeholder while a post page loads. */
export function PostSkeleton() {
  const t = useTranslations("postPage");
  const block = "animate-pulse rounded-xl border border-neutral-800 bg-[var(--sc-surface)]";
  return (
    <div role="status" aria-label={t("loading")} className="mx-auto max-w-[1400px] px-4 py-8 sm:px-6 sm:py-10">
      <div className="h-6 w-40 animate-pulse rounded-md bg-[var(--sc-surface)]" />
      <div className={`mt-4 h-[380px] rounded-2xl ${block}`} />
      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-8">
        <div className="flex flex-col gap-6">
          <div className={`h-[120px] ${block}`} />
          <div className={`h-[300px] ${block}`} />
          <div className={`h-[280px] ${block}`} />
        </div>
        <div className="flex flex-col gap-6">
          <div className={`h-[260px] ${block}`} />
          <div className={`h-[200px] ${block}`} />
        </div>
      </div>
    </div>
  );
}
