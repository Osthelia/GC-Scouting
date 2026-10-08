/**
 * GC-Scouting - manage token page
 *
 * Post management page opened from a private link.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { LinkIcon, RefreshCwIcon, Trash2Icon } from "lucide-react";
import type { AppLocale } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { readActionToken } from "@/lib/post-expiry";
import { PostTypeBadge } from "@/components/post/badges";
import { ActionTokenConfirm } from "@/components/post/action-token-confirm";

type Params = Promise<{ locale: string; token: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as AppLocale, namespace: "expiry.manage" });
  // The token is in the URL: never indexed, never sent as a referrer.
  return { title: t("metaTitle"), robots: { index: false, follow: false }, referrer: "no-referrer" };
}

export default async function ManagePostPage({ params }: { params: Params }) {
  const { locale, token } = await params;
  setRequestLocale(locale as AppLocale);
  const t = await getTranslations({ locale: locale as AppLocale, namespace: "expiry.manage" });
  const read = await readActionToken(token);

  if (!read.ok) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center px-4 py-24 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-xl border border-neutral-800 bg-[var(--sc-surface)] text-neutral-400">
          <LinkIcon className="h-6 w-6" />
        </span>
        <h1 className="mt-5 text-[24px] font-bold tracking-tight text-neutral-50">{t("errorTitle")}</h1>
        <p className="mt-2 text-[14.5px] text-neutral-500">{t(`errors.${read.error}`)}</p>
        <Link
          href="/"
          className="mt-7 inline-flex h-11 items-center rounded-[11px] border border-neutral-800 bg-[var(--sc-surface)] px-5 text-[14.5px] font-semibold text-neutral-200 transition-all hover:bg-[var(--sc-hover)] active:scale-[0.97]"
        >
          {t("home")}
        </Link>
      </div>
    );
  }

  const { action, post } = read.info;
  const expired = post.expiresAt <= new Date();
  const Icon = action === "renew" ? RefreshCwIcon : Trash2Icon;

  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-4 py-24 text-center">
      <span
        className={
          action === "renew"
            ? "flex h-12 w-12 items-center justify-center rounded-xl border border-neutral-800 bg-[var(--sc-surface)] text-[var(--sc-accent)]"
            : "flex h-12 w-12 items-center justify-center rounded-xl border border-red-500/30 bg-red-500/10 text-red-400"
        }
      >
        <Icon className="h-6 w-6" />
      </span>
      <h1 className="mt-5 text-[24px] font-bold tracking-tight text-neutral-50">{t(`${action}.title`)}</h1>
      <p className="mt-3 inline-flex items-center gap-2 text-[15px] font-semibold text-neutral-200">
        <PostTypeBadge type={post.type} />
        {post.displayName}
      </p>
      <p className="mt-3 text-[14.5px] text-neutral-500">{t(`${action}.text`, { expired: String(expired) })}</p>
      <div className="mt-7">
        <ActionTokenConfirm token={token} action={action} postHref={`/posts/${post.type}/${post.id}`} />
      </div>
    </div>
  );
}
