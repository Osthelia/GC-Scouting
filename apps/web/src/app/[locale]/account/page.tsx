/**
 * GC-Scouting - account page
 *
 * Account settings page.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ExternalLinkIcon } from "lucide-react";
import type { AppLocale } from "@/i18n/routing";
import { getActiveProfile, getCurrentUser } from "@/lib/auth/session";
import { delegationOverview, DELEGATES_MAX, DELEGATION_INVITE_TTL_DAYS } from "@/lib/auth/delegations";
import { GCS_URL } from "@/lib/gcs";
import { LoginGate } from "@/components/auth/login-gate";
import { UserAvatar } from "@/components/auth/user-menu";
import { ProfileBadge } from "@/components/post/badges";
import { DelegationsPanel } from "@/components/account/delegations-panel";
import { DataPanel } from "@/components/account/data-panel";
import { ChatNotificationsPanel } from "@/components/account/chat-notifications-panel";
import { eq } from "drizzle-orm";
import { db } from "@scouting/db/client";
import { users } from "@scouting/db";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as AppLocale, namespace: "account" });
  return { title: t("title"), robots: { index: false } };
}

export default async function AccountPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale as AppLocale);
  const t = await getTranslations("account");
  const tAuth = await getTranslations("auth.profile");
  const [user, active] = await Promise.all([getCurrentUser(), getActiveProfile()]);
  const [overview, [prefs]] = user
    ? await Promise.all([
        delegationOverview(user.id),
        db
          .select({ email: users.email, discordId: users.discordId, chatEmail: users.chatNotifyEmail, chatDiscord: users.chatNotifyDiscord })
          .from(users)
          .where(eq(users.id, user.id))
          .limit(1),
      ])
    : [null, []];

  return (
    <div className="mx-auto max-w-[860px] px-4 py-8 sm:px-6 sm:py-10">
      <h1 className="text-[28px] font-bold tracking-tight text-neutral-50 sm:text-[34px]">{t("title")}</h1>
      <p className="mt-2 max-w-2xl text-[14.5px] leading-relaxed text-neutral-500">{t("intro")}</p>

      <div className="mt-7 flex flex-col gap-5">
        {user && overview ? (
          <>
            <section className="flex flex-wrap items-center gap-4 rounded-2xl border border-neutral-800 bg-[var(--sc-surface)] p-4 sm:p-6">
              <UserAvatar user={user} size={48} />
              <div className="min-w-0 flex-1 basis-48">
                <p className="truncate text-[17px] font-bold text-neutral-50">{user.username}</p>
                <p className="mt-1 flex items-center gap-2 text-[13px] text-neutral-500">
                  {user.profile && <ProfileBadge status={user.profile.status} />}
                  {tAuth(user.profile?.status ?? "none")}
                </p>
              </div>
              <a
                href={`${GCS_URL}/${locale}/settings/account`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-10 items-center gap-2 rounded-[10px] border border-neutral-800 bg-[var(--sc-surface-2)] px-4 text-[13.5px] font-semibold text-neutral-200 transition-all hover:bg-[var(--sc-hover)] active:scale-[0.97]"
              >
                <ExternalLinkIcon className="h-4 w-4" />
                {t("gcsAccount")}
              </a>
            </section>
            {prefs && (
              <ChatNotificationsPanel initial={{ email: !!prefs.email && prefs.chatEmail, discord: !!prefs.discordId && prefs.chatDiscord }} email={prefs.email} hasDiscord={!!prefs.discordId} />
            )}
            <DelegationsPanel overview={overview} activeId={active?.id ?? user.id} limits={{ delegates: DELEGATES_MAX, inviteDays: DELEGATION_INVITE_TTL_DAYS }} />
            <DataPanel username={user.username} />
          </>
        ) : (
          <LoginGate title={t("login.title")} text={t("login.text")} cta={t("login.cta")} next={`/${locale}/account`} />
        )}
      </div>
    </div>
  );
}
