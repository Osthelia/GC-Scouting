/**
 * GC-Scouting - admin tweets page
 *
 * Admin tweet queue: posts waiting to be tweeted or retweeted.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { requireAdmin } from "@/lib/admin/access";
import { adminMetadata } from "@/lib/admin/metadata";
import { fetchPendingTweets } from "@/lib/notify/bot";
import { AdminPageHeader } from "@/components/admin/admin-common";
import { TweetQueue } from "@/components/admin/tweet-queue";

type Props = { params: Promise<{ locale: string }> };

export function generateMetadata({ params }: Props): Promise<Metadata> {
  return adminMetadata(params, "tweets", { adminOnly: true });
}

export default async function AdminTweetsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireAdmin(locale);
  const t = await getTranslations("admin.tweets");
  const tweets = await fetchPendingTweets();

  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader title={t("title")} subtitle={t("subtitle")} />
      {tweets ? (
        <TweetQueue tweets={tweets} />
      ) : (
        <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {t("unavailable")}
        </p>
      )}
    </div>
  );
}
