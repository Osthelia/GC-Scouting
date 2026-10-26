/**
 * GC-Scouting - tweet-queue
 *
 * Queue of the tweets to send, with the tweet text editor.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

"use client";

import { useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { AlertTriangleIcon, CheckIcon, ExternalLinkIcon, Loader2Icon, Repeat2Icon } from "lucide-react";
import { retweetIntentUrl, tweetIntentUrl, tweetStatusUrl } from "@scouting/db/twitter";
import { Link } from "@/i18n/navigation";
import type { PendingTweet } from "@/lib/notify/bot";
import { PostTypeBadge } from "@/components/post/badges";
import { TweetImageButton } from "@/components/tweets/tweet-image-button";
import { cn } from "@/lib/utils";

const TWEET_MAX = 280;

type MarkError = "unauthorized" | "forbidden" | "invalid" | "notFound" | "alreadyTweeted" | "awaitingAuthor" | "unavailable" | "network";

const button = "inline-flex h-9 items-center gap-1.5 rounded-[9px] border px-3 text-[13px] font-semibold transition-all active:scale-[0.97] disabled:opacity-70";

function TweetCard({ tweet, onDone }: { tweet: PendingTweet; onDone(): void }) {
  const t = useTranslations("tweets");
  const tRegions = useTranslations("regions");
  const format = useFormatter();
  const [opened, setOpened] = useState(false);
  const [state, setState] = useState<"idle" | "pending" | "done">("idle");
  const [error, setError] = useState<MarkError | null>(null);

  async function markPublished() {
    setState("pending");
    setError(null);
    try {
      const response = await fetch(`/tweets/${tweet.id}`, { method: "POST" });
      const body = (await response.json().catch(() => ({}))) as { ok?: boolean; error?: MarkError };
      if (body.ok || body.error === "alreadyTweeted") {
        setState("done");
        if (body.error) setError(body.error);
        onDone();
        return;
      }
      setError(body.error ?? "unavailable");
    } catch {
      setError("network");
    }
    setState("idle");
  }

  const done = state === "done";
  // Tweeted by its author: we retweet it.
  const retweet = tweet.authorTweetId;

  return (
    <li
      id={`post-${tweet.id}`}
      className={cn(
        "scroll-mt-24 rounded-xl border border-neutral-800 bg-[var(--sc-surface)] p-4 transition-opacity target:border-[var(--sc-accent)]",
        done && "opacity-60"
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <PostTypeBadge type={tweet.type} />
        <span className="font-semibold text-neutral-100">{tweet.displayName}</span>
        <span className="text-[13px] text-neutral-500">{tRegions(tweet.region)}</span>
        <span className="text-[13px] text-neutral-500">{t("published", { date: format.relativeTime(new Date(tweet.publishedAt), new Date()) })}</span>
        <Link href={`/posts/${tweet.type}/${tweet.id}`} target="_blank" className="ml-auto text-[13px] font-medium text-[var(--sc-accent)] hover:underline active:opacity-70">
          {t("viewPost")}
        </Link>
      </div>

      {retweet ? (
        <p className="mt-3 text-[13.5px] text-neutral-400">{t("authorTweeted")}</p>
      ) : (
        <>
          <pre className="mt-3 rounded-lg border border-neutral-800 bg-[var(--sc-surface-2)] p-3 font-sans text-[14px] whitespace-pre-wrap text-neutral-200">{tweet.text}</pre>

          <p className={cn("mt-2 inline-flex items-center gap-1.5 text-[12.5px]", tweet.tooLong ? "text-amber-400" : "text-neutral-500")}>
            {tweet.tooLong && <AlertTriangleIcon className="h-3.5 w-3.5" />}
            {t("length", { length: tweet.length, max: TWEET_MAX })}
            {tweet.tooLong && <span>{t("tooLong")}</span>}
          </p>
        </>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {retweet && (
          <a href={tweetStatusUrl(retweet)} target="_blank" rel="noopener noreferrer" className={cn(button, "border-neutral-800 bg-[var(--sc-surface)] text-neutral-200 hover:bg-[var(--sc-hover)]")}>
            <ExternalLinkIcon className="h-3.5 w-3.5" />
            {t("viewTweet")}
          </a>
        )}
        {!retweet && (
          <TweetImageButton
            postId={tweet.id}
            text={tweet.text}
            onShared={() => setOpened(true)}
            className={cn(button, "border-neutral-800 bg-[var(--sc-surface)] text-neutral-200 hover:bg-[var(--sc-hover)]")}
          />
        )}
        <a
          href={retweet ? retweetIntentUrl(retweet) : tweetIntentUrl(tweet.text)}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => setOpened(true)}
          className={cn(
            button,
            opened
              ? "border-[color-mix(in_oklab,var(--sc-accent)_45%,transparent)] bg-[color-mix(in_oklab,var(--sc-accent)_14%,transparent)] text-[var(--sc-accent)]"
              : "border-neutral-800 bg-[var(--sc-surface)] text-neutral-200 hover:bg-[var(--sc-hover)]"
          )}
        >
          {opened ? <CheckIcon className="h-3.5 w-3.5" /> : retweet ? <Repeat2Icon className="h-3.5 w-3.5" /> : <ExternalLinkIcon className="h-3.5 w-3.5" />}
          {t(opened ? "opened" : retweet ? "openRetweet" : "open")}
        </a>
        <button
          type="button"
          disabled={state !== "idle"}
          aria-busy={state === "pending"}
          onClick={markPublished}
          className={cn(
            button,
            done ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400" : "border-transparent bg-[var(--sc-accent)] text-[var(--sc-accent-ink)] hover:brightness-110"
          )}
        >
          {state === "pending" && <Loader2Icon className="h-3.5 w-3.5 animate-spin" />}
          {done && <CheckIcon className="h-3.5 w-3.5" />}
          {t(state === "pending" ? "marking" : done ? (retweet ? "retweetDone" : "done") : retweet ? "markRetweeted" : "markPublished")}
        </button>
      </div>

      {error && (
        <p role="alert" className={cn("mt-2 text-[13px]", done ? "text-neutral-500" : "text-red-400")}>
          {t(`errors.${error}`)}
        </p>
      )}
    </li>
  );
}

export function TweetQueue({ tweets }: { tweets: PendingTweet[] }) {
  const t = useTranslations("tweets");
  const retweets = tweets.filter((tweet) => tweet.authorTweetId);
  const toTweet = tweets.filter((tweet) => !tweet.authorTweetId);

  if (!tweets.length) return <p className="mt-8 rounded-xl border border-neutral-800 bg-[var(--sc-surface)] px-4 py-6 text-center text-neutral-400">{t("empty")}</p>;

  return (
    <>
      {toTweet.length > 0 && <QueueSection title={t("toTweet")} countKey="count" tweets={toTweet} />}
      {retweets.length > 0 && <QueueSection title={t("toRetweet")} hint={t("toRetweetHint")} countKey="countRetweets" tweets={retweets} />}
    </>
  );
}

function QueueSection({ title, hint, countKey, tweets }: { title: string; hint?: string; countKey: "count" | "countRetweets"; tweets: PendingTweet[] }) {
  const t = useTranslations("tweets");
  const [left, setLeft] = useState(tweets.length);

  return (
    <section className="mt-8">
      <h2 className="text-[18px] font-bold tracking-tight text-neutral-50">{title}</h2>
      {hint && <p className="mt-1 text-[13.5px] text-neutral-500">{hint}</p>}
      <p aria-live="polite" className="mt-3 text-[13px] font-semibold text-neutral-400">
        {left ? t(countKey, { count: left }) : t("sectionDone")}
      </p>
      <ul className="mt-3 flex flex-col gap-3">
        {tweets.map((tweet) => (
          <TweetCard key={tweet.id} tweet={tweet} onDone={() => setLeft((n) => n - 1)} />
        ))}
      </ul>
    </section>
  );
}
