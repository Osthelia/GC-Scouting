/**
 * GC-Scouting - chat
 *
 * Schema of conversations and messages.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

import { sql } from "drizzle-orm";
import { bigint, bigserial, check, index, jsonb, pgTable, primaryKey, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { users } from "./auth";
import { messageStatusEnum, reportReasonEnum, reportStatusEnum } from "./enums";
import { posts } from "./posts";

/** Automod result, null while the message was not checked (OpenAI unavailable or not configured). */
export type MessageModeration = { flagged: boolean; categories: string[] };

// One conversation per pair of profiles, started from a post.
export const conversations = pgTable(
  "conversations",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    // Both member ids, sorted and joined: a pair never gets a second conversation.
    pairKey: text("pair_key").notNull().unique(),
    // Post the conversation was started from.
    postId: bigint("post_id", { mode: "number" }).references(() => posts.id, { onDelete: "set null" }),
    createdById: text("created_by_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    lastMessageAt: timestamp("last_message_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("conversations_last_message_idx").on(t.lastMessageAt.desc()),
    index("conversations_post_idx").on(t.postId).where(sql`${t.postId} is not null`),
    index("conversations_created_by_idx").on(t.createdById).where(sql`${t.createdById} is not null`),
  ],
);

export const conversationMembers = pgTable(
  "conversation_members",
  {
    conversationId: bigint("conversation_id", { mode: "number" })
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    lastReadAt: timestamp("last_read_at", { withTimezone: true }).notNull().defaultNow(),
    // Last email/Discord alert, one per unread streak.
    notifiedAt: timestamp("notified_at", { withTimezone: true }),
  },
  (t) => [primaryKey({ columns: [t.conversationId, t.userId] }), index("conversation_members_user_idx").on(t.userId)],
);

export const messages = pgTable(
  "messages",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    conversationId: bigint("conversation_id", { mode: "number" })
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    // Profile the message is written as.
    senderId: text("sender_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    // Logged in account that wrote it, differs from the sender for a delegate.
    sentById: text("sent_by_id").references(() => users.id, { onDelete: "set null" }),
    body: text("body").notNull(),
    status: messageStatusEnum("status").notNull().default("visible"),
    moderation: jsonb("moderation").$type<MessageModeration>(),
    // Staff decision on a blocked or hidden message.
    reviewedById: text("reviewed_by_id").references(() => users.id, { onDelete: "set null" }),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("messages_conversation_idx").on(t.conversationId, t.id),
    index("messages_blocked_idx").on(t.createdAt).where(sql`${t.status} = 'blocked' and ${t.reviewedAt} is null`),
    index("messages_sender_idx").on(t.senderId, t.createdAt),
    index("messages_sent_by_idx").on(t.sentById).where(sql`${t.sentById} is not null`),
    index("messages_reviewed_by_idx").on(t.reviewedById).where(sql`${t.reviewedById} is not null`),
  ],
);

export const userBlocks = pgTable(
  "user_blocks",
  {
    blockerId: text("blocker_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    blockedId: text("blocked_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.blockerId, t.blockedId] }),
    index("user_blocks_blocked_idx").on(t.blockedId),
    check("user_blocks_not_self", sql`${t.blockerId} <> ${t.blockedId}`),
  ],
);

export const messageReports = pgTable(
  "message_reports",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    messageId: bigint("message_id", { mode: "number" })
      .notNull()
      .references(() => messages.id, { onDelete: "cascade" }),
    reporterId: text("reporter_id").references(() => users.id, { onDelete: "set null" }),
    reason: reportReasonEnum("reason").notNull(),
    message: text("message").notNull().default(""),
    status: reportStatusEnum("status").notNull().default("open"),
    handledById: text("handled_by_id").references(() => users.id, { onDelete: "set null" }),
    handledAt: timestamp("handled_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("message_reports_one_per_reporter").on(t.messageId, t.reporterId),
    index("message_reports_open_idx").on(t.createdAt).where(sql`${t.status} = 'open'`),
    index("message_reports_reporter_idx").on(t.reporterId).where(sql`${t.reporterId} is not null`),
    index("message_reports_handled_by_idx").on(t.handledById).where(sql`${t.handledById} is not null`),
  ],
);
