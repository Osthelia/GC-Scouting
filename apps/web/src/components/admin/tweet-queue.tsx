/**
 * GC-Scouting - tweet-queue
 *
 * Admin queue of the tweets to send and the author tweets to retweet.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

"use client";

import { useState, useTransition } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { AlertTriangle, Check, ExternalLink, Loader2, Repeat2 } from "lucide-react";
import { retweetIntentUrl, tweetIntentUrl, tweetStatusUrl } from "@scouting/db/twitter";
import { Link } from "@/i18n/navigation";
import type { PendingTweet } from "@/lib/notify/bot";
import { markPostTweeted, type MarkTweetedActionResult } from "@/actions/admin";
import { PostTypeBadge } from "@/components/post/badges";
import { TweetImageButton } from "@/components/post/tweet-image-button";
import { AdminEmpty } from "@/components/admin/admin-common";
import { Button, buttonVariants } from "@/components/admin/ui/button";
import { Card, CardContent } from "@/components/admin/ui/card";
import { cn } from "@/lib/utils";

const TWEET_MAX = 280;

type MarkError = Extract<MarkTweetedActionResult, { ok: false }>["error"] | "server";

function TweetCard({ tweet, onDone }: { tweet: PendingTweet; onDone(): void }) {
  const t = useTranslations("admin.tweets");
  const tRegions = useTranslations("regions");
  const format = useFormatter();
  const [opened, setOpened] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<MarkError | null>(null);
  const [pending, startTransition] = useTransition();

  const markPublished = () =>
    startTransition(async () => {
      setError(null);
      const result = await markPostTweeted(tweet.id).catch((): MarkTweetedActionResult | { ok: false; error: "server" } => ({ ok: false, error: "server" }));
      if (result.ok || result.error === "alreadyTweeted") {
        setDone(true);
        if (!result.ok) setError(result.error);
        onDone();
      } else setError(result.error);
    });

  // Tweeted by its author: we retweet it.
  const retweet = tweet.authorTweetId;

  return (
    <li id={`post-${tweet.id}`} className="scroll-mt-24">
      <Card className={cn("transition-opacity", done && "opacity-60")}>
        <CardContent className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <PostTypeBadge type={tweet.type} />
            <span className="font-semibold">{tweet.displayName}</span>
            <span className="text-xs text-muted-foreground">{tRegions(tweet.region)}</span>
            <span className="text-xs text-muted-foreground">{t("published", { date: format.relativeTime(new Date(tweet.publishedAt), new Date()) })}</span>
            <Link href={`/posts/${tweet.type}/${tweet.id}`} target="_blank" className="ml-auto text-xs font-medium text-primary hover:underline active:opacity-70">
              {t("viewPost")}
            </Link>
          </div>

          {retweet ? (
            <p className="text-sm text-muted-foreground">{t("authorTweeted")}</p>
          ) : (
            <div className="flex flex-col gap-1.5">
              <pre className="rounded-lg border bg-muted/40 p-3 font-sans text-sm whitespace-pre-wrap">{tweet.text}</pre>
              <p className={cn("inline-flex items-center gap-1.5 text-xs", tweet.tooLong ? "text-amber-400" : "text-muted-foreground")}>
                {tweet.tooLong && <AlertTriangle className="size-3.5" />}
                {t("length", { length: tweet.length, max: TWEET_MAX })}
                {tweet.tooLong && <span>{t("tooLong")}</span>}
              </p>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            {retweet ? (
              <Button variant="outline" render={<a href={tweetStatusUrl(retweet)} target="_blank" rel="noopener noreferrer" />}>
                <ExternalLink />
                {t("viewTweet")}
              </Button>
            ) : (
              <TweetImageButton postId={tweet.id} text={tweet.text} onShared={() => setOpened(true)} variant="admin" className={buttonVariants({ variant: "outline" })} />
            )}
            <Button
              variant="outline"
              className={cn(opened && "border-primary/40 bg-primary/10 text-primary hover:bg-primary/15")}
              render={<a href={retweet ? retweetIntentUrl(retweet) : tweetIntentUrl(tweet.text)} target="_blank" rel="noopener noreferrer" onClick={() => setOpened(true)} />}
            >
              {opened ? <Check /> : retweet ? <Repeat2 /> : <ExternalLink />}
              {t(opened ? "opened" : retweet ? "openRetweet" : "open")}
            </Button>
            <Button
              disabled={pending || done}
              aria-busy={pending}
              onClick={markPublished}
              className={cn(done && "bg-emerald-500/10 text-emerald-400 disabled:opacity-100")}
            >
              {pending && <Loader2 className="animate-spin" />}
              {done && <Check />}
              {t(pending ? "marking" : done ? (retweet ? "retweetDone" : "done") : retweet ? "markRetweeted" : "markPublished")}
            </Button>
          </div>

          {error && (
            <p role="alert" className={cn("text-xs", done ? "text-muted-foreground" : "text-destructive")}>
              {t(`errors.${error}`)}
            </p>
          )}
        </CardContent>
      </Card>
    </li>
  );
}

export function TweetQueue({ tweets }: { tweets: PendingTweet[] }) {
  const t = useTranslations("admin.tweets");
  const retweets = tweets.filter((tweet) => tweet.authorTweetId);
  const toTweet = tweets.filter((tweet) => !tweet.authorTweetId);

  if (!tweets.length) return <AdminEmpty text={t("empty")} />;

  return (
    <>
      {toTweet.length > 0 && <QueueSection title={t("toTweet")} countKey="count" tweets={toTweet} />}
      {retweets.length > 0 && <QueueSection title={t("toRetweet")} hint={t("toRetweetHint")} countKey="countRetweets" tweets={retweets} />}
    </>
  );
}

function QueueSection({ title, hint, countKey, tweets }: { title: string; hint?: string; countKey: "count" | "countRetweets"; tweets: PendingTweet[] }) {
  const t = useTranslations("admin.tweets");
  const [left, setLeft] = useState(tweets.length);

  return (
    <section className="flex flex-col gap-3">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        {hint && <p className="mt-0.5 text-sm text-muted-foreground">{hint}</p>}
        <p aria-live="polite" className="mt-1 text-xs font-semibold text-muted-foreground">
          {left ? t(countKey, { count: left }) : t("sectionDone")}
        </p>
      </div>
      <ul className="flex flex-col gap-3">
        {tweets.map((tweet) => (
          <TweetCard key={tweet.id} tweet={tweet} onDone={() => setLeft((n) => n - 1)} />
        ))}
      </ul>
    </section>
  );
}
