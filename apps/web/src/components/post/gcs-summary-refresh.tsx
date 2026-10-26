/**
 * GC-Scouting - gcs-summary-refresh
 *
 * Button that refreshes the GC Stats summary of a post.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

"use client";

import { useEffect, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { CheckIcon, Loader2Icon, RefreshCwIcon } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { refreshPostGcsSummary, type RefreshGcsSummaryResult } from "@/actions/posts";
import { cn } from "@/lib/utils";

type RefreshError = Extract<RefreshGcsSummaryResult, { ok: false }>;

/** Author only button that refetches the GC Stats history of a post. */
export function GcsSummaryRefresh({ postId }: { postId: number }) {
  const t = useTranslations("postPage.gcsRefresh");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<RefreshError | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!done) return;
    const timer = setTimeout(() => setDone(false), 1800);
    return () => clearTimeout(timer);
  }, [done]);

  function refresh() {
    setError(null);
    startTransition(async () => {
      const result = await refreshPostGcsSummary(postId).catch((): RefreshGcsSummaryResult => ({ ok: false, error: "failed" }));
      if (!result.ok) return setError(result);
      setDone(true);
      router.refresh();
    });
  }

  return (
    <span className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={refresh}
        disabled={pending}
        aria-busy={pending}
        className={cn(
          "inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-[12.5px] font-semibold transition-all active:scale-[0.97] disabled:cursor-wait disabled:opacity-70",
          done
            ? "border-[color-mix(in_oklab,var(--sc-accent)_45%,transparent)] bg-[color-mix(in_oklab,var(--sc-accent)_14%,transparent)] text-[var(--sc-accent)]"
            : "border-neutral-800 bg-[var(--sc-surface-2)] text-neutral-100 hover:bg-[var(--sc-hover)]",
        )}
      >
        {pending ? <Loader2Icon className="h-3.5 w-3.5 animate-spin" /> : done ? <CheckIcon className="h-3.5 w-3.5" /> : <RefreshCwIcon className="h-3.5 w-3.5" />}
        <span aria-live="polite">{pending ? t("pending") : done ? t("done") : t("label")}</span>
      </button>
      {error && (
        <span role="alert" className="text-[12px] text-red-400">
          {error.error === "cooldown" ? t("errors.cooldown", { minutes: Math.ceil((error.retryInSeconds ?? 60) / 60) }) : t(`errors.${error.error}`)}
        </span>
      )}
    </span>
  );
}
