/**
 * GC-Scouting - posts new page
 *
 * New post page: type choice then the post form.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { and, eq, isNull } from "drizzle-orm";
import { ArrowRightIcon, InfoIcon } from "lucide-react";
import { db } from "@scouting/db/client";
import { posts, SINGLE_ACTIVE_POST_TYPES, type PostType } from "@scouting/db";
import type { AppLocale } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { getActiveProfile, type ActiveProfile } from "@/lib/auth/session";
import { isPostType } from "@/lib/post-types";
import { FORM_SECTIONS } from "@/lib/post-form";
import { formAccountChannels } from "@/lib/post-form-account";
import { PostTypeBadge, ProfileBadge } from "@/components/post/badges";
import { LoginGate } from "@/components/auth/login-gate";
import { PostForm } from "@/components/post-form/post-form";
import { PostTypeTabs } from "@/components/post-form/post-type-tabs";
import { PlayerLinkWizard } from "@/components/auth/player-link-wizard";

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<{ type?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as AppLocale, namespace: "newPost" });
  return { title: t("title"), robots: { index: false } };
}

export default async function NewPostPage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { type: rawType } = await searchParams;
  const type = rawType && isPostType(rawType) ? rawType : "lft";
  const t = await getTranslations("newPost");
  const user = await getActiveProfile();

  return (
    <div className="mx-auto max-w-[960px] px-4 py-8 sm:px-6 sm:py-10">
      <div className="mb-7">
        <h1 className="flex flex-wrap items-center gap-3 text-[28px] font-bold tracking-tight text-neutral-50 sm:text-[34px]">
          <PostTypeBadge type={type} className="text-[14px]" />
          {t("title")}
        </h1>
        <p className="mt-2 max-w-2xl text-[14.5px] leading-relaxed text-neutral-500">{t(`intro.${type}`)}</p>
      </div>

      <div className="mb-6">
        <PostTypeTabs active={type} />
      </div>

      {user ? (
        <FormStep type={type} user={user} />
      ) : (
        <LoginGate title={t("login.title")} text={t("login.text")} cta={t("login.cta")} next={`/${locale}/posts/new?type=${type}`} />
      )}
    </div>
  );
}

async function FormStep({ type, user }: { type: PostType; user: ActiveProfile }) {
  const t = await getTranslations("newPost");
  const tAuth = await getTranslations("auth.profile");

  const [channels, [existing]] = await Promise.all([
    formAccountChannels(user),
    (SINGLE_ACTIVE_POST_TYPES as readonly PostType[]).includes(type)
      ? db
          .select({ id: posts.id, expiresAt: posts.expiresAt })
          .from(posts)
          .where(and(eq(posts.authorId, user.id), eq(posts.type, type), eq(posts.status, "active"), isNull(posts.deletedAt)))
          .limit(1)
      : Promise.resolve([]),
  ]);

  if (existing && existing.expiresAt > new Date()) {
    return (
      <div className="flex flex-col items-start gap-4 rounded-2xl border border-neutral-800 bg-[var(--sc-surface)] p-6">
        <div className="flex items-start gap-3">
          <InfoIcon className="mt-0.5 h-5 w-5 flex-none text-[var(--sc-accent)]" />
          <div>
            <p className="text-[15px] font-semibold text-neutral-100">{t("activeExists.title", { code: type.toUpperCase() })}</p>
            <p className="mt-1 text-[13.5px] text-neutral-500">{t("activeExists.text")}</p>
          </div>
        </div>
        <Link
          href={`/posts/${type}/${existing.id}`}
          className="inline-flex h-10 items-center gap-2 rounded-[10px] bg-[var(--sc-accent)] px-4 text-[14px] font-bold text-[var(--sc-accent-ink)] transition-all hover:brightness-110 active:scale-[0.97]"
        >
          {t("viewExisting")}
          <ArrowRightIcon className="h-4 w-4" />
        </Link>
      </div>
    );
  }

  const playerType = type === "lft" || type === "lfst";
  // Only the owner can claim a GC Stats profile.
  const linkPrompt = user.delegated ? (
    <div className="mb-5 flex items-start gap-2.5 rounded-xl border border-neutral-800 bg-[var(--sc-surface-2)] px-4 py-3 text-[13px] text-neutral-400">
      <InfoIcon className="mt-0.5 h-4 w-4 flex-none text-neutral-500" />
      {t("delegatedNoProfile", { name: user.username })}
    </div>
  ) : null;
  // Linking a team page needs a linked profile on its roster.
  const teamLink = FORM_SECTIONS[type].includes("teamLink");

  return (
    <>
      {playerType && user.profile && (
        <div className="mb-5 flex flex-wrap items-center gap-2 rounded-xl border border-neutral-800 bg-[var(--sc-surface-2)] px-4 py-3 text-[13px] text-neutral-400">
          <ProfileBadge status={user.profile.status} />
          <span>{tAuth(user.profile.status)}</span>
        </div>
      )}
      {(playerType || teamLink) && !user.profile &&
        (linkPrompt ?? (
          <div className="mb-5">
            <PlayerLinkWizard reason={playerType ? undefined : "team"} />
          </div>
        ))}
      <PostForm
        key={type}
        type={type}
        account={{
          username: user.username,
          delegated: user.delegated,
          defaultRegion: null,
          ...channels,
          replacesExpired: !!existing,
        }}
      />
    </>
  );
}
