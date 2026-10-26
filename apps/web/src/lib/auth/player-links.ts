/**
 * GC-Scouting - player-links
 *
 * Checks whether pending player links have been approved on GC Stats.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

import { and, asc, eq, isNull, lt, or } from "drizzle-orm";
import { db } from "@scouting/db/client";
import { playerLinks } from "@scouting/db";
import { getGcsAccessToken, syncPlayerLink } from "./account";
import { dropIfGcsAccountGone } from "./account-data";
import { fetchUserinfo, GcsOAuthError } from "./gcs-oauth";
import { syncAuthorGcsSummaries } from "@/lib/gcs-summary";
import { loggable } from "@scouting/db/log";

// Pending link requests are followed through `userinfo`: `player` for an approval, `playerLinkRequest` for a refusal.

const CHECK_INTERVAL_MS = 55 * 60 * 1000;

/** Rereads `userinfo` for pending links not checked in the last hour. */
export async function checkPendingPlayerLinks(limit = 50): Promise<{ checked: number; approved: number; rejected: number; failed: number }> {
  const due = await db
    .select({ id: playerLinks.id, userId: playerLinks.userId })
    .from(playerLinks)
    .where(and(eq(playerLinks.status, "pending"), or(isNull(playerLinks.checkedAt), lt(playerLinks.checkedAt, new Date(Date.now() - CHECK_INTERVAL_MS)))))
    .orderBy(asc(playerLinks.checkedAt))
    .limit(limit);

  const result = { checked: 0, approved: 0, rejected: 0, failed: 0 };
  // One user at a time: each check may rotate a refresh token.
  for (const link of due) {
    try {
      const token = await getGcsAccessToken(link.userId);
      // No token: the user has to log in again, the check happens at that login.
      const info = token ? await fetchUserinfo(token) : null;
      const { status, linked } = await db.transaction(async (tx) => {
        const linked = info ? await syncPlayerLink(tx, link.userId, info) : false;
        const [row] = await tx.update(playerLinks).set({ checkedAt: new Date() }).where(eq(playerLinks.id, link.id)).returning({ status: playerLinks.status });
        return { status: row?.status, linked };
      });
      if (linked) await syncAuthorGcsSummaries(link.userId);
      result.checked++;
      if (status === "approved") result.approved++;
      if (status === "rejected") result.rejected++;
    } catch (error) {
      if (error instanceof GcsOAuthError && error.code === "invalid_token") await dropIfGcsAccountGone(link.userId);
      result.failed++;
      console.error(`Player link check failed for link ${link.id}`, loggable(error));
    }
  }
  return result;
}
