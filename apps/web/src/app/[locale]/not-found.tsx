/**
 * GC-Scouting - not-found
 *
 * Localized not found page.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

import { useTranslations } from "next-intl";
import { SearchXIcon } from "lucide-react";
import { Link } from "@/i18n/navigation";

export default function NotFound() {
  const t = useTranslations("errors.notFound");
  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-4 py-24 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-xl border border-neutral-800 bg-[var(--sc-surface)] text-neutral-500">
        <SearchXIcon className="h-6 w-6" />
      </span>
      <p className="mt-5 font-mono text-[13px] font-black tracking-widest text-[var(--sc-accent)]">404</p>
      <h1 className="mt-2 text-[24px] font-bold tracking-tight text-neutral-50">{t("title")}</h1>
      <p className="mt-2 text-[14.5px] text-neutral-500">{t("body")}</p>
      <Link
        href="/posts"
        className="mt-7 inline-flex h-11 items-center rounded-[11px] bg-[var(--sc-accent)] px-5 text-[14.5px] font-bold text-[var(--sc-accent-ink)] transition-all hover:brightness-110 active:scale-[0.97]"
      >
        {t("back")}
      </Link>
    </div>
  );
}
