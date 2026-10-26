/**
 * GC-Scouting - me page
 *
 * List of the posts of the active profile, grouped by status.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { useFormatter, useTranslations } from "next-intl";
import { eq } from "drizzle-orm";
import { BellOffIcon, FileTextIcon, PlusIcon } from "lucide-react";
import { db } from "@scouting/db/client";
import { users, POST_LIFETIME_DAYS } from "@scouting/db";
import type { AppLocale } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { getActiveProfile } from "@/lib/auth/session";
import { listAuthorPosts } from "@/lib/posts-query";
import { canRenew } from "@/lib/post-expiry";
import { REGION_COLOR } from "@/lib/regions";
import type { PostView } from "@/lib/posts";
import { LoginGate } from "@/components/auth/login-gate";
import { PostTypeBadge } from "@/components/post/badges";
import { PostAuthorActions } from "@/components/post/post-author-actions";
import { RenewPostButton } from "@/components/post/renew-post-button";

type Props = { params: Promise<{ locale: string }> };
type Group = "active" | "expired" | "closed";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as AppLocale, namespace: "myPosts" });
  return { title: t("title"), robots: { index: false } };
}

export default async function MyPostsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("myPosts");
  const tExpiry = await getTranslations("expiry.noReminder");
  const user = await getActiveProfile();

  if (!user) {
    return (
      <div className="mx-auto max-w-[960px] px-4 py-8 sm:px-6 sm:py-10">
        <LoginGate title={t("login.title")} text={t("login.text")} cta={t("login.cta")} next={`/${locale}/me`} />
      </div>
    );
  }

  const [list, [reminders]] = await Promise.all([
    listAuthorPosts(user.id),
    db.select({ email: users.notifyEmail, discord: users.notifyDiscord }).from(users).where(eq(users.id, user.id)).limit(1),
  ]);
  const now = new Date();
  const groups: Record<Group, PostView[]> = { active: [], expired: [], closed: [] };
  for (const post of list) {
    groups[post.status === "closed" ? "closed" : new Date(post.expiresAt) <= now ? "expired" : "active"].push(post);
  }
  const noReminder = reminders && !reminders.email && !reminders.discord && groups.active.length + groups.expired.length > 0;

  return (
    <div className="mx-auto max-w-[960px] px-4 py-8 sm:px-6 sm:py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-bold tracking-tight text-neutral-50 sm:text-[34px]">{t("title")}</h1>
          <p className="mt-2 max-w-2xl text-[14.5px] leading-relaxed text-neutral-500">{t("intro", { days: POST_LIFETIME_DAYS })}</p>
        </div>
        <Link
          href="/posts/new"
          className="inline-flex h-10 items-center gap-2 rounded-[10px] bg-[var(--sc-accent)] px-4 text-[14px] font-bold text-[var(--sc-accent-ink)] transition-all hover:brightness-110 active:scale-[0.97]"
        >
          <PlusIcon className="h-4 w-4" />
          {t("new")}
        </Link>
      </div>

      {noReminder && (
        <div className="mt-6 flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3.5">
          <BellOffIcon className="mt-0.5 h-4 w-4 flex-none text-amber-400" />
          <div>
            <p className="text-[14px] font-semibold text-neutral-100">{tExpiry("title")}</p>
            <p className="mt-0.5 text-[13px] text-neutral-400">{tExpiry("text", { days: POST_LIFETIME_DAYS })}</p>
          </div>
        </div>
      )}

      {list.length === 0 ? (
        <div className="mt-7 flex flex-col items-center rounded-2xl border border-neutral-800 bg-[var(--sc-surface)] px-6 py-12 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl border border-neutral-800 bg-[var(--sc-surface-2)] text-[var(--sc-accent)]">
            <FileTextIcon className="h-5 w-5" />
          </span>
          <p className="mt-5 text-[17px] font-bold text-neutral-50">{t("empty.title")}</p>
          <p className="mt-2 max-w-md text-[14px] text-neutral-500">{t("empty.text")}</p>
        </div>
      ) : (
        <div className="mt-7 flex flex-col gap-8">
          {(["active", "expired", "closed"] as const).map(
            (group) =>
              groups[group].length > 0 && (
                <section key={group}>
                  <h2 className="mb-3 text-[11.5px] font-semibold tracking-[0.12em] text-neutral-500 uppercase">
                    {t(`groups.${group}`)} <span className="text-neutral-600">({groups[group].length})</span>
                  </h2>
                  <div className="flex flex-col gap-2.5">
                    {groups[group].map((post) => (
                      <MyPostRow key={post.id} post={post} group={group} now={now} />
                    ))}
                  </div>
                </section>
              ),
          )}
        </div>
      )}
    </div>
  );
}

function MyPostRow({ post, group, now }: { post: PostView; group: Group; now: Date }) {
  const t = useTranslations("myPosts");
  const tRegions = useTranslations("regions");
  const format = useFormatter();
  const expiresAt = new Date(post.expiresAt);

  return (
    <article
      className="flex flex-col gap-3 rounded-xl border border-neutral-800 bg-[var(--sc-surface)] px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between"
      style={{ borderLeft: `3px solid ${REGION_COLOR[post.region]}` }}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <PostTypeBadge type={post.type} />
          <Link
            href={`/posts/${post.type}/${post.id}`}
            className="truncate text-[15px] font-semibold text-neutral-100 transition-colors hover:text-[var(--sc-accent)] active:opacity-70"
          >
            {post.displayName}
          </Link>
        </div>
        <p className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[12.5px] text-neutral-500">
          <span>{tRegions(post.region)}</span>
          <span>{t("published", { date: format.relativeTime(new Date(post.publishedAt), now) })}</span>
          {group === "active" && <span>{t("expires", { date: format.relativeTime(expiresAt, now) })}</span>}
          {group === "expired" && <span className="text-amber-400">{t("expired", { date: format.relativeTime(expiresAt, now) })}</span>}
        </p>
      </div>
      {group !== "closed" && (
        <div className="flex flex-wrap items-start gap-2 sm:justify-end">
          {canRenew(expiresAt, now) && <RenewPostButton postId={post.id} compact />}
          <PostAuthorActions postId={post.id} type={post.type} />
        </div>
      )}
    </article>
  );
}
