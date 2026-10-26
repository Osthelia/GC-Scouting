/**
 * GC-Scouting - invite token page
 *
 * Page where an invited person accepts a delegation.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { LinkIcon } from "lucide-react";
import type { AppLocale } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { readInvite } from "@/lib/auth/delegations";
import { LoginGate } from "@/components/auth/login-gate";
import { UserAvatar } from "@/components/auth/user-menu";
import { InviteAccept } from "@/components/account/invite-accept";

type Params = Promise<{ locale: string; token: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as AppLocale, namespace: "invite" });
  // The token is in the URL: never indexed, never sent as a referrer.
  return { title: t("metaTitle"), robots: { index: false, follow: false }, referrer: "no-referrer" };
}

export default async function InvitePage({ params }: { params: Params }) {
  const { locale, token } = await params;
  setRequestLocale(locale as AppLocale);
  const t = await getTranslations("invite");
  const user = await getCurrentUser();
  const read = await readInvite(token, user?.id ?? null);

  if (!read.ok) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center px-4 py-24 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-xl border border-neutral-800 bg-[var(--sc-surface)] text-neutral-400">
          <LinkIcon className="h-6 w-6" />
        </span>
        <h1 className="mt-5 text-[24px] font-bold tracking-tight text-neutral-50">{t("errorTitle")}</h1>
        <p className="mt-2 text-[14.5px] text-neutral-500">{t(`errors.${read.error}`)}</p>
        <Link
          href={read.error === "self" ? "/account" : "/"}
          className="mt-7 inline-flex h-11 items-center rounded-[11px] border border-neutral-800 bg-[var(--sc-surface)] px-5 text-[14.5px] font-semibold text-neutral-200 transition-all hover:bg-[var(--sc-hover)] active:scale-[0.97]"
        >
          {t(read.error === "self" ? "settings" : "home")}
        </Link>
      </div>
    );
  }

  const { owner } = read;
  if (!user) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16">
        <LoginGate title={t("title", { name: owner.username })} text={t("loginText")} cta={t("loginCta")} next={`/${locale}/invite/${token}`} />
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-4 py-24 text-center">
      <UserAvatar user={owner} size={56} />
      <h1 className="mt-5 text-[24px] font-bold tracking-tight text-neutral-50">{t("title", { name: owner.username })}</h1>
      <p className="mt-3 text-[14.5px] leading-relaxed text-neutral-500">{t("text", { name: owner.username })}</p>
      <div className="mt-7">
        <InviteAccept token={token} owner={owner.username} />
      </div>
    </div>
  );
}
