/**
 * GC-Scouting - post-tweet
 *
 * Server action that stores the tweet link of a post.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

"use server";

import { after } from "next/server";
import { and, eq, gt, isNull, sql } from "drizzle-orm";
import { db } from "@scouting/db/client";
import { parseId, posts, TWEET_BY, type TweetBy } from "@scouting/db";
import { parseTweetUrl } from "@scouting/db/twitter";
import { getActiveProfile } from "@/lib/auth/session";
import { notifyBotPost } from "@/lib/notify/bot";
import { loggable } from "@scouting/db/log";

/** Longest tweet link accepted, query string included. */
const TWEET_URL_MAX = 300;

export type PostTweetError = "invalid" | "required" | "tweetUrlInvalid" | "auth" | "notFound" | "alreadyTweeted" | "notAuthorTweet" | "server";

export type PostTweetResult = { ok: true } | { ok: false; error: PostTweetError };

type Check = { error: PostTweetError } | { tweetBy: TweetBy };

/** Online post of the logged in author, not tweeted yet. */
async function editableTweet(postId: number, authorId: string): Promise<Check> {
  const [post] = await db
    .select({ tweetBy: posts.tweetBy, tweetedAt: posts.tweetedAt })
    .from(posts)
    .where(and(eq(posts.id, postId), eq(posts.authorId, authorId), eq(posts.status, "active"), isNull(posts.deletedAt), gt(posts.expiresAt, sql`now()`)))
    .limit(1);
  if (!post) return { error: "notFound" };
  if (post.tweetedAt) return { error: "alreadyTweeted" };
  return { tweetBy: post.tweetBy };
}

/** Who tweets the post: GC Scouting, or its author who then gives the link of their tweet. */
export async function setPostTweetBy(rawPostId: unknown, rawTweetBy: unknown): Promise<PostTweetResult> {
  const postId = parseId(rawPostId);
  const tweetBy = TWEET_BY.find((v) => v === rawTweetBy);
  if (!postId || !tweetBy) return { ok: false, error: "invalid" };

  const user = await getActiveProfile();
  if (!user) return { ok: false, error: "auth" };

  try {
    const check = await editableTweet(postId, user.id);
    if ("error" in check) return { ok: false, error: check.error };
    if (check.tweetBy === tweetBy) return { ok: true };
    await db
      .update(posts)
      .set({ tweetBy, authorTweetId: null })
      .where(and(eq(posts.id, postId), eq(posts.authorId, user.id), isNull(posts.tweetedAt)));
  } catch (error) {
    console.error("setPostTweetBy failed", loggable(error));
    return { ok: false, error: "server" };
  }
  after(() => notifyBotPost(postId));
  return { ok: true };
}

/** Link of the tweet posted by the author, to be retweeted. It can be replaced until the retweet. */
export async function saveAuthorTweet(rawPostId: unknown, rawUrl: unknown): Promise<PostTweetResult> {
  const postId = parseId(rawPostId);
  if (!postId) return { ok: false, error: "invalid" };
  const url = typeof rawUrl === "string" ? rawUrl.trim() : "";
  if (!url) return { ok: false, error: "required" };
  const tweetId = url.length <= TWEET_URL_MAX ? parseTweetUrl(url) : null;
  if (!tweetId) return { ok: false, error: "tweetUrlInvalid" };

  const user = await getActiveProfile();
  if (!user) return { ok: false, error: "auth" };

  try {
    const check = await editableTweet(postId, user.id);
    if ("error" in check) return { ok: false, error: check.error };
    if (check.tweetBy !== "author") return { ok: false, error: "notAuthorTweet" };
    const [row] = await db
      .update(posts)
      .set({ authorTweetId: tweetId })
      .where(and(eq(posts.id, postId), eq(posts.authorId, user.id), eq(posts.tweetBy, "author"), isNull(posts.tweetedAt)))
      .returning({ id: posts.id });
    if (!row) return { ok: false, error: "alreadyTweeted" };
  } catch (error) {
    console.error("saveAuthorTweet failed", loggable(error));
    return { ok: false, error: "server" };
  }
  after(() => notifyBotPost(postId));
  return { ok: true };
}
