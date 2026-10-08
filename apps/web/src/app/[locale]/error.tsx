/**
 * GC-Scouting - root error
 *
 * Error boundary of the localized site.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

"use client";

import { useEffect, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Loader2, TriangleAlertIcon } from "lucide-react";
import { Link } from "@/i18n/navigation";

export default function LocaleError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const t = useTranslations("errors.serverError");
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-4 py-24 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-xl border border-neutral-800 bg-[var(--sc-surface)] text-neutral-500">
        <TriangleAlertIcon className="h-6 w-6" />
      </span>
      <p className="mt-5 font-mono text-[13px] font-black tracking-widest text-[var(--sc-accent)]">500</p>
      <h1 className="mt-2 text-[24px] font-bold tracking-tight text-neutral-50">{t("title")}</h1>
      <p className="mt-2 text-[14.5px] text-neutral-500">{t("body")}</p>
      <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          disabled={pending}
          onClick={() => startTransition(retry)}
          className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-[11px] bg-[var(--sc-accent)] px-5 text-[14.5px] font-bold text-[var(--sc-accent-ink)] transition-all hover:brightness-110 active:scale-[0.97] disabled:cursor-wait disabled:opacity-70"
        >
          {pending && <Loader2 className="h-4 w-4 animate-spin" />}
          {t("retry")}
        </button>
        <Link
          href="/posts"
          className="inline-flex h-11 items-center rounded-[11px] border border-neutral-800 bg-[var(--sc-surface)] px-5 text-[14.5px] font-semibold text-neutral-200 transition-all hover:bg-[var(--sc-hover)] active:scale-[0.97]"
        >
          {t("back")}
        </Link>
      </div>
    </div>
  );
}
