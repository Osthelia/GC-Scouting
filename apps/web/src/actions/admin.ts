/**
 * GC-Scouting - admin
 *
 * Server actions for staff moderation (remove posts, handle reports, roles).
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

"use server";

import { after } from "next/server";
import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "@scouting/db/client";
import { actionTokens, conversationMembers, conversations, isUniqueViolation, messageReports, messages, moderationActions, parseId, posts, reports, users, USER_ROLES, type UserRole } from "@scouting/db";
import { getStaffUser } from "@/lib/admin/access";
import { REMOVAL_REASON_MAX, REMOVAL_REASON_MIN } from "@/lib/admin/constants";
import { adminGcsUserIds } from "@/lib/auth/account";
import { notifyNewMessage } from "@/lib/chat/notify";
import { notifyBotModerated } from "@/lib/notify/bot";
import { loggable } from "@scouting/db/log";
import { cleanText } from "@scouting/db/text-input";

export type AdminActionError = "auth" | "invalid" | "notFound" | "conflict" | "reasonLength" | "reasonInvalidCharacters" | "activeExists" | "selfDemote" | "bootstrap" | "server";
export type AdminActionResult = { ok: true } | { ok: false; error: AdminActionError };

async function run(fn: () => Promise<AdminActionResult>, label: string): Promise<AdminActionResult> {
  try {
    return await fn();
  } catch (error) {
    // Restoring an LFT or LFST while its author published another one.
    if (isUniqueViolation(error)) return { ok: false, error: "activeExists" };
    console.error(`${label} failed`, loggable(error));
    return { ok: false, error: "server" };
  }
}

/** The automod held a message: `approve` delivers it (the recipient is alerted), `reject` keeps it from the recipient for good. */
export async function reviewHeldMessage(rawId: unknown, decision: unknown): Promise<AdminActionResult> {
  const id = parseId(rawId);
  if (!id || (decision !== "approve" && decision !== "reject")) return { ok: false, error: "invalid" };
  const staff = await getStaffUser();
  if (!staff) return { ok: false, error: "auth" };

  return run(async () => {
    const [row] = await db
      .update(messages)
      .set({ status: decision === "approve" ? "visible" : "hidden", reviewedById: staff.id, reviewedAt: new Date() })
      .where(and(eq(messages.id, id), eq(messages.status, "blocked"), isNull(messages.reviewedAt)))
      .returning({ conversationId: messages.conversationId, senderId: messages.senderId, sentById: messages.sentById, createdAt: messages.createdAt });
    if (!row) return { ok: false, error: "conflict" };

    if (decision === "approve") {
      await db
        .update(conversations)
        .set({ lastMessageAt: sql`greatest(${conversations.lastMessageAt}, ${row.createdAt})` })
        .where(eq(conversations.id, row.conversationId));
      const [[recipient], [sender], [manager]] = await Promise.all([
        db
          .select({ userId: conversationMembers.userId })
          .from(conversationMembers)
          .where(and(eq(conversationMembers.conversationId, row.conversationId), sql`${conversationMembers.userId} <> ${row.senderId}`))
          .limit(1),
        db.select({ username: users.username }).from(users).where(eq(users.id, row.senderId)).limit(1),
        row.sentById && row.sentById !== row.senderId ? db.select({ username: users.username }).from(users).where(eq(users.id, row.sentById)).limit(1) : [],
      ]);
      if (recipient && sender) after(() => notifyNewMessage(row.conversationId, recipient.userId, { name: sender.username, manager: manager?.username ?? null, writerId: row.sentById }));
    }
    return { ok: true };
  }, "reviewHeldMessage");
}

/** Hides a delivered message, or shows it again. */
export async function setMessageHidden(rawId: unknown, hidden: unknown): Promise<AdminActionResult> {
  const id = parseId(rawId);
  if (!id || typeof hidden !== "boolean") return { ok: false, error: "invalid" };
  const staff = await getStaffUser();
  if (!staff) return { ok: false, error: "auth" };

  return run(async () => {
    const [row] = await db
      .update(messages)
      .set({ status: hidden ? "hidden" : "visible", reviewedById: staff.id, reviewedAt: new Date() })
      .where(and(eq(messages.id, id), eq(messages.status, hidden ? "visible" : "hidden")))
      .returning({ id: messages.id });
    return row ? { ok: true } : { ok: false, error: "conflict" };
  }, "setMessageHidden");
}

/** `hide` hides the reported message and closes every open report on it, `dismiss` only closes this one. */
export async function handleMessageReport(rawId: unknown, decision: unknown): Promise<AdminActionResult> {
  const id = parseId(rawId);
  if (!id || (decision !== "hide" && decision !== "dismiss")) return { ok: false, error: "invalid" };
  const staff = await getStaffUser();
  if (!staff) return { ok: false, error: "auth" };

  return run(
    () =>
      db.transaction(async (tx): Promise<AdminActionResult> => {
        const now = new Date();
        const [report] = await tx
          .select({ messageId: messageReports.messageId })
          .from(messageReports)
          .where(and(eq(messageReports.id, id), eq(messageReports.status, "open")))
          .limit(1);
        if (!report) return { ok: false, error: "conflict" };

        if (decision === "dismiss") {
          await tx.update(messageReports).set({ status: "dismissed", handledById: staff.id, handledAt: now }).where(eq(messageReports.id, id));
          return { ok: true };
        }
        await tx
          .update(messages)
          .set({ status: "hidden", reviewedById: staff.id, reviewedAt: now })
          .where(and(eq(messages.id, report.messageId), eq(messages.status, "visible")));
        await tx
          .update(messageReports)
          .set({ status: "handled", handledById: staff.id, handledAt: now })
          .where(and(eq(messageReports.messageId, report.messageId), eq(messageReports.status, "open")));
        return { ok: true };
      }),
    "handleMessageReport",
  );
}

/** Takes a post offline like the Discord moderation does: logged, its open reports handled, its reminder links revoked. */
export async function removePostAsStaff(rawPostId: unknown, rawReason: unknown): Promise<AdminActionResult> {
  const postId = parseId(rawPostId);
  if (!postId) return { ok: false, error: "invalid" };
  const { text: reason, invalid } = cleanText(rawReason, { multiline: true });
  if (invalid) return { ok: false, error: "reasonInvalidCharacters" };
  if (reason.length < REMOVAL_REASON_MIN || reason.length > REMOVAL_REASON_MAX) return { ok: false, error: "reasonLength" };
  const staff = await getStaffUser();
  if (!staff) return { ok: false, error: "auth" };

  const result = await run(
    () =>
      db.transaction(async (tx): Promise<AdminActionResult> => {
        const now = new Date();
        const [row] = await tx
          .update(posts)
          .set({ status: "removed", deletedAt: now })
          .where(and(eq(posts.id, postId), eq(posts.status, "active"), isNull(posts.deletedAt)))
          .returning({ id: posts.id });
        if (!row) return { ok: false, error: "conflict" };

        await tx.insert(moderationActions).values({ postId, action: "remove", actorUserId: staff.id, reason });
        await tx
          .update(reports)
          .set({ status: "handled", handledByUserId: staff.id, handledAt: now })
          .where(and(eq(reports.postId, postId), eq(reports.status, "open")));
        await tx.update(actionTokens).set({ usedAt: now }).where(and(eq(actionTokens.postId, postId), isNull(actionTokens.usedAt)));
        return { ok: true };
      }),
    "removePostAsStaff",
  );
  if (result.ok) after(() => notifyBotModerated(postId));
  return result;
}

/** Only undoes a removal by the moderation, never a deletion by the author. */
export async function restorePostAsStaff(rawPostId: unknown): Promise<AdminActionResult> {
  const postId = parseId(rawPostId);
  if (!postId) return { ok: false, error: "invalid" };
  const staff = await getStaffUser();
  if (!staff) return { ok: false, error: "auth" };

  const result = await run(
    () =>
      db.transaction(async (tx): Promise<AdminActionResult> => {
        const [last] = await tx
          .select({ action: moderationActions.action })
          .from(moderationActions)
          .where(and(eq(moderationActions.postId, postId), inArray(moderationActions.action, ["remove", "restore"])))
          .orderBy(desc(moderationActions.createdAt), desc(moderationActions.id))
          .limit(1);
        if (last?.action !== "remove") return { ok: false, error: "conflict" };

        const [row] = await tx
          .update(posts)
          .set({ status: "active", deletedAt: null })
          .where(and(eq(posts.id, postId), eq(posts.status, "removed")))
          .returning({ id: posts.id });
        if (!row) return { ok: false, error: "conflict" };
        await tx.insert(moderationActions).values({ postId, action: "restore", actorUserId: staff.id });
        return { ok: true };
      }),
    "restorePostAsStaff",
  );
  if (result.ok) after(() => notifyBotModerated(postId));
  return result;
}

/** Closes a post report without action. */
export async function dismissPostReport(rawId: unknown): Promise<AdminActionResult> {
  const id = parseId(rawId);
  if (!id) return { ok: false, error: "invalid" };
  const staff = await getStaffUser();
  if (!staff) return { ok: false, error: "auth" };

  return run(async () => {
    const [row] = await db
      .update(reports)
      .set({ status: "dismissed", handledByUserId: staff.id, handledAt: new Date() })
      .where(and(eq(reports.id, id), eq(reports.status, "open")))
      .returning({ postId: reports.postId });
    if (!row) return { ok: false, error: "conflict" };
    after(() => notifyBotModerated(row.postId));
    return { ok: true };
  }, "dismissPostReport");
}

/** Admins only. An admin cannot lower their own role, and accounts made admin by the environment keep it. */
export async function setUserRole(rawUserId: unknown, rawRole: unknown): Promise<AdminActionResult> {
  const role = USER_ROLES.find((r) => r === rawRole) as UserRole | undefined;
  if (typeof rawUserId !== "string" || rawUserId.length > 64 || !role) return { ok: false, error: "invalid" };
  const staff = await getStaffUser();
  if (!staff || staff.role !== "admin") return { ok: false, error: "auth" };
  if (rawUserId === staff.id && role !== "admin") return { ok: false, error: "selfDemote" };

  return run(async () => {
    const [target] = await db.select({ gcsUserId: users.gcsUserId }).from(users).where(eq(users.id, rawUserId)).limit(1);
    if (!target) return { ok: false, error: "notFound" };
    if (role !== "admin" && adminGcsUserIds().includes(target.gcsUserId)) return { ok: false, error: "bootstrap" };
    await db.update(users).set({ role }).where(eq(users.id, rawUserId));
    return { ok: true };
  }, "setUserRole");
}
