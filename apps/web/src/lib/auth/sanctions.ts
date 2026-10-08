/**
 * GC-Scouting - sanctions
 *
 * Fetches and caches the GC Stats sanctions of a user.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

import { eq } from "drizzle-orm";
import { db } from "@scouting/db/client";
import { users, type GcsSanction } from "@scouting/db";
import { blockingSanction } from "@/lib/sanction-rules";
import { getGcsAccessToken } from "./account";
import { fetchUserinfo } from "./gcs-oauth";
import { loggable } from "@scouting/db/log";

/** Sanctions are read again from GC Stats before an action once they are this old. */
const SANCTIONS_TTL_MS = 10 * 60 * 1000;
/** After a failed read, GC Stats is asked again only after this delay. */
const RETRY_AFTER_MS = 60 * 1000;

/** Reads the sanctions of an account from GC Stats when the stored ones are stale. Keeps the stored ones if GC Stats cannot answer. */
async function freshSanctions(userId: string): Promise<GcsSanction[]> {
  const [row] = await db.select({ sanctions: users.gcsSanctions, checkedAt: users.sanctionsCheckedAt }).from(users).where(eq(users.id, userId)).limit(1);
  if (!row) return [];
  if (row.checkedAt && Date.now() - row.checkedAt.getTime() < SANCTIONS_TTL_MS) return row.sanctions;

  try {
    const token = await getGcsAccessToken(userId);
    if (!token) return row.sanctions;
    const info = await fetchUserinfo(token);
    if (!info.activeSanctions) return row.sanctions;
    await db
      .update(users)
      .set({ gcsSanctions: info.activeSanctions, sanctionsCheckedAt: new Date(), ...(info.createdAt && { gcsCreatedAt: new Date(info.createdAt) }) })
      .where(eq(users.id, userId));
    return info.activeSanctions;
  } catch (error) {
    console.warn("GC Stats sanctions refresh failed", userId, loggable(error));
    // The stored sanctions count as fresh for a minute, so a down GC Stats is not called on every action.
    await db
      .update(users)
      .set({ sanctionsCheckedAt: new Date(Date.now() - SANCTIONS_TTL_MS + RETRY_AFTER_MS) })
      .where(eq(users.id, userId))
      .catch(() => {});
    return row.sanctions;
  }
}

/** Blocking sanction of any of the accounts (the logged in account and the profile it acts as). */
export async function sanctionBlocking(userIds: string[]): Promise<GcsSanction | null> {
  const lists = await Promise.all([...new Set(userIds)].map(freshSanctions));
  return blockingSanction(lists.flat());
}
