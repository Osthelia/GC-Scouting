/**
 * GC-Scouting - messages page
 *
 * Messages page shown when no conversation is selected.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { MessageSquareIcon } from "lucide-react";
import type { AppLocale } from "@/i18n/routing";
import { StaffNotice } from "@/components/chat/chat-composer";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as AppLocale, namespace: "chat" });
  return { title: t("title"), robots: { index: false } };
}

/** Desktop placeholder, the list fills the screen on mobile. */
export default async function MessagesPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("chat");

  return (
    <div className="hidden min-w-0 flex-1 flex-col items-center justify-center px-6 text-center lg:flex">
      <span className="flex h-12 w-12 items-center justify-center rounded-xl border border-neutral-800 bg-[var(--sc-surface)] text-[var(--sc-accent)]">
        <MessageSquareIcon className="h-5 w-5" />
      </span>
      <p className="mt-4 text-[16px] font-bold text-neutral-50">{t("pick.title")}</p>
      <p className="mt-1.5 max-w-sm text-[13.5px] leading-relaxed text-neutral-500">{t("pick.text")}</p>
      <StaffNotice className="mt-6 max-w-sm justify-center" />
    </div>
  );
}
