/**
 * GC-Scouting - discord
 *
 * Schema of Discord channels, deliveries and sync leases.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

import { sql } from "drizzle-orm";
import { bigint, bigserial, boolean, check, index, jsonb, pgTable, text, timestamp, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";
import { users } from "./auth";
import { discordChannelKindEnum, moderationActionEnum, reportReasonEnum, reportStatusEnum } from "./enums";
import { posts } from "./posts";

export const discordChannels = pgTable(
  "discord_channels",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    guildId: text("guild_id").notNull(),
    channelId: text("channel_id").notNull().unique(),
    kind: discordChannelKindEnum("kind").notNull().default("feed"),
    // Same shape as the /posts filters, validated by the same schema.
    filters: jsonb("filters").$type<Record<string, unknown>>().notNull().default({}),
    // Role allowed to use the moderation buttons (moderation channels only).
    moderatorRoleId: text("moderator_role_id"),
    locale: varchar("locale", { length: 5 }).notNull().default("en"),
    enabled: boolean("enabled").notNull().default(true),
    createdByDiscordId: text("created_by_discord_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("discord_channels_guild_idx").on(t.guildId),
    check("discord_channels_moderator_role", sql`${t.kind} = 'moderation' or ${t.moderatorRoleId} is null`),
  ],
);

// A post is sent again to a channel only if bumped after the last delivery.
export const discordDeliveries = pgTable(
  "discord_deliveries",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    postId: bigint("post_id", { mode: "number" })
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    channelConfigId: bigint("channel_config_id", { mode: "number" })
      .notNull()
      .references(() => discordChannels.id, { onDelete: "cascade" }),
    messageId: text("message_id").notNull(),
    sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("discord_deliveries_post_channel_idx").on(t.postId, t.channelConfigId, t.sentAt),
    index("discord_deliveries_channel_idx").on(t.channelConfigId),
  ],
);

// Post being synced to Discord by one bot call. A refresh asked meanwhile is run by that call once done.
export const discordSyncLeases = pgTable("discord_sync_leases", {
  postId: bigint("post_id", { mode: "number" })
    .primaryKey()
    .references(() => posts.id, { onDelete: "cascade" }),
  holder: uuid("holder").notNull(),
  // A call cut off by the Worker limit frees the post once this is past.
  lockedUntil: timestamp("locked_until", { withTimezone: true }).notNull(),
  refreshPending: boolean("refresh_pending").notNull().default(false),
});

// Messages of a deleted account left to delete by the bot, kept until Discord confirms.
export const discordMessagePurges = pgTable(
  "discord_message_purges",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    channelId: text("channel_id").notNull(),
    messageId: text("message_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("discord_message_purges_message_idx").on(t.channelId, t.messageId)],
);

export const reports = pgTable(
  "reports",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    postId: bigint("post_id", { mode: "number" })
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    reporterUserId: text("reporter_user_id").references(() => users.id, { onDelete: "set null" }),
    reporterDiscordId: text("reporter_discord_id"),
    reason: reportReasonEnum("reason").notNull(),
    message: text("message").notNull().default(""),
    status: reportStatusEnum("status").notNull().default("open"),
    // Message posted in the moderation channel, to update its buttons once handled.
    moderationMessageId: text("moderation_message_id"),
    handledByDiscordId: text("handled_by_discord_id"),
    // Staff member who handled it from the site admin.
    handledByUserId: text("handled_by_user_id").references(() => users.id, { onDelete: "set null" }),
    handledAt: timestamp("handled_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("reports_post_idx").on(t.postId),
    index("reports_open_idx").on(t.createdAt).where(sql`${t.status} = 'open'`),
    index("reports_reporter_user_idx").on(t.reporterUserId).where(sql`${t.reporterUserId} is not null`),
    index("reports_handled_by_user_idx").on(t.handledByUserId).where(sql`${t.handledByUserId} is not null`),
    check("reports_has_reporter", sql`${t.reporterUserId} is not null or ${t.reporterDiscordId} is not null`),
  ],
);

export const moderationActions = pgTable(
  "moderation_actions",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    postId: bigint("post_id", { mode: "number" })
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    reportId: bigint("report_id", { mode: "number" }).references(() => reports.id, { onDelete: "set null" }),
    action: moderationActionEnum("action").notNull(),
    // Moderator on Discord, or staff member on the site admin.
    discordUserId: text("discord_user_id"),
    actorUserId: text("actor_user_id").references(() => users.id, { onDelete: "set null" }),
    // Cloudflare Access identity (email or Service Token) for actions from the tweets page.
    accessSubject: text("access_subject"),
    reason: text("reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("moderation_actions_post_idx").on(t.postId),
    index("moderation_actions_report_idx").on(t.reportId).where(sql`${t.reportId} is not null`),
    index("moderation_actions_actor_user_idx").on(t.actorUserId).where(sql`${t.actorUserId} is not null`),
  ],
);
