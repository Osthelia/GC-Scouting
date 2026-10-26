/**
 * GC-Scouting - chat
 *
 * Server actions for the chat: start a conversation, send, report and read messages.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

"use server";

import { after } from "next/server";
import { and, count, eq, gt, isNull, sql } from "drizzle-orm";
import { db } from "@scouting/db/client";
import { conversationMembers, conversations, messageReports, messages, parseId, posts, userBlocks, CHAT_MESSAGE_MAX, DAY_MS } from "@scouting/db";
import { getActiveProfile, getCurrentUser } from "@/lib/auth/session";
import { sanctionBlocking } from "@/lib/auth/sanctions";
import { moderateMessage } from "@/lib/chat/automod";
import { notifyNewMessage } from "@/lib/chat/notify";
import { blockState, conversationPeerId, findConversation, pairKey, type ChatMessageView } from "@/lib/chat/queries";
import { validateReport, type ReportFieldErrors } from "@/lib/report-form";
import { cleanText } from "@scouting/db/text-input";
import { loggable } from "@scouting/db/log";
import { lockRateLimit } from "@/lib/rate-limit";
import type { Tx } from "@/lib/auth/account";

/** Messages a single account can send per minute. */
const MESSAGES_PER_MINUTE = 15;
/** Conversations a single account can start per day. */
const CONVERSATIONS_PER_DAY = 20;
const MESSAGE_REPORTS_PER_HOUR = 10;

export type ChatBodyError = "required" | "tooLong" | "invalidCharacters";
export type SendMessageError =
  | "auth"
  | "notFound"
  | "ownPost"
  | "chatDisabled"
  | "blockedByMe"
  | "blockedByPeer"
  | "sanctioned"
  | "rateLimited"
  | "tooManyConversations"
  | "server";

export type SendMessageResult =
  | { ok: true; conversationId: number; message: ChatMessageView }
  | { ok: false; bodyError?: ChatBodyError; error?: SendMessageError; sanctionEndsAt?: string | null };

/** Limit hit by the account sending a message, null when it can send. */
async function rateLimit(q: typeof db | Tx, actorId: string, newConversation: boolean): Promise<"rateLimited" | "tooManyConversations" | null> {
  const [[recent], [started]] = await Promise.all([
    q
      .select({ total: count() })
      .from(messages)
      .where(and(eq(messages.sentById, actorId), gt(messages.createdAt, new Date(Date.now() - 60 * 1000)))),
    newConversation
      ? q
          .select({ total: count() })
          .from(conversations)
          .where(and(eq(conversations.createdById, actorId), gt(conversations.createdAt, new Date(Date.now() - DAY_MS))))
      : Promise.resolve([{ total: 0 }]),
  ]);
  if ((recent?.total ?? 0) >= MESSAGES_PER_MINUTE) return "rateLimited";
  if ((started?.total ?? 0) >= CONVERSATIONS_PER_DAY) return "tooManyConversations";
  return null;
}

function validateBody(raw: unknown): { ok: true; body: string } | { ok: false; error: ChatBodyError } {
  // Trailing spaces and runs of empty lines are trimmed, the text itself is kept as typed.
  const { text, invalid } = cleanText(raw, { multiline: true });
  const body = text.replace(/\n{4,}/g, "\n\n\n");
  if (!body) return { ok: false, error: "required" };
  if (invalid) return { ok: false, error: "invalidCharacters" };
  if (body.length > CHAT_MESSAGE_MAX) return { ok: false, error: "tooLong" };
  return { ok: true, body };
}

/**
 * Sends a message. `target` is either an existing conversation, or a post: the conversation with its author
 * is then opened (or reused, one conversation per pair). The automod holds flagged messages for the staff.
 */
export async function sendMessage(target: { conversationId?: unknown; postId?: unknown }, rawBody: unknown): Promise<SendMessageResult> {
  const valid = validateBody(rawBody);
  if (!valid.ok) return { ok: false, bodyError: valid.error };

  const profile = await getActiveProfile();
  if (!profile) return { ok: false, error: "auth" };

  let conversationId = parseId(target.conversationId);
  let peerId: string | null = null;
  let postId: number | null = null;

  if (conversationId) {
    peerId = await conversationPeerId(conversationId, profile.id);
    if (!peerId) return { ok: false, error: "notFound" };
  } else {
    postId = parseId(target.postId);
    if (!postId) return { ok: false, error: "notFound" };
    const [post] = await db
      .select({ authorId: posts.authorId, chatEnabled: posts.chatEnabled })
      .from(posts)
      .where(and(eq(posts.id, postId), eq(posts.status, "active"), isNull(posts.deletedAt), gt(posts.expiresAt, sql`now()`)))
      .limit(1);
    if (!post) return { ok: false, error: "notFound" };
    if (post.authorId === profile.id) return { ok: false, error: "ownPost" };
    peerId = post.authorId;
    conversationId = await findConversation(profile.id, peerId);
    // A conversation that already exists stays open, the setting only stops new ones.
    if (!conversationId && !post.chatEnabled) return { ok: false, error: "chatDisabled" };
  }

  const blocks = await blockState(profile.id, peerId);
  if (blocks.blockedByMe) return { ok: false, error: "blockedByMe" };
  if (blocks.blockedByPeer) return { ok: false, error: "blockedByPeer" };

  const sanction = await sanctionBlocking([profile.actorId, profile.id]);
  if (sanction) return { ok: false, error: "sanctioned", sanctionEndsAt: sanction.endsAt };

  const limited = await rateLimit(db, profile.actorId, !conversationId);
  if (limited) return { ok: false, error: limited };

  const moderation = await moderateMessage(valid.body);
  const status = moderation?.flagged ? "blocked" : "visible";
  const peer = peerId;

  try {
    const sent = await db.transaction(async (tx) => {
      // Checked again under the lock: parallel sends cannot all pass the count read above.
      await lockRateLimit(tx, "messages", profile.actorId);
      const limited = await rateLimit(tx, profile.actorId, !conversationId);
      if (limited) return { limited };

      let id = conversationId;
      if (!id) {
        // Two first messages at once: the unique pair key keeps a single conversation.
        const [created] = await tx
          .insert(conversations)
          .values({ pairKey: pairKey(profile.id, peer), postId, createdById: profile.actorId })
          .onConflictDoNothing({ target: conversations.pairKey })
          .returning({ id: conversations.id });
        if (created) {
          id = created.id;
          await tx.insert(conversationMembers).values([
            { conversationId: id, userId: profile.id },
            // The peer has read nothing yet.
            { conversationId: id, userId: peer, lastReadAt: new Date(0) },
          ]);
        } else {
          const [existing] = await tx.select({ id: conversations.id }).from(conversations).where(eq(conversations.pairKey, pairKey(profile.id, peer))).limit(1);
          id = existing!.id;
        }
      }

      const [message] = await tx
        .insert(messages)
        .values({ conversationId: id, senderId: profile.id, sentById: profile.actorId, body: valid.body, status, moderation })
        .returning({ id: messages.id, createdAt: messages.createdAt });
      if (status === "visible") await tx.update(conversations).set({ lastMessageAt: message!.createdAt }).where(eq(conversations.id, id));
      await tx
        .update(conversationMembers)
        .set({ lastReadAt: message!.createdAt })
        .where(and(eq(conversationMembers.conversationId, id), eq(conversationMembers.userId, profile.id)));
      return { id, message: message! };
    });
    if ("limited" in sent) return { ok: false, error: sent.limited };
    const { id, message } = sent;

    // Same request, getCurrentUser is cached.
    const actor = profile.delegated ? await getCurrentUser() : null;
    const author = actor ? { username: actor.username, avatarUrl: actor.avatarUrl, profile: profile.username } : null;
    if (status === "visible") after(() => notifyNewMessage(id, peer, { name: profile.username, manager: author?.username ?? null, writerId: profile.actorId }));
    return {
      ok: true,
      conversationId: id,
      message: { id: message.id, mine: true, author, body: valid.body, status, createdAt: message.createdAt.toISOString() },
    };
  } catch (error) {
    console.error("sendMessage failed", loggable(error));
    return { ok: false, error: "server" };
  }
}

/** Marks a conversation as read up to now. */
export async function markConversationRead(rawConversationId: unknown): Promise<boolean> {
  const conversationId = parseId(rawConversationId);
  const profile = await getActiveProfile();
  if (!conversationId || !profile) return false;
  const [row] = await db
    .update(conversationMembers)
    .set({ lastReadAt: new Date() })
    .where(and(eq(conversationMembers.conversationId, conversationId), eq(conversationMembers.userId, profile.id)))
    .returning({ userId: conversationMembers.userId });
  return !!row;
}

export type BlockResult = { ok: true } | { ok: false; error: "auth" | "notFound" | "server" };

/** Blocks or unblocks the other member of a conversation. Neither side can then write to the other. */
export async function setUserBlocked(rawConversationId: unknown, blocked: unknown): Promise<BlockResult> {
  const conversationId = parseId(rawConversationId);
  if (!conversationId || typeof blocked !== "boolean") return { ok: false, error: "notFound" };
  const profile = await getActiveProfile();
  if (!profile) return { ok: false, error: "auth" };
  const peerId = await conversationPeerId(conversationId, profile.id);
  if (!peerId) return { ok: false, error: "notFound" };

  try {
    if (blocked) await db.insert(userBlocks).values({ blockerId: profile.id, blockedId: peerId }).onConflictDoNothing();
    else await db.delete(userBlocks).where(and(eq(userBlocks.blockerId, profile.id), eq(userBlocks.blockedId, peerId)));
    return { ok: true };
  } catch (error) {
    console.error("setUserBlocked failed", loggable(error));
    return { ok: false, error: "server" };
  }
}

export type ReportMessageResult =
  | { ok: true }
  | { ok: false; fieldErrors: ReportFieldErrors; formError?: "invalid" | "auth" | "notFound" | "ownMessage" | "already" | "rateLimited" | "server" };

/** Reports a message of the other member to the staff. The reporter is the logged in account. */
export async function reportMessage(rawMessageId: unknown, raw: unknown): Promise<ReportMessageResult> {
  const messageId = parseId(rawMessageId);
  if (!messageId) return { ok: false, fieldErrors: {}, formError: "invalid" };
  const valid = validateReport(raw);
  if (!valid.ok) return { ok: false, fieldErrors: valid.errors };

  const [user, profile] = await Promise.all([getCurrentUser(), getActiveProfile()]);
  if (!user || !profile) return { ok: false, fieldErrors: {}, formError: "auth" };

  try {
    const [message] = await db
      .select({ conversationId: messages.conversationId, senderId: messages.senderId, status: messages.status })
      .from(messages)
      .where(eq(messages.id, messageId))
      .limit(1);
    if (!message || message.status !== "visible" || !(await conversationPeerId(message.conversationId, profile.id))) {
      return { ok: false, fieldErrors: {}, formError: "notFound" };
    }
    if (message.senderId === profile.id) return { ok: false, fieldErrors: {}, formError: "ownMessage" };

    const result = await db.transaction(async (tx) => {
      await lockRateLimit(tx, "message-reports", user.id);
      const [recent] = await tx
        .select({ total: count() })
        .from(messageReports)
        .where(and(eq(messageReports.reporterId, user.id), gt(messageReports.createdAt, new Date(Date.now() - 60 * 60 * 1000))));
      if ((recent?.total ?? 0) >= MESSAGE_REPORTS_PER_HOUR) return "rateLimited" as const;

      const [row] = await tx
        .insert(messageReports)
        .values({ messageId, reporterId: user.id, reason: valid.reason, message: valid.message })
        .onConflictDoNothing()
        .returning({ id: messageReports.id });
      return row ? null : ("already" as const);
    });
    if (result) return { ok: false, fieldErrors: {}, formError: result };
    return { ok: true };
  } catch (error) {
    console.error("reportMessage failed", loggable(error));
    return { ok: false, fieldErrors: {}, formError: "server" };
  }
}
