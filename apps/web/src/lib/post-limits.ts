/**
 * GC-Scouting - post-limits
 *
 * Limit on the number of active posts per author and type.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

import { and, count, eq, ne } from "drizzle-orm";
import { ACTIVE_POSTS_MAX, posts, visiblePost, type PostType } from "@scouting/db";
import type { Tx } from "@/lib/auth/account";

/**
 * True when the author already has as many online posts of this type as allowed.
 * `exceptId` leaves out the post being renewed. Run under `lockRateLimit(tx, "posts", authorId)`.
 */
export async function activePostsFull(tx: Tx, authorId: string, type: PostType, exceptId?: number): Promise<boolean> {
  const max = ACTIVE_POSTS_MAX[type];
  if (max === undefined) return false;
  const [row] = await tx
    .select({ total: count() })
    .from(posts)
    .where(and(eq(posts.authorId, authorId), eq(posts.type, type), visiblePost(), exceptId ? ne(posts.id, exceptId) : undefined));
  return (row?.total ?? 0) >= max;
}
