/**
 * GC-Scouting - moderation
 *
 * Moderation actions on posts and reports.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

import { and, eq, isNotNull, isNull, or } from "drizzle-orm";
import { actionTokens, moderationActions, posts, reports } from "@scouting/db/schema";
import { isUniqueViolation } from "@scouting/db";
import type { Db } from "../core/context";
import { loadPost, moderationRemoval } from "./posts";

export const REASON_MIN = 3;
export const REASON_MAX = 500;

export type RemoveResult = "ok" | "notFound" | "notActive";
export type RestoreResult = "ok" | "notFound" | "notRemoved" | "activeExists";
export type TweetedResult = "ok" | "notFound" | "alreadyTweeted" | "awaitingAuthor";
export type DismissResult = "ok" | "notFound" | "alreadyHandled";

/** Takes a post offline, logs the action and closes its open reports. */
export async function removePost(db: Db, postId: number, discordUserId: string, reason: string, reportId: number | null): Promise<RemoveResult> {
  return db.transaction(async (tx) => {
    const now = new Date();
    const [row] = await tx
      .update(posts)
      .set({ status: "removed", deletedAt: now })
      .where(and(eq(posts.id, postId), eq(posts.status, "active"), isNull(posts.deletedAt)))
      .returning({ id: posts.id });
    if (!row) return (await loadPost(tx, postId)) ? "notActive" : "notFound";

    // A report id from another post is dropped, the removal is still logged.
    const [report] = reportId ? await tx.select({ id: reports.id }).from(reports).where(and(eq(reports.id, reportId), eq(reports.postId, postId))) : [];
    await tx.insert(moderationActions).values({ postId, reportId: report?.id ?? null, action: "remove", discordUserId, reason });
    await tx
      .update(reports)
      .set({ status: "handled", handledByDiscordId: discordUserId, handledAt: now })
      .where(and(eq(reports.postId, postId), eq(reports.status, "open")));
    // The renew and delete links of the expiry reminder stop working.
    await tx.update(actionTokens).set({ usedAt: now }).where(and(eq(actionTokens.postId, postId), isNull(actionTokens.usedAt)));
    return "ok";
  });
}

/** Only undoes a moderator removal, never a deletion by the author. */
export async function restorePost(db: Db, postId: number, discordUserId: string): Promise<RestoreResult> {
  try {
    return await db.transaction(async (tx) => {
      const post = await loadPost(tx, postId);
      if (!post) return "notFound";
      if (!(await moderationRemoval(tx, post))) return "notRemoved";

      await tx
        .update(posts)
        .set({ status: "active", deletedAt: null })
        .where(and(eq(posts.id, postId), eq(posts.status, "removed")));
      await tx.insert(moderationActions).values({ postId, action: "restore", discordUserId });
      return "ok";
    });
  } catch (error) {
    // The author published another LFT or LFST in the meantime.
    if (isUniqueViolation(error)) return "activeExists";
    throw error;
  }
}

/** Moderator on Discord, or admin account (`users.id`) on the site tweets page. */
export type TweetedBy = { discordUserId: string } | { actorUserId: string };

/** Tweeted, or the author's tweet retweeted. */
export async function markTweeted(db: Db, postId: number, by: TweetedBy): Promise<TweetedResult> {
  const discordUserId = "discordUserId" in by ? by.discordUserId : null;
  return db.transaction(async (tx) => {
    const [row] = await tx
      .update(posts)
      .set({ tweetedAt: new Date(), tweetedByDiscordId: discordUserId })
      .where(and(eq(posts.id, postId), isNull(posts.tweetedAt), or(eq(posts.tweetBy, "site"), isNotNull(posts.authorTweetId))))
      .returning({ id: posts.id });
    if (!row) {
      const post = await loadPost(tx, postId);
      return !post ? "notFound" : post.tweetedAt ? "alreadyTweeted" : "awaitingAuthor";
    }
    await tx.insert(moderationActions).values({ postId, action: "tweeted", discordUserId, actorUserId: "actorUserId" in by ? by.actorUserId : null });
    return "ok";
  });
}

export async function dismissReport(db: Db, reportId: number, discordUserId: string): Promise<DismissResult> {
  const [row] = await db
    .update(reports)
    .set({ status: "dismissed", handledByDiscordId: discordUserId, handledAt: new Date() })
    .where(and(eq(reports.id, reportId), eq(reports.status, "open")))
    .returning({ id: reports.id });
  if (row) return "ok";
  const [exists] = await db.select({ id: reports.id }).from(reports).where(eq(reports.id, reportId)).limit(1);
  return exists ? "alreadyHandled" : "notFound";
}
