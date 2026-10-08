/**
 * GC-Scouting - post-form-skeleton
 *
 * Loading skeleton of the post form.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

"use client";

import { useTranslations } from "next-intl";

/** Placeholder while the post form loads. */
export function PostFormSkeleton() {
  const t = useTranslations("newPost");
  const block = "animate-pulse rounded-2xl border border-neutral-800 bg-[var(--sc-surface)]";
  return (
    <div role="status" aria-label={t("loading")} className="mx-auto max-w-[960px] px-4 py-8 sm:px-6 sm:py-10">
      <div className="h-6 w-32 animate-pulse rounded-md bg-[var(--sc-surface)]" />
      <div className="mt-4 h-10 w-64 animate-pulse rounded-lg bg-[var(--sc-surface)]" />
      <div className="mt-3 mb-7 h-5 w-full max-w-xl animate-pulse rounded-md bg-[var(--sc-surface)]" />
      <div className="flex flex-col gap-5">
        <div className={`h-[220px] ${block}`} />
        <div className={`h-[300px] ${block}`} />
        <div className={`h-[260px] ${block}`} />
      </div>
    </div>
  );
}
