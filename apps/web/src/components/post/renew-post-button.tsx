/**
 * GC-Scouting - renew-post-button
 *
 * Button that renews a post.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { CheckIcon, Loader2Icon, RefreshCwIcon } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { renewOwnPost, type RenewPostResult } from "@/actions/post-expiry";
import { cn } from "@/lib/utils";

/** Author only: ten more days and back on top of the list. */
export function RenewPostButton({ postId, compact }: { postId: number; compact?: boolean }) {
  const t = useTranslations("expiry.renew");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<RenewPostResult | null>(null);
  const done = result?.ok === true;

  function renew() {
    setResult(null);
    startTransition(async () => {
      const next = await renewOwnPost(postId).catch((): RenewPostResult => ({ ok: false, error: "server" }));
      setResult(next);
      if (next.ok) router.refresh();
    });
  }

  return (
    <span className="flex flex-col items-start gap-1.5 sm:items-end">
      <button
        type="button"
        onClick={renew}
        disabled={pending || done}
        aria-busy={pending}
        className={cn(
          "inline-flex items-center font-bold transition-all active:scale-[0.97] disabled:cursor-default",
          compact ? "h-9 gap-1.5 rounded-[9px] px-3 text-[13px]" : "h-10 gap-2 rounded-[10px] px-4 text-[14px]",
          done
            ? "border border-[color-mix(in_oklab,var(--sc-accent)_45%,transparent)] bg-[color-mix(in_oklab,var(--sc-accent)_14%,transparent)] text-[var(--sc-accent)]"
            : "bg-[var(--sc-accent)] text-[var(--sc-accent-ink)] hover:brightness-110 disabled:opacity-70",
        )}
      >
        {pending ? <Loader2Icon className="h-4 w-4 animate-spin" /> : done ? <CheckIcon className="h-4 w-4" /> : <RefreshCwIcon className="h-4 w-4" />}
        <span aria-live="polite">{pending ? t("pending") : done ? t("done") : t("label")}</span>
      </button>
      {result && !result.ok && (
        <span role="alert" className="text-[12.5px] text-red-400">
          {t(`errors.${result.error}`)}
        </span>
      )}
    </span>
  );
}
