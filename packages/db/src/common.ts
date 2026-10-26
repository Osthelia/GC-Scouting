/**
 * GC-Scouting - common
 *
 * Small helpers shared by the database package (ids, durations).
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

import { and, eq, gt, isNull, sql } from "drizzle-orm";
import { posts } from "./schema/posts";

export const DAY_MS = 24 * 60 * 60 * 1000;

const ID = /^[1-9]\d{0,14}$/;

/** Positive integer id, from a number or a string of digits only. */
export function parseId(raw: unknown): number | null {
  if (typeof raw === "number") return Number.isSafeInteger(raw) && raw > 0 ? raw : null;
  return typeof raw === "string" && ID.test(raw) ? Number(raw) : null;
}

export function isUniqueViolation(error: unknown): boolean {
  const code = (error as { code?: string; cause?: { code?: string } })?.code ?? (error as { cause?: { code?: string } })?.cause?.code;
  return code === "23505";
}

/** Posts shown publicly and sent to Discord. Same rule as `isVisiblePost`. */
export const visiblePost = () => and(eq(posts.status, "active"), isNull(posts.deletedAt), gt(posts.expiresAt, sql`now()`));

export function isVisiblePost(post: { status: string; deletedAt: Date | null; expiresAt: Date }, now = new Date()): boolean {
  return post.status === "active" && post.deletedAt === null && post.expiresAt > now;
}
