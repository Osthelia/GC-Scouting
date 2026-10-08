/**
 * GC-Scouting - not-found
 *
 * Not found page for paths outside any locale.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

import { getTranslations } from "next-intl/server";
import { routing } from "@/i18n/routing";
import "./globals.css";

// Paths outside the locale middleware (e.g. with a file extension) have no locale: use the default one.
export default async function RootNotFound() {
  const locale = routing.defaultLocale;
  const t = await getTranslations({ locale, namespace: "errors.notFound" });
  return (
    <html lang={locale}>
      <body className="flex min-h-screen flex-col items-center justify-center bg-[var(--sc-bg)] px-4 text-center font-sans text-[var(--sc-text)] antialiased">
        <p className="font-mono text-[13px] font-black tracking-widest text-[var(--sc-accent)]">404</p>
        <h1 className="mt-2 text-[24px] font-bold tracking-tight text-neutral-50">{t("title")}</h1>
        <p className="mt-2 text-[14.5px] text-neutral-500">{t("body")}</p>
        <a
          href={`/${locale}/posts`}
          className="mt-7 inline-flex h-11 items-center rounded-[11px] bg-[var(--sc-accent)] px-5 text-[14.5px] font-bold text-[var(--sc-accent-ink)] transition-all hover:brightness-110 active:scale-[0.97]"
        >
          {t("back")}
        </a>
      </body>
    </html>
  );
}
