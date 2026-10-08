/**
 * GC-Scouting - post-expiry
 *
 * Server action that confirms a renew or delete link sent by the expiry reminder.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

"use server";

import { after } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@scouting/db/client";
import { parseId, posts } from "@scouting/db";
import { getActiveProfile } from "@/lib/auth/session";
import { canRenew, consumeActionToken, renewPost, type ActionTokenError } from "@/lib/post-expiry";
import { notifyBotPost } from "@/lib/notify/bot";
import { deleteShareImages } from "@/lib/share-image";
import { syncPostGcsSummary } from "@/lib/gcs-summary";
import { loggable } from "@scouting/db/log";

export type ConfirmActionResult = { ok: true; action: "renew"; href: string; expiresAt: string } | { ok: true; action: "delete" } | { ok: false; error: ActionTokenError | "server" };

/** Runs the renew/delete link of a reminder, no session needed. */
export async function confirmActionToken(rawToken: unknown): Promise<ConfirmActionResult> {
  if (typeof rawToken !== "string") return { ok: false, error: "invalid" };
  try {
    const result = await consumeActionToken(rawToken);
    if (!result.ok) return result;
    after(() => notifyBotPost(result.postId));
    if (result.action === "delete") {
      after(() => deleteShareImages([result.postId]));
      return { ok: true, action: "delete" };
    }
    after(() => syncPostGcsSummary(result.postId));
    const [post] = await db.select({ type: posts.type }).from(posts).where(eq(posts.id, result.postId)).limit(1);
    return { ok: true, action: "renew", href: `/posts/${post!.type}/${result.postId}`, expiresAt: result.expiresAt.toISOString() };
  } catch (error) {
    console.error("confirmActionToken failed", loggable(error));
    return { ok: false, error: "server" };
  }
}

export type RenewPostResult = { ok: true } | { ok: false; error: "invalid" | "auth" | "notFound" | "tooEarly" | "limitReached" | "server" };

/** Renewal by the logged in author, open once the reminder window starts or after expiry. */
export async function renewOwnPost(rawPostId: unknown): Promise<RenewPostResult> {
  const postId = parseId(rawPostId);
  if (!postId) return { ok: false, error: "invalid" };

  const user = await getActiveProfile();
  if (!user) return { ok: false, error: "auth" };

  try {
    const [post] = await db
      .select({ expiresAt: posts.expiresAt })
      .from(posts)
      .where(and(eq(posts.id, postId), eq(posts.authorId, user.id), eq(posts.status, "active"), isNull(posts.deletedAt)))
      .limit(1);
    if (!post) return { ok: false, error: "notFound" };
    if (!canRenew(post.expiresAt)) return { ok: false, error: "tooEarly" };

    const renewed = await db.transaction((tx) => renewPost(tx, postId));
    if (!renewed) return { ok: false, error: "notFound" };
    if (renewed === "limitReached") return { ok: false, error: "limitReached" };
    // A renewed post gets an up to date GC Stats history.
    after(() => syncPostGcsSummary(postId));
    after(() => notifyBotPost(postId));
    return { ok: true };
  } catch (error) {
    console.error("renewOwnPost failed", loggable(error));
    return { ok: false, error: "server" };
  }
}
