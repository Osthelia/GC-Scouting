/**
 * GC-Scouting - auth error page
 *
 * Page shown when the login flow fails, with the reason.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ShieldAlertIcon } from "lucide-react";
import type { AppLocale } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { LoginLink } from "@/components/auth/login-link";

const REASONS = ["denied", "state", "exchange", "provider", "config"] as const;
type Reason = (typeof REASONS)[number];

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as AppLocale, namespace: "auth.error" });
  return { title: t("title"), robots: { index: false } };
}

export default async function AuthErrorPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ reason?: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale as AppLocale);
  const { reason: raw } = await searchParams;
  const reason: Reason = REASONS.includes(raw as Reason) ? (raw as Reason) : "provider";
  const t = await getTranslations({ locale: locale as AppLocale, namespace: "auth.error" });

  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-4 py-24 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-xl border border-neutral-800 bg-[var(--sc-surface)] text-[var(--sc-accent)]">
        <ShieldAlertIcon className="h-6 w-6" />
      </span>
      <h1 className="mt-5 text-[24px] font-bold tracking-tight text-neutral-50">{t("title")}</h1>
      <p className="mt-2 text-[14.5px] text-neutral-500">{t(`reasons.${reason}`)}</p>
      <div className="mt-7 flex flex-wrap items-center justify-center gap-2.5">
        {reason !== "config" && <LoginLink label={t("retry")} next={`/${locale}`} />}
        <Link
          href="/"
          className="inline-flex h-11 items-center rounded-[11px] border border-neutral-800 bg-[var(--sc-surface)] px-5 text-[14.5px] font-semibold text-neutral-200 transition-all hover:bg-[var(--sc-hover)] active:scale-[0.97]"
        >
          {t("home")}
        </Link>
      </div>
    </div>
  );
}
