/**
 * GC-Scouting - account-skeleton
 *
 * Loading skeleton of the account page.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

"use client";

import { useTranslations } from "next-intl";

/** Placeholder while the account page loads (profile, delegations, settings). */
export function AccountSkeleton() {
  const t = useTranslations("account");
  return (
    <div role="status" aria-label={t("loading")} className="mx-auto max-w-[860px] px-4 py-8 sm:px-6 sm:py-10">
      <div className="h-10 w-48 animate-pulse rounded-lg bg-[var(--sc-surface)]" />
      <div className="mt-3 h-5 w-full max-w-xl animate-pulse rounded-md bg-[var(--sc-surface)]" />
      <div className="mt-7 flex flex-col gap-5">
        {[96, 180, 140, 120].map((height, i) => (
          <div key={i} style={{ height }} className="animate-pulse rounded-2xl border border-neutral-800 bg-[var(--sc-surface)]" />
        ))}
      </div>
    </div>
  );
}
