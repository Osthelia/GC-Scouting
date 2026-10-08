/**
 * GC-Scouting - posts
 *
 * Post queries and types used by the bot.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

import { and, desc, eq, sql } from "drizzle-orm";
import { moderationActions, posts, users } from "@scouting/db/schema";
import { parseMultirange, type MatchablePost } from "@scouting/db";
import type { Db } from "../core/context";
import { escapeMarkdown } from "./format";

export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
export type Queryable = Db | Tx;

export type BotPost = typeof posts.$inferSelect & { author: { username: string; discordId: string | null } };

export { visiblePost, isVisiblePost as isVisible } from "@scouting/db";

/** Posts joined to their author, to be filtered and mapped with `toBotPost`. */
export function selectBotPosts(db: Queryable) {
  return db
    .select({ post: posts, username: users.username, discordId: users.discordId })
    .from(posts)
    .innerJoin(users, eq(users.id, posts.authorId));
}

export function toBotPost(row: { post: typeof posts.$inferSelect; username: string; discordId: string | null }): BotPost {
  return { ...row.post, author: { username: row.username, discordId: row.discordId } };
}

export async function loadPost(db: Queryable, id: number): Promise<BotPost | null> {
  const [row] = await selectBotPosts(db).where(eq(posts.id, id)).limit(1);
  return row ? toBotPost(row) : null;
}

export function toMatchable(post: BotPost): MatchablePost {
  return { ...post, availabilityUtc: parseMultirange(post.availabilityUtc) };
}

/** `by`: Discord mention of the moderator, or name of the staff member when removed from the site admin. */
export type Removal = { by: string; reason: string | null };

/** Set when the post is currently removed by a moderator (not deleted by its author). */
export async function moderationRemoval(db: Queryable, post: BotPost): Promise<Removal | null> {
  if (post.status !== "removed") return null;
  const [last] = await db
    .select({ action: moderationActions.action, discordUserId: moderationActions.discordUserId, staffName: users.username, reason: moderationActions.reason })
    .from(moderationActions)
    .leftJoin(users, eq(users.id, moderationActions.actorUserId))
    .where(and(eq(moderationActions.postId, post.id), sql`${moderationActions.action} in ('remove', 'restore')`))
    .orderBy(desc(moderationActions.createdAt), desc(moderationActions.id))
    .limit(1);
  if (last?.action !== "remove") return null;
  return { by: last.discordUserId ? `<@${last.discordUserId}>` : escapeMarkdown(last.staffName ?? "?"), reason: last.reason };
}
