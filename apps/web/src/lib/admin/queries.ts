/**
 * GC-Scouting - queries
 *
 * Paged database queries behind the admin pages.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

import { and, count, desc, eq, gt, ilike, inArray, isNull, lt, ne, or, sql, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@scouting/db/client";
import { assertStaff } from "@/lib/admin/access";
import {
  conversationMembers,
  conversations,
  messageReports,
  messages,
  posts,
  reports,
  users,
  DAY_MS,
  type GcsSanction,
  type MessageModeration,
  type MessageStatus,
  type PostType,
  type ReportReason,
  type UserRole,
} from "@scouting/db";

export const ADMIN_PAGE_SIZE = 25;

export type Paged<T> = { rows: T[]; total: number };

const offset = (page: number) => (Math.max(1, page) - 1) * ADMIN_PAGE_SIZE;
/** `%` and `_` typed in a search stay literal. */
const like = (q: string) => `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

export type AdminUserRef = { id: string; username: string; avatarUrl: string | null; gcsUserId: string };

const userRef = { id: users.id, username: users.username, avatarUrl: users.avatarUrl, gcsUserId: users.gcsUserId };

/** Pending work shown in the sidebar and on the dashboard. */
export async function adminPending(): Promise<{ held: number; messageReports: number; postReports: number }> {
  await assertStaff();
  const [[held], [messageReportsOpen], [postReportsOpen]] = await Promise.all([
    db.select({ n: count() }).from(messages).where(and(eq(messages.status, "blocked"), isNull(messages.reviewedAt))),
    db.select({ n: count() }).from(messageReports).where(eq(messageReports.status, "open")),
    db.select({ n: count() }).from(reports).where(eq(reports.status, "open")),
  ]);
  return { held: held?.n ?? 0, messageReports: messageReportsOpen?.n ?? 0, postReports: postReportsOpen?.n ?? 0 };
}

export async function adminStats() {
  await assertStaff();
  const since = new Date(Date.now() - 7 * DAY_MS);
  const [[activePosts], [newPosts], [activeConversations], [messagesWeek], [usersTotal], [staff]] = await Promise.all([
    db.select({ n: count() }).from(posts).where(and(eq(posts.status, "active"), isNull(posts.deletedAt), gt(posts.expiresAt, sql`now()`))),
    db.select({ n: count() }).from(posts).where(gt(posts.publishedAt, since)),
    db.select({ n: count() }).from(conversations).where(gt(conversations.lastMessageAt, since)),
    db.select({ n: count() }).from(messages).where(gt(messages.createdAt, since)),
    db.select({ n: count() }).from(users),
    db.select({ n: count() }).from(users).where(inArray(users.role, ["staff", "admin"])),
  ]);
  return {
    activePosts: activePosts?.n ?? 0,
    newPosts: newPosts?.n ?? 0,
    activeConversations: activeConversations?.n ?? 0,
    messagesWeek: messagesWeek?.n ?? 0,
    users: usersTotal?.n ?? 0,
    staff: staff?.n ?? 0,
  };
}

// Correlated subqueries name their outer table in full: drizzle drops the table prefix on single table selects.

// Conversations

export type AdminConversationRow = {
  id: number;
  members: AdminUserRef[];
  messages: number;
  held: number;
  reportsOpen: number;
  lastMessageAt: Date;
};

export async function listAdminConversations({ q, page }: { q: string; page: number }): Promise<Paged<AdminConversationRow>> {
  await assertStaff();
  const match: SQL | undefined = q
    ? sql`exists (select 1 from conversation_members cm join users u on u.id = cm.user_id where cm.conversation_id = conversations.id and u.username ilike ${like(q)})`
    : undefined;
  const [rows, [total]] = await Promise.all([
    db
      .select({
        id: conversations.id,
        lastMessageAt: conversations.lastMessageAt,
        messages: sql<number>`(select count(*)::int from messages m where m.conversation_id = conversations.id)`,
        held: sql<number>`(select count(*)::int from messages m where m.conversation_id = conversations.id and m.status = 'blocked' and m.reviewed_at is null)`,
        reportsOpen: sql<number>`(select count(*)::int from message_reports r join messages m on m.id = r.message_id where m.conversation_id = conversations.id and r.status = 'open')`,
      })
      .from(conversations)
      .where(match)
      .orderBy(desc(conversations.lastMessageAt))
      .limit(ADMIN_PAGE_SIZE)
      .offset(offset(page)),
    db.select({ n: count() }).from(conversations).where(match),
  ]);

  const members = rows.length
    ? await db
        .select({ conversationId: conversationMembers.conversationId, ...userRef })
        .from(conversationMembers)
        .innerJoin(users, eq(users.id, conversationMembers.userId))
        .where(inArray(conversationMembers.conversationId, rows.map((r) => r.id)))
    : [];
  return {
    rows: rows.map((r) => ({ ...r, members: members.filter((m) => m.conversationId === r.id) })),
    total: total?.n ?? 0,
  };
}

export type AdminMessage = {
  id: number;
  senderId: string;
  /** Manager who wrote it for the sender's profile. */
  writtenBy: string | null;
  body: string;
  status: MessageStatus;
  moderation: MessageModeration | null;
  reviewedBy: string | null;
  reviewedAt: Date | null;
  reportsOpen: number;
  createdAt: Date;
};

export type AdminConversation = {
  id: number;
  members: (AdminUserRef & { sanctions: GcsSanction[]; role: UserRole })[];
  post: { id: number; type: PostType; displayName: string } | null;
  messages: AdminMessage[];
  /** Messages older than the page exist: they load with `before` = the first shown id. */
  hasOlder: boolean;
  createdAt: Date;
};

const CONVERSATION_PAGE_SIZE = 200;

const reviewer = alias(users, "reviewer");
const writer = alias(users, "writer");
// Account that wrote a message, when it differs from the profile it was sent as.
const writerJoin = and(eq(writer.id, messages.sentById), ne(messages.sentById, messages.senderId));

export async function adminConversationExists(id: number): Promise<boolean> {
  await assertStaff();
  const [row] = await db.select({ id: conversations.id }).from(conversations).where(eq(conversations.id, id)).limit(1);
  return !!row;
}

/** A page of a conversation, the latest messages or those before the message `before`. */
export async function getAdminConversation(id: number, before: number | null = null): Promise<AdminConversation | null> {
  await assertStaff();
  const [conversation] = await db
    .select({ id: conversations.id, createdAt: conversations.createdAt, postId: posts.id, postType: posts.type, postName: posts.displayName })
    .from(conversations)
    .leftJoin(posts, eq(posts.id, conversations.postId))
    .where(eq(conversations.id, id))
    .limit(1);
  if (!conversation) return null;

  const [members, rows] = await Promise.all([
    db
      .select({ ...userRef, sanctions: users.gcsSanctions, role: users.role })
      .from(conversationMembers)
      .innerJoin(users, eq(users.id, conversationMembers.userId))
      .where(eq(conversationMembers.conversationId, id)),
    db
      .select({
        id: messages.id,
        senderId: messages.senderId,
        writtenBy: writer.username,
        body: messages.body,
        status: messages.status,
        moderation: messages.moderation,
        reviewedBy: reviewer.username,
        reviewedAt: messages.reviewedAt,
        reportsOpen: sql<number>`(select count(*)::int from message_reports r where r.message_id = messages.id and r.status = 'open')`,
        createdAt: messages.createdAt,
      })
      .from(messages)
      .leftJoin(reviewer, eq(reviewer.id, messages.reviewedById))
      .leftJoin(writer, writerJoin)
      .where(and(eq(messages.conversationId, id), before ? lt(messages.id, before) : undefined))
      .orderBy(desc(messages.id))
      .limit(CONVERSATION_PAGE_SIZE + 1),
  ]);

  return {
    id: conversation.id,
    createdAt: conversation.createdAt,
    members,
    post: conversation.postId && conversation.postType && conversation.postName ? { id: conversation.postId, type: conversation.postType, displayName: conversation.postName } : null,
    messages: rows.slice(0, CONVERSATION_PAGE_SIZE).reverse(),
    hasOlder: rows.length > CONVERSATION_PAGE_SIZE,
  };
}

// Automod queue

export type HeldMessage = {
  id: number;
  conversationId: number;
  sender: AdminUserRef;
  writtenBy: string | null;
  body: string;
  moderation: MessageModeration | null;
  createdAt: Date;
};

export async function listHeldMessages(page: number): Promise<Paged<HeldMessage>> {
  await assertStaff();
  const pending = and(eq(messages.status, "blocked"), isNull(messages.reviewedAt));
  const [rows, [total]] = await Promise.all([
    db
      .select({
        id: messages.id,
        conversationId: messages.conversationId,
        body: messages.body,
        moderation: messages.moderation,
        createdAt: messages.createdAt,
        sender: userRef,
        writtenBy: writer.username,
      })
      .from(messages)
      .innerJoin(users, eq(users.id, messages.senderId))
      .leftJoin(writer, writerJoin)
      .where(pending)
      .orderBy(messages.createdAt)
      .limit(ADMIN_PAGE_SIZE)
      .offset(offset(page)),
    db.select({ n: count() }).from(messages).where(pending),
  ]);
  return { rows, total: total?.n ?? 0 };
}

// Reports

export type ReportStatus = "open" | "handled" | "dismissed";

export type AdminMessageReport = {
  id: number;
  status: ReportStatus;
  reason: ReportReason;
  details: string;
  createdAt: Date;
  handledBy: string | null;
  reporter: AdminUserRef | null;
  message: { id: number; conversationId: number; body: string; status: MessageStatus; createdAt: Date; sender: AdminUserRef; writtenBy: string | null };
};

const reporter = alias(users, "reporter");
const handler = alias(users, "handler");
const sender = alias(users, "sender");

export async function listMessageReports({ status, page }: { status: ReportStatus; page: number }): Promise<Paged<AdminMessageReport>> {
  await assertStaff();
  const where = eq(messageReports.status, status);
  const [rows, [total]] = await Promise.all([
    db
      .select({
        id: messageReports.id,
        status: messageReports.status,
        reason: messageReports.reason,
        details: messageReports.message,
        createdAt: messageReports.createdAt,
        handledBy: handler.username,
        reporterId: reporter.id,
        reporterName: reporter.username,
        reporterAvatar: reporter.avatarUrl,
        reporterGcs: reporter.gcsUserId,
        messageId: messages.id,
        conversationId: messages.conversationId,
        body: messages.body,
        messageStatus: messages.status,
        messageCreatedAt: messages.createdAt,
        sender: { id: sender.id, username: sender.username, avatarUrl: sender.avatarUrl, gcsUserId: sender.gcsUserId },
        writtenBy: writer.username,
      })
      .from(messageReports)
      .innerJoin(messages, eq(messages.id, messageReports.messageId))
      .innerJoin(sender, eq(sender.id, messages.senderId))
      .leftJoin(writer, writerJoin)
      .leftJoin(reporter, eq(reporter.id, messageReports.reporterId))
      .leftJoin(handler, eq(handler.id, messageReports.handledById))
      .where(where)
      .orderBy(status === "open" ? messageReports.createdAt : desc(messageReports.handledAt))
      .limit(ADMIN_PAGE_SIZE)
      .offset(offset(page)),
    db.select({ n: count() }).from(messageReports).where(where),
  ]);
  return {
    rows: rows.map((r) => ({
      id: r.id,
      status: r.status,
      reason: r.reason,
      details: r.details,
      createdAt: r.createdAt,
      handledBy: r.handledBy,
      reporter: r.reporterId ? { id: r.reporterId, username: r.reporterName!, avatarUrl: r.reporterAvatar, gcsUserId: r.reporterGcs! } : null,
      message: { id: r.messageId, conversationId: r.conversationId, body: r.body, status: r.messageStatus, createdAt: r.messageCreatedAt, sender: r.sender, writtenBy: r.writtenBy },
    })),
    total: total?.n ?? 0,
  };
}

export type AdminPostReport = {
  id: number;
  status: ReportStatus;
  reason: ReportReason;
  details: string;
  createdAt: Date;
  handledBy: string | null;
  reporter: { username: string | null; discordId: string | null };
  post: { id: number; type: PostType; displayName: string; status: "active" | "closed" | "removed"; visible: boolean };
};

export async function listPostReports({ status, page }: { status: ReportStatus; page: number }): Promise<Paged<AdminPostReport>> {
  await assertStaff();
  const where = eq(reports.status, status);
  const [rows, [total]] = await Promise.all([
    db
      .select({
        id: reports.id,
        status: reports.status,
        reason: reports.reason,
        details: reports.message,
        createdAt: reports.createdAt,
        handledBy: sql<string | null>`coalesce(${handler.username}, ${reports.handledByDiscordId})`,
        reporterName: reporter.username,
        reporterDiscordId: reports.reporterDiscordId,
        postId: posts.id,
        postType: posts.type,
        postName: posts.displayName,
        postStatus: posts.status,
        visible: sql<boolean>`${posts.status} = 'active' and ${posts.deletedAt} is null and ${posts.expiresAt} > now()`,
      })
      .from(reports)
      .innerJoin(posts, eq(posts.id, reports.postId))
      .leftJoin(reporter, eq(reporter.id, reports.reporterUserId))
      .leftJoin(handler, eq(handler.id, reports.handledByUserId))
      .where(where)
      .orderBy(status === "open" ? reports.createdAt : desc(reports.handledAt))
      .limit(ADMIN_PAGE_SIZE)
      .offset(offset(page)),
    db.select({ n: count() }).from(reports).where(where),
  ]);
  return {
    rows: rows.map((r) => ({
      id: r.id,
      status: r.status,
      reason: r.reason,
      details: r.details,
      createdAt: r.createdAt,
      handledBy: r.handledBy,
      reporter: { username: r.reporterName, discordId: r.reporterDiscordId },
      post: { id: r.postId, type: r.postType, displayName: r.postName, status: r.postStatus, visible: r.visible },
    })),
    total: total?.n ?? 0,
  };
}

// Posts

export type AdminPostState = "visible" | "expired" | "closed" | "removed" | "deleted";
export const ADMIN_POST_STATES: AdminPostState[] = ["visible", "expired", "closed", "removed", "deleted"];

export type AdminPostRow = {
  id: number;
  type: PostType;
  displayName: string;
  state: AdminPostState;
  author: AdminUserRef;
  reportsOpen: number;
  bumpedAt: Date;
  expiresAt: Date;
};

/** Removed by the staff (its last moderation action is a removal), deleted by its author otherwise. */
const removedByStaff = sql<boolean>`posts.status = 'removed' and coalesce((
  select ma.action = 'remove' from moderation_actions ma
  where ma.post_id = posts.id and ma.action in ('remove', 'restore')
  order by ma.created_at desc, ma.id desc limit 1
), false)`;

function stateFilter(state: AdminPostState | ""): SQL | undefined {
  switch (state) {
    case "visible":
      return and(eq(posts.status, "active"), gt(posts.expiresAt, sql`now()`));
    case "expired":
      return and(eq(posts.status, "active"), sql`${posts.expiresAt} <= now()`);
    case "closed":
      return eq(posts.status, "closed");
    case "removed":
      return removedByStaff;
    case "deleted":
      return and(eq(posts.status, "removed"), sql`not ${removedByStaff}`);
    default:
      return undefined;
  }
}

export async function listAdminPosts({ q, state, type, page }: { q: string; state: AdminPostState | ""; type: PostType | ""; page: number }): Promise<Paged<AdminPostRow>> {
  await assertStaff();
  const where = and(
    q ? or(ilike(posts.displayName, like(q)), ilike(users.username, like(q))) : undefined,
    type ? eq(posts.type, type) : undefined,
    stateFilter(state),
  );
  const [rows, [total]] = await Promise.all([
    db
      .select({
        id: posts.id,
        type: posts.type,
        displayName: posts.displayName,
        status: posts.status,
        removedByStaff,
        bumpedAt: posts.bumpedAt,
        expiresAt: posts.expiresAt,
        reportsOpen: sql<number>`(select count(*)::int from reports r where r.post_id = posts.id and r.status = 'open')`,
        author: userRef,
      })
      .from(posts)
      .innerJoin(users, eq(users.id, posts.authorId))
      .where(where)
      .orderBy(desc(posts.bumpedAt))
      .limit(ADMIN_PAGE_SIZE)
      .offset(offset(page)),
    db.select({ n: count() }).from(posts).innerJoin(users, eq(users.id, posts.authorId)).where(where),
  ]);
  const now = Date.now();
  return {
    rows: rows.map(({ status, removedByStaff: byStaff, ...r }) => ({
      ...r,
      state: status === "removed" ? (byStaff ? "removed" : "deleted") : status === "closed" ? "closed" : r.expiresAt.getTime() <= now ? "expired" : "visible",
    })),
    total: total?.n ?? 0,
  };
}

// Users

export type AdminUserRow = AdminUserRef & {
  role: UserRole;
  sanctions: GcsSanction[];
  gcsCreatedAt: Date | null;
  createdAt: Date;
  lastLoginAt: Date | null;
  posts: number;
};

const adminUserColumns = {
  ...userRef,
  role: users.role,
  sanctions: users.gcsSanctions,
  gcsCreatedAt: users.gcsCreatedAt,
  createdAt: users.createdAt,
  lastLoginAt: users.lastLoginAt,
  posts: sql<number>`(select count(*)::int from posts p where p.author_id = users.id and p.deleted_at is null)`,
};

export async function listAdminUsers({ q, role, page }: { q: string; role: UserRole | ""; page: number }): Promise<Paged<AdminUserRow>> {
  await assertStaff();
  const where = and(q ? ilike(users.username, like(q)) : undefined, role ? eq(users.role, role) : undefined);
  const [rows, [total]] = await Promise.all([
    db.select(adminUserColumns).from(users).where(where).orderBy(desc(users.lastLoginAt), desc(users.createdAt)).limit(ADMIN_PAGE_SIZE).offset(offset(page)),
    db.select({ n: count() }).from(users).where(where),
  ]);
  return { rows, total: total?.n ?? 0 };
}

export type AdminUserDetail = AdminUserRow & {
  email: string | null;
  discordId: string | null;
  sanctionsCheckedAt: Date | null;
  conversations: { id: number; peer: string; lastMessageAt: Date }[];
};

export async function adminUserExists(id: string): Promise<boolean> {
  await assertStaff();
  const [row] = await db.select({ id: users.id }).from(users).where(eq(users.id, id)).limit(1);
  return !!row;
}

export async function getAdminUser(id: string): Promise<AdminUserDetail | null> {
  await assertStaff();
  const [user] = await db
    .select({ ...adminUserColumns, email: users.email, discordId: users.discordId, sanctionsCheckedAt: users.sanctionsCheckedAt })
    .from(users)
    .where(eq(users.id, id))
    .limit(1);
  if (!user) return null;

  const peer = alias(conversationMembers, "peer");
  const peerUser = alias(users, "peer_user");
  const list = await db
    .select({ id: conversations.id, peer: peerUser.username, lastMessageAt: conversations.lastMessageAt })
    .from(conversationMembers)
    .innerJoin(conversations, eq(conversations.id, conversationMembers.conversationId))
    .innerJoin(peer, and(eq(peer.conversationId, conversations.id), sql`${peer.userId} <> ${id}`))
    .innerJoin(peerUser, eq(peerUser.id, peer.userId))
    .where(eq(conversationMembers.userId, id))
    .orderBy(desc(conversations.lastMessageAt))
    .limit(50);
  return { ...user, conversations: list };
}

export async function listStaff(): Promise<AdminUserRow[]> {
  await assertStaff();
  return db.select(adminUserColumns).from(users).where(inArray(users.role, ["staff", "admin"])).orderBy(users.role, users.username);
}
