/**
 * GC-Scouting - tweets page
 *
 * Tweet queue page: posts waiting to be tweeted.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

import type { Metadata } from "next";
import { headers } from "next/headers";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { verifyAccess } from "@/lib/auth/cf-access";
import { fetchPendingTweets } from "@/lib/notify/bot";
import { TweetQueue } from "@/components/tweets/tweet-queue";
import { tweetsLocale } from "./locale";

// Moderators only, behind Cloudflare Access and opened through a proxy over http:
// relative URLs only, no cookie, the Access JWT is the identity.

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations({ locale: await tweetsLocale(), namespace: "tweets" });
  return { title: t("metaTitle"), robots: { index: false, follow: false } };
}

export default async function TweetsPage() {
  const locale = await tweetsLocale();
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "tweets" });
  if (!(await verifyAccess(await headers()))) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <p role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-[14px] text-red-400">
          {t("forbidden")}
        </p>
      </div>
    );
  }
  const tweets = await fetchPendingTweets();

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-[26px] font-bold tracking-tight text-neutral-50">{t("title")}</h1>
      <p className="mt-2 text-[14.5px] text-neutral-500">{t("subtitle")}</p>
      {tweets ? (
        <TweetQueue tweets={tweets} />
      ) : (
        <p role="alert" className="mt-8 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-[14px] text-red-400">
          {t("unavailable")}
        </p>
      )}
    </div>
  );
}
