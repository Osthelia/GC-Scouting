/**
 * GC-Scouting - rate-limit
 *
 * Transactional rate limit lock.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

import { sql } from "drizzle-orm";
import type { Tx } from "@/lib/auth/account";

/**
 * Serializes the rate limited writes of one key (account, post) until the transaction ends.
 * Count and insert then happen under the lock, parallel requests cannot all read the same count.
 */
export async function lockRateLimit(tx: Tx, scope: string, key: string | number): Promise<void> {
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${scope}), hashtext(${String(key)}))`);
}
