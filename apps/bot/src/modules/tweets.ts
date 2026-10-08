/**
 * GC-Scouting - tweets
 *
 * Lists the posts waiting for a tweet.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

import { and, asc, eq, isNotNull, isNull, or } from "drizzle-orm";
import { posts } from "@scouting/db/schema";
import type { PostType, Region, TweetBy } from "@scouting/db";
import type { BotContext } from "../core/context";
import type { Locale } from "../core/i18n";
import { isVisible, loadPost, selectBotPosts, toBotPost, visiblePost } from "./posts";
import { tweetDraft, tweetLocales, type TweetDraft } from "./tweet";

/** Most posts listed at once on the tweets page. */
const PENDING_LIMIT = 100;

export type PendingTweet = TweetDraft & {
  id: number;
  type: PostType;
  displayName: string;
  region: Region;
  publishedAt: string;
  tweetBy: TweetBy;
  /** Set when the author tweeted it: to be retweeted. */
  authorTweetId: string | null;
};

/** Online posts to tweet, or whose author's tweet is to retweet, oldest first, written in the language of the post. */
export async function pendingTweets(ctx: BotContext): Promise<{ tweets: PendingTweet[] }> {
  const rows = await selectBotPosts(ctx.db)
    .where(and(visiblePost(), isNull(posts.tweetedAt), or(eq(posts.tweetBy, "site"), isNotNull(posts.authorTweetId))))
    .orderBy(asc(posts.bumpedAt), asc(posts.id))
    .limit(PENDING_LIMIT);

  const tweets = rows.map((row) => {
    const post = toBotPost(row);
    return {
      ...tweetDraft(post, ctx.env.APP_URL),
      id: post.id,
      type: post.type,
      displayName: post.displayName,
      region: post.region,
      publishedAt: post.publishedAt.toISOString(),
      tweetBy: post.tweetBy,
      authorTweetId: post.authorTweetId,
    };
  });
  return { tweets };
}

export type AuthorTweet = TweetDraft & { locale: Locale };

/** Texts the author may tweet from their own account, one per language they can pick, the default first. Null when the post is not online or not tweeted by its author. */
export async function authorTweets(ctx: BotContext, postId: number): Promise<AuthorTweet[] | null> {
  const post = await loadPost(ctx.db, postId);
  if (!post || !isVisible(post) || post.tweetBy !== "author") return null;
  return tweetLocales(post).map((locale) => ({ locale, ...tweetDraft(post, ctx.env.APP_URL, { byAuthor: true, locale }) }));
}
