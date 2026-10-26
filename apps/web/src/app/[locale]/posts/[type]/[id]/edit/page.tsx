/**
 * GC-Scouting - id edit page
 *
 * Post edit page.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ArrowLeftIcon, LockIcon, ShieldIcon } from "lucide-react";
import type { AppLocale } from "@/i18n/routing";
import { Link, redirect } from "@/i18n/navigation";
import { getActiveProfile, type ActiveProfile } from "@/lib/auth/session";
import { getStaffUser } from "@/lib/admin/access";
import { getPost, isPostAuthor } from "@/lib/posts-query";
import { parseId } from "@scouting/db";
import type { PostView } from "@/lib/posts";
import { isPostType } from "@/lib/post-types";
import { postToFormValues } from "@/lib/post-form";
import { formAccountChannels } from "@/lib/post-form-account";
import { PostTypeBadge } from "@/components/post/badges";
import { LoginGate } from "@/components/auth/login-gate";
import { PostForm } from "@/components/post-form/post-form";

type Props = { params: Promise<{ locale: string; type: string; id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as AppLocale, namespace: "newPost" });
  return { title: t("editTitle"), robots: { index: false } };
}

export default async function EditPostPage({ params }: Props) {
  const { locale, type, id } = await params;
  setRequestLocale(locale);
  const postId = parseId(id);
  if (!postId || !isPostType(type)) notFound();

  const t = await getTranslations("newPost");
  const user = await getActiveProfile();
  if (!user) {
    return (
      <div className="mx-auto max-w-[960px] px-4 py-8 sm:px-6 sm:py-10">
        <LoginGate title={t("login.title")} text={t("login.text")} cta={t("login.cta")} next={`/${locale}/posts/${type}/${postId}/edit`} />
      </div>
    );
  }

  const [post, isAuthor, staff] = await Promise.all([getPost(postId), isPostAuthor(postId, user.id), getStaffUser()]);
  // Someone else's post is not revealed as existing, the staff edits it in moderation.
  if (!post || (!isAuthor && !staff)) notFound();
  if (post.type !== type) redirect({ href: `/posts/${post.type}/${post.id}/edit`, locale });

  return (
    <div className="mx-auto max-w-[960px] px-4 py-8 sm:px-6 sm:py-10">
      <Link
        href={`/posts/${post.type}/${post.id}`}
        className="inline-flex items-center gap-1.5 rounded-md py-1 text-[13px] font-semibold text-neutral-500 transition-colors hover:text-neutral-100 active:opacity-70"
      >
        <ArrowLeftIcon className="h-4 w-4" />
        {t("backToPost")}
      </Link>
      <div className="mt-4 mb-7">
        <h1 className="flex flex-wrap items-center gap-3 text-[28px] font-bold tracking-tight text-neutral-50 sm:text-[34px]">
          <PostTypeBadge type={post.type} className="text-[14px]" />
          {t("editTitle")}
        </h1>
        <p className="mt-2 max-w-2xl text-[14.5px] leading-relaxed text-neutral-500">{t("editIntro")}</p>
      </div>

      {!isAuthor && (
        <div className="mb-5 flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3.5">
          <ShieldIcon className="mt-0.5 h-4 w-4 flex-none text-amber-400" />
          <div>
            <p className="text-[14px] font-semibold text-amber-100">{t("moderationTitle")}</p>
            <p className="mt-0.5 text-[13px] text-amber-200/80">{t("moderationText", { name: post.displayName })}</p>
          </div>
        </div>
      )}

      {post.status === "active" ? (
        isAuthor ? (
          <EditForm post={post} user={user} locale={locale} />
        ) : (
          <PostForm
            type={post.type}
            account={{ username: post.displayName, delegated: false, defaultRegion: post.region, email: null, hasDiscord: false, discordId: null, notifyEmail: false, notifyDiscord: false, replacesExpired: false }}
            edit={{ postId: post.id, tweeted: post.tweeted, moderation: true, values: postToFormValues(post, locale, { notifyEmail: false, notifyDiscord: false }) }}
          />
        )
      ) : (
        <div className="flex items-start gap-3 rounded-2xl border border-neutral-800 bg-[var(--sc-surface)] p-6">
          <LockIcon className="mt-0.5 h-5 w-5 flex-none text-neutral-400" />
          <div>
            <p className="text-[15px] font-semibold text-neutral-100">{t("closedTitle")}</p>
            <p className="mt-1 text-[13.5px] text-neutral-500">{t("closedText")}</p>
          </div>
        </div>
      )}
    </div>
  );
}

async function EditForm({ post, user, locale }: { post: PostView; user: ActiveProfile; locale: string }) {
  const channels = await formAccountChannels(user);
  return (
    <PostForm
      type={post.type}
      account={{ username: user.username, delegated: user.delegated, defaultRegion: post.region, ...channels, replacesExpired: false }}
      edit={{ postId: post.id, tweeted: post.tweeted, values: postToFormValues(post, locale, { notifyEmail: channels.notifyEmail, notifyDiscord: channels.notifyDiscord }) }}
    />
  );
}
