/**
 * GC-Scouting - action-token-confirm
 *
 * Confirmation screen for the renew and delete links.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { CheckIcon, Loader2Icon, RefreshCwIcon, Trash2Icon } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { confirmActionToken, type ConfirmActionResult } from "@/actions/post-expiry";
import { useViewerTimezone } from "@/lib/preferences";
import { cn } from "@/lib/utils";

/** Confirm button of a reminder link: the action only runs on click, never on page load. */
export function ActionTokenConfirm({ token, action, postHref }: { token: string; action: "renew" | "delete"; postHref: string }) {
  const t = useTranslations("expiry.manage");
  const timezone = useViewerTimezone();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<ConfirmActionResult | null>(null);

  function confirm() {
    startTransition(async () => {
      setResult(await confirmActionToken(token).catch((): ConfirmActionResult => ({ ok: false, error: "server" })));
    });
  }

  if (result?.ok) {
    const date =
      result.action === "renew"
        ? new Intl.DateTimeFormat(undefined, { dateStyle: "long", timeStyle: "short", timeZone: timezone ?? undefined }).format(new Date(result.expiresAt))
        : null;
    return (
      <div className="flex flex-col items-center gap-5">
        <p role="status" className="inline-flex items-center gap-2 text-[14.5px] font-semibold text-[var(--sc-accent)]">
          <CheckIcon className="h-4 w-4" />
          {result.action === "renew" ? t("renew.done", { date: date! }) : t("delete.done")}
        </p>
        <Link
          href={result.action === "renew" ? result.href : "/posts/new"}
          className="inline-flex h-11 items-center rounded-[11px] bg-[var(--sc-accent)] px-5 text-[14.5px] font-bold text-[var(--sc-accent-ink)] transition-all hover:brightness-110 active:scale-[0.97]"
        >
          {result.action === "renew" ? t("view") : t("newPost")}
        </Link>
      </div>
    );
  }

  const Icon = action === "renew" ? RefreshCwIcon : Trash2Icon;
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex flex-wrap items-center justify-center gap-2.5">
        <button
          type="button"
          onClick={confirm}
          disabled={pending}
          aria-busy={pending}
          className={cn(
            "inline-flex h-11 items-center gap-2 rounded-[11px] px-5 text-[14.5px] font-semibold transition-all active:scale-[0.97] disabled:cursor-wait disabled:opacity-70",
            action === "renew"
              ? "bg-[var(--sc-accent)] font-bold text-[var(--sc-accent-ink)] hover:brightness-110"
              : "border border-red-500/40 bg-red-500/10 text-red-400 hover:bg-red-500/20",
          )}
        >
          {pending ? <Loader2Icon className="h-4 w-4 animate-spin" /> : <Icon className="h-4 w-4" />}
          {pending ? t(`${action}.pending`) : t(`${action}.confirm`)}
        </button>
        <Link
          href={postHref}
          className="inline-flex h-11 items-center rounded-[11px] border border-neutral-800 bg-[var(--sc-surface)] px-5 text-[14.5px] font-semibold text-neutral-200 transition-all hover:bg-[var(--sc-hover)] active:scale-[0.97]"
        >
          {t("view")}
        </Link>
      </div>
      {result && !result.ok && (
        <p role="alert" className="text-[13px] text-red-400">
          {t(`errors.${result.error}`)}
        </p>
      )}
    </div>
  );
}
