/**
 * GC-Scouting - bot
 *
 * Calls the Discord bot for internal notifications.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

import type { PostType, Region, TweetBy } from "@scouting/db";
import type { AppLocale } from "@/i18n/routing";
import { loggable } from "@scouting/db/log";

// Scouting Discord bot (apps/bot), reached at SCOUTING_BOT_URL. It answers at once and talks to Discord afterwards,
// its periodic catch up covers any call lost here.

const REQUEST_TIMEOUT_MS = 5000;

/** Authenticated request to the bot, null when it is not configured. */
async function request(path: string, method: "GET" | "POST", body?: unknown): Promise<Response | null> {
  const baseUrl = process.env.SCOUTING_BOT_URL?.replace(/\/$/, "");
  const key = process.env.SCOUTING_BOT_KEY;
  if (!baseUrl || !key) return null;
  const headers: Record<string, string> = { Authorization: `Bearer ${key}` };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  return fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
}

async function call(path: string): Promise<void> {
  try {
    const response = await request(path, "POST");
    if (response && !response.ok) console.warn(`[bot] ${path} answered ${response.status}`);
  } catch (error) {
    console.warn(`[bot] ${path} request failed`, loggable(error));
  }
}

/** Post published, renewed, edited, closed or deleted: feeds and moderation channel follow. Never throws. */
export function notifyBotPost(postId: number): Promise<void> {
  return call(`/internal/posts/${postId}`);
}

/** Post removed or restored, or report handled, from the site admin: feeds and moderation messages follow. Never throws. */
export function notifyBotModerated(postId: number): Promise<void> {
  return call(`/internal/posts/${postId}/moderated`);
}

/** Account deleted: its Discord messages are deleted, the bot cron retries the failed ones. Never throws. */
export function notifyBotPurge(): Promise<void> {
  return call("/internal/purges");
}

/** New report, posted in the moderation channel. Never throws. */
export function notifyBotReport(reportId: number): Promise<void> {
  return call(`/internal/reports/${reportId}`);
}

export type PendingTweet = {
  id: number;
  type: PostType;
  displayName: string;
  region: Region;
  publishedAt: string;
  text: string;
  length: number;
  tooLong: boolean;
  tweetBy: TweetBy;
  /** Set when the author tweeted it: to be retweeted. */
  authorTweetId: string | null;
};

/** Tweet text in one of the languages the author may pick. */
export type TweetDraft = Pick<PendingTweet, "text" | "length" | "tooLong"> & { locale: AppLocale };

/** Texts the author may tweet from their own account, without their name, the default language first. Null when the bot cannot be reached or the post is not tweeted by its author. */
export async function fetchAuthorTweets(postId: number): Promise<TweetDraft[] | null> {
  try {
    const response = await request(`/internal/posts/${postId}/tweet`, "GET");
    if (!response?.ok) return null;
    return ((await response.json()) as { tweets: TweetDraft[] }).tweets;
  } catch (error) {
    console.warn(`[bot] /internal/posts/${postId}/tweet request failed`, loggable(error));
    return null;
  }
}

/** Posts left to tweet, with their text written by the bot. Null when the bot cannot be reached. */
export async function fetchPendingTweets(): Promise<PendingTweet[] | null> {
  try {
    const response = await request("/internal/tweets", "GET");
    if (!response?.ok) return null;
    return ((await response.json()) as { tweets: PendingTweet[] }).tweets;
  } catch (error) {
    console.warn("[bot] /internal/tweets request failed", loggable(error));
    return null;
  }
}

export type MarkTweetedResult = "ok" | "notFound" | "alreadyTweeted" | "awaitingAuthor" | "unavailable";

/** Marks a post as tweeted, or its author's tweet as retweeted. The moderation message follows. */
export async function markBotTweeted(postId: number, accessSubject: string): Promise<MarkTweetedResult> {
  try {
    const response = await request(`/internal/posts/${postId}/tweeted`, "POST", { accessSubject });
    if (!response) return "unavailable";
    if (response.ok) return "ok";
    const { error } = (await response.json().catch(() => ({}))) as { error?: string };
    return error === "notFound" || error === "alreadyTweeted" || error === "awaitingAuthor" ? error : "unavailable";
  } catch (error) {
    console.warn(`[bot] /internal/posts/${postId}/tweeted request failed`, loggable(error));
    return "unavailable";
  }
}
