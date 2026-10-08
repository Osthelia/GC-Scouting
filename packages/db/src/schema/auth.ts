/**
 * GC-Scouting - auth
 *
 * Schema of users, OAuth tokens, sessions and delegations.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

import { sql } from "drizzle-orm";
import { bigint, bigserial, boolean, check, index, jsonb, pgTable, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/pg-core";
import type { GcsSanctionType } from "../constants";
import { playerLinkStatusEnum, userRoleEnum } from "./enums";

/** Active GC Stats sanction, ISO dates, `endsAt` null when permanent. */
export type GcsSanction = { id: number; type: GcsSanctionType; startsAt: string; endsAt: string | null };

export const users = pgTable("users", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  // OAuth `sub` from GC Stats.
  gcsUserId: text("gcs_user_id").notNull().unique(),
  username: varchar("username", { length: 32 }).notNull(),
  avatarUrl: text("avatar_url"),
  email: text("email"),
  discordId: text("discord_id").unique(),
  notifyEmail: boolean("notify_email").notNull().default(false),
  notifyDiscord: boolean("notify_discord").notNull().default(false),
  // Set once the notification opt in has been asked on the first post.
  notifyPromptedAt: timestamp("notify_prompted_at", { withTimezone: true }),
  locale: varchar("locale", { length: 5 }).notNull().default("en"),
  role: userRoleEnum("role").notNull().default("user"),
  // New message alerts, separate from the expiry reminders.
  chatNotifyEmail: boolean("chat_notify_email").notNull().default(true),
  chatNotifyDiscord: boolean("chat_notify_discord").notNull().default(true),
  // Creation of the GC Stats account (claim `createdAt`), for the "recent account" badge.
  gcsCreatedAt: timestamp("gcs_created_at", { withTimezone: true }),
  // Active sanctions read from GC Stats (scope `sanctions`), refreshed at login and before a message or a post.
  gcsSanctions: jsonb("gcs_sanctions").$type<GcsSanction[]>().notNull().default([]),
  sanctionsCheckedAt: timestamp("sanctions_checked_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
});

// Kept apart from `users` so secrets are never loaded with the profile. Encrypted at rest.
export const oauthTokens = pgTable("oauth_tokens", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  accessTokenEnc: text("access_token_enc").notNull(),
  refreshTokenEnc: text("refresh_token_enc"),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  scopes: text("scopes").array().notNull().default(sql`'{}'::text[]`),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const sessions = pgTable(
  "sessions",
  {
    // sha256 of the cookie value, the raw token is never stored.
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    userAgent: text("user_agent"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

// Link between an account and a GC Stats player profile. Post badges are read from here, never stored on posts.
export const playerLinks = pgTable(
  "player_links",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    gcsPersonId: bigint("gcs_person_id", { mode: "number" }).notNull(),
    // Null when the profile was already linked on GC Stats (`userinfo.player`).
    gcsChangeRequestId: bigint("gcs_change_request_id", { mode: "number" }),
    status: playerLinkStatusEnum("status").notNull().default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    // Last status poll against GC Stats.
    checkedAt: timestamp("checked_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("player_links_one_active_per_user").on(t.userId).where(sql`${t.status} in ('pending', 'approved')`),
    index("player_links_pending_idx").on(t.checkedAt).where(sql`${t.status} = 'pending'`),
  ],
);

// Access given by a profile owner to another account: the delegate can post and manage posts in the owner's name.
export const profileDelegations = pgTable(
  "profile_delegations",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    delegateId: text("delegate_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("profile_delegations_pair").on(t.ownerId, t.delegateId),
    index("profile_delegations_delegate_idx").on(t.delegateId),
    check("profile_delegations_not_self", sql`${t.ownerId} <> ${t.delegateId}`),
  ],
);

// Invite links sent by an owner to give access to their profile. Single use.
export const delegationInvites = pgTable(
  "delegation_invites",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    // sha256 of the token sent in the link.
    tokenHash: text("token_hash").notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("delegation_invites_owner_idx").on(t.ownerId)],
);
