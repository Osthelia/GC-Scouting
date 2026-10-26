/**
 * GC-Scouting - queries
 *
 * Chat queries: conversations, messages and unread counts.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

import { and, desc, eq, isNotNull, lt, ne, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@scouting/db/client";
import { conversationMembers, conversations, messages, posts, profileDelegations, userBlocks, users, DAY_MS, RECENT_ACCOUNT_DAYS, type GcsSanction, type MessageStatus, type PostType } from "@scouting/db";
import { hasWarning } from "@/lib/sanction-rules";

/** Messages sent to the page, the latest ones. */
export const CHAT_PAGE_SIZE = 60;
const PREVIEW_MAX = 120;

export type ChatPeer = {
  id: string;
  username: string;
  avatarUrl: string | null;
  /** GC Stats account created less than RECENT_ACCOUNT_DAYS ago. */
  recentAccount: boolean;
  /** Active GC Stats warning. */
  warned: boolean;
};

export type ConversationSummary = {
  id: number;
  peer: ChatPeer;
  /** `author` is the manager who wrote it for the profile. */
  last: { body: string; mine: boolean; author: string | null; status: MessageStatus; createdAt: string };
  unread: number;
};

/** Manager who wrote a message for the profile (`profile`), shown under their own name. */
export type MessageAuthor = { username: string; avatarUrl: string | null; profile: string };

/** `body` is empty for a message hidden by the staff. */
export type ChatMessageView = { id: number; mine: boolean; author: MessageAuthor | null; body: string; status: MessageStatus; createdAt: string };

export type ConversationDetail = {
  id: number;
  peer: ChatPeer;
  messages: ChatMessageView[];
  hasMore: boolean;
  blockedByMe: boolean;
  blockedByPeer: boolean;
  /** Post the conversation was started from. */
  post: { id: number; type: PostType; displayName: string } | null;
  /** Set when the viewer writes as a profile they manage. */
  delegate: { name: string; profile: string } | null;
};

type PeerRow = { id: string; username: string; avatarUrl: string | null; gcsCreatedAt: Date | null; createdAt: Date; sanctions: GcsSanction[] };

function toPeer(row: PeerRow, now = new Date()): ChatPeer {
  const created = row.gcsCreatedAt ?? row.createdAt;
  return {
    id: row.id,
    username: row.username,
    avatarUrl: row.avatarUrl,
    recentAccount: now.getTime() - created.getTime() < RECENT_ACCOUNT_DAYS * DAY_MS,
    warned: hasWarning(row.sanctions, now),
  };
}

/** A member sees every message, except the ones the automod holds from someone else. */
const readableBy = (userId: string) => or(ne(messages.status, "blocked"), eq(messages.senderId, userId));

type MessageRow = {
  id: number;
  senderId: string;
  senderName: string;
  writerName: string | null;
  writerAvatar: string | null;
  body: string;
  status: MessageStatus;
  createdAt: Date;
};

function toMessage(row: MessageRow, userId: string): ChatMessageView {
  return {
    id: row.id,
    mine: row.senderId === userId,
    author: row.writerName ? { username: row.writerName, avatarUrl: row.writerAvatar, profile: row.senderName } : null,
    body: row.status === "hidden" ? "" : row.body,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
  };
}

const sender = alias(users, "sender");
const writer = alias(users, "writer");

const peerColumns = {
  id: users.id,
  username: users.username,
  avatarUrl: users.avatarUrl,
  gcsCreatedAt: users.gcsCreatedAt,
  createdAt: users.createdAt,
  sanctions: users.gcsSanctions,
};

/** Conversations loaded at once, the list then grows by this much. */
export const CONVERSATIONS_PAGE_SIZE = 50;

/** Conversations of a profile with at least one message it can read, latest first. `hasMore` when some are past `limit`. */
export async function listConversations(userId: string, limit = CONVERSATIONS_PAGE_SIZE): Promise<{ conversations: ConversationSummary[]; hasMore: boolean }> {
  const result = await db.execute<{
    id: string;
    peer_id: string;
    username: string;
    avatar_url: string | null;
    gcs_created_at: string | null;
    created_at: string;
    gcs_sanctions: GcsSanction[];
    body: string;
    sender_id: string;
    author: string | null;
    status: MessageStatus;
    sent_at: string;
    unread: string;
  }>(sql`
    select c.id, u.id as peer_id, u.username, u.avatar_url, u.gcs_created_at, u.created_at, u.gcs_sanctions,
      lm.body, lm.sender_id, lm.author, lm.status, lm.created_at as sent_at,
      (select count(*) from messages x
        where x.conversation_id = c.id and x.sender_id <> ${userId} and x.status = 'visible' and x.created_at > me.last_read_at) as unread
    from conversation_members me
    join conversations c on c.id = me.conversation_id
    join conversation_members other on other.conversation_id = c.id and other.user_id <> ${userId}
    join users u on u.id = other.user_id
    join lateral (
      select m.body, m.sender_id, w.username as author, m.status, m.created_at from messages m
      left join users w on w.id = m.sent_by_id and m.sent_by_id <> m.sender_id
      where m.conversation_id = c.id and (m.status <> 'blocked' or m.sender_id = ${userId})
      order by m.id desc limit 1
    ) lm on true
    where me.user_id = ${userId}
    order by lm.created_at desc, c.id desc
    limit ${limit + 1}
  `);

  const now = new Date();
  const conversations = result.rows.slice(0, limit).map((r) => ({
    id: Number(r.id),
    peer: toPeer(
      { id: r.peer_id, username: r.username, avatarUrl: r.avatar_url, gcsCreatedAt: r.gcs_created_at ? new Date(r.gcs_created_at) : null, createdAt: new Date(r.created_at), sanctions: r.gcs_sanctions ?? [] },
      now,
    ),
    last: {
      body: r.status === "hidden" ? "" : r.body.slice(0, PREVIEW_MAX),
      mine: r.sender_id === userId,
      author: r.author,
      status: r.status,
      createdAt: new Date(r.sent_at).toISOString(),
    },
    unread: Number(r.unread),
  }));
  return { conversations, hasMore: result.rows.length > limit };
}

/** Unread messages of a profile, all conversations together. */
export async function unreadCount(userId: string): Promise<number> {
  const result = await db.execute<{ total: string }>(sql`
    select count(*) as total
    from conversation_members me
    join messages m on m.conversation_id = me.conversation_id
    where me.user_id = ${userId} and m.sender_id <> ${userId} and m.status = 'visible' and m.created_at > me.last_read_at
  `);
  return Number(result.rows[0]?.total ?? 0);
}

/** The other member of a conversation, null when the profile is not in it. */
export async function conversationPeerId(conversationId: number, userId: string): Promise<string | null> {
  const members = await db
    .select({ userId: conversationMembers.userId })
    .from(conversationMembers)
    .where(eq(conversationMembers.conversationId, conversationId));
  if (!members.some((m) => m.userId === userId)) return null;
  return members.find((m) => m.userId !== userId)?.userId ?? null;
}

export async function blockState(userId: string, peerId: string): Promise<{ blockedByMe: boolean; blockedByPeer: boolean }> {
  const rows = await db
    .select({ blockerId: userBlocks.blockerId })
    .from(userBlocks)
    .where(
      or(
        and(eq(userBlocks.blockerId, userId), eq(userBlocks.blockedId, peerId)),
        and(eq(userBlocks.blockerId, peerId), eq(userBlocks.blockedId, userId)),
      ),
    );
  return { blockedByMe: rows.some((r) => r.blockerId === userId), blockedByPeer: rows.some((r) => r.blockerId === peerId) };
}

/** Messages before `beforeId` (the latest ones without it), oldest first. */
async function messagePage(conversationId: number, userId: string, beforeId?: number): Promise<{ messages: ChatMessageView[]; hasMore: boolean }> {
  const rows = await db
    .select({
      id: messages.id,
      senderId: messages.senderId,
      senderName: sender.username,
      writerName: writer.username,
      writerAvatar: writer.avatarUrl,
      body: messages.body,
      status: messages.status,
      createdAt: messages.createdAt,
    })
    .from(messages)
    .innerJoin(sender, eq(sender.id, messages.senderId))
    .leftJoin(writer, and(eq(writer.id, messages.sentById), ne(messages.sentById, messages.senderId)))
    .where(and(eq(messages.conversationId, conversationId), readableBy(userId), beforeId ? lt(messages.id, beforeId) : undefined))
    .orderBy(desc(messages.id))
    .limit(CHAT_PAGE_SIZE + 1);
  return { messages: rows.slice(0, CHAT_PAGE_SIZE).reverse().map((r) => toMessage(r, userId)), hasMore: rows.length > CHAT_PAGE_SIZE };
}

/** Older messages of a conversation, loaded on demand. Null when the profile is not a member. */
export async function olderMessages(conversationId: number, userId: string, beforeId: number): Promise<{ messages: ChatMessageView[]; hasMore: boolean } | null> {
  if (!(await conversationPeerId(conversationId, userId))) return null;
  return messagePage(conversationId, userId, beforeId);
}

/**
 * Latest messages of a conversation as one of its members sees them. Null when the profile is not a member.
 * `viewer` is the active profile, to tell a manager they write under their own name.
 */
export async function getConversation(
  conversationId: number,
  viewer: { id: string; username: string; actorName: string; delegated: boolean },
): Promise<ConversationDetail | null> {
  const userId = viewer.id;
  const peerId = await conversationPeerId(conversationId, userId);
  if (!peerId) return null;

  const [[peer], [conversation], page, blocks] = await Promise.all([
    db.select(peerColumns).from(users).where(eq(users.id, peerId)).limit(1),
    db
      .select({ postId: posts.id, type: posts.type, displayName: posts.displayName, status: posts.status })
      .from(conversations)
      .leftJoin(posts, eq(posts.id, conversations.postId))
      .where(eq(conversations.id, conversationId))
      .limit(1),
    messagePage(conversationId, userId),
    blockState(userId, peerId),
  ]);
  if (!peer) return null;

  const post = conversation?.postId && conversation.type && conversation.displayName && conversation.status !== "removed" ? { id: conversation.postId, type: conversation.type, displayName: conversation.displayName } : null;
  return {
    id: conversationId,
    peer: toPeer(peer),
    ...page,
    ...blocks,
    post,
    delegate: viewer.delegated ? { name: viewer.actorName, profile: viewer.username } : null,
  };
}

/** Member of a conversation the account can act as (itself or a profile it manages), to offer switching to it. */
export async function switchableProfile(conversationId: number, accountId: string): Promise<{ id: string; username: string } | null> {
  const [row] = await db
    .select({ id: users.id, username: users.username })
    .from(conversationMembers)
    .innerJoin(users, eq(users.id, conversationMembers.userId))
    .leftJoin(profileDelegations, and(eq(profileDelegations.ownerId, conversationMembers.userId), eq(profileDelegations.delegateId, accountId)))
    .where(and(eq(conversationMembers.conversationId, conversationId), or(eq(conversationMembers.userId, accountId), isNotNull(profileDelegations.id))))
    .limit(1);
  return row ?? null;
}

/** Existing conversation between two profiles. */
export async function findConversation(a: string, b: string): Promise<number | null> {
  const [row] = await db.select({ id: conversations.id }).from(conversations).where(eq(conversations.pairKey, pairKey(a, b))).limit(1);
  return row?.id ?? null;
}

export function pairKey(a: string, b: string): string {
  return [a, b].sort().join(":");
}
