/**
 * GC-Scouting - reports
 *
 * Server action that files a report against a post.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

"use server";

import { after } from "next/server";
import { and, count, eq, gt, isNull, ne } from "drizzle-orm";
import { db } from "@scouting/db/client";
import { parseId, posts, reports, users } from "@scouting/db";
import { getCurrentUser } from "@/lib/auth/session";
import { notifyBotReport } from "@/lib/notify/bot";
import { validateReport, type ReportFieldErrors } from "@/lib/report-form";
import { loggable } from "@scouting/db/log";
import { lockRateLimit } from "@/lib/rate-limit";

/** Reports a single account can send per hour, all posts together. */
const REPORTS_PER_HOUR = 5;

export type ReportFormError = "invalid" | "auth" | "notFound" | "ownPost" | "already" | "rateLimited" | "server";

export type ReportPostResult = { ok: true } | { ok: false; fieldErrors: ReportFieldErrors; formError?: ReportFormError };

/** Sends a report on a post to the moderation channel. The reporter is the logged in account, never a delegated profile. */
export async function reportPost(rawPostId: unknown, raw: unknown): Promise<ReportPostResult> {
  const postId = parseId(rawPostId);
  if (!postId) return { ok: false, fieldErrors: {}, formError: "invalid" };

  const valid = validateReport(raw);
  if (!valid.ok) return { ok: false, fieldErrors: valid.errors };

  const user = await getCurrentUser();
  if (!user) return { ok: false, fieldErrors: {}, formError: "auth" };

  try {
    const [post] = await db
      .select({ authorId: posts.authorId })
      .from(posts)
      .where(and(eq(posts.id, postId), isNull(posts.deletedAt), ne(posts.status, "removed")))
      .limit(1);
    if (!post) return { ok: false, fieldErrors: {}, formError: "notFound" };
    if (post.authorId === user.id) return { ok: false, fieldErrors: {}, formError: "ownPost" };

    const result = await db.transaction(async (tx) => {
      await lockRateLimit(tx, "reports", user.id);
      const [[open], [recent], [account]] = await Promise.all([
        tx
          .select({ id: reports.id })
          .from(reports)
          .where(and(eq(reports.postId, postId), eq(reports.reporterUserId, user.id), eq(reports.status, "open")))
          .limit(1),
        tx
          .select({ total: count() })
          .from(reports)
          .where(and(eq(reports.reporterUserId, user.id), gt(reports.createdAt, new Date(Date.now() - 60 * 60 * 1000)))),
        tx.select({ discordId: users.discordId }).from(users).where(eq(users.id, user.id)).limit(1),
      ]);
      if (open) return { error: "already" as const };
      if ((recent?.total ?? 0) >= REPORTS_PER_HOUR) return { error: "rateLimited" as const };

      const [row] = await tx
        .insert(reports)
        .values({ postId, reporterUserId: user.id, reporterDiscordId: account?.discordId ?? null, reason: valid.reason, message: valid.message })
        .returning({ id: reports.id });
      return { id: row!.id };
    });
    if ("error" in result) return { ok: false, fieldErrors: {}, formError: result.error };
    after(() => notifyBotReport(result.id));
    return { ok: true };
  } catch (error) {
    console.error("reportPost failed", loggable(error));
    return { ok: false, fieldErrors: {}, formError: "server" };
  }
}
