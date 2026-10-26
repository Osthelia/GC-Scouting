/**
 * GC-Scouting - posts
 *
 * Schema of posts, reports and related tables.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

import { sql } from "drizzle-orm";
import {
  bigint,
  bigserial,
  boolean,
  char,
  check,
  index,
  jsonb,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";
import { PLAYERS_WANTED_MAX, RANK_KEYS, SUBS_WANTED_MAX, type GcsPronoun, type GcsTeamRole } from "../constants";
import type { AvailabilitySlot, Experience, TierList } from "../derived";
import { RIOT_ID_MAX } from "../tracker";
import { users } from "./auth";
import { int4multirange } from "./custom-types";
import { actionTokenActionEnum, ageGroupEnum, agentRoleEnum, compensationEnum, iglRoleEnum, lanOptionEnum, postStatusEnum, rosterSpotEnum, postTypeEnum, regionEnum, staffRoleEnum, tournamentLevelEnum, tweetByEnum } from "./enums";

/** Agent representing the author, the contact fields then reach the agent. */
export type PostAgent = { name: string; agency: string | null };

/** `discord` is a user ID (a username on older posts), `discordInvite` an invite code (LFP, LFS, LFO). */
export type PostContact = { discord?: string; discordInvite?: string; twitter?: string; email?: string; agent?: PostAgent };

/** Final placement range, [1, 1] for a win, [5, 8] for a 5th to 8th place. */
export type GcsPlacement = [best: number, worst: number];

export type GcsTeamEntry = {
  id: number;
  name: string;
  logoUrl: string | null;
  role: GcsTeamRole;
  /** ISO dates (YYYY-MM-DD), `until` null while still in the team. */
  since: string | null;
  until: string | null;
};

export type GcsTournamentEntry = {
  id: number;
  name: string;
  logoUrl: string | null;
  /** ISO date of the tournament start. */
  date: string;
  placement: GcsPlacement | null;
  /** Series won and lost, null when GC Stats has none (missing on older snapshots). */
  record: { wins: number; losses: number } | null;
};

/** Snapshot of the GC Stats history shown on posts. Lists hold the latest entries first. */
export type GcsSummary = {
  tournaments: number;
  bestPlacement: GcsPlacement | null;
  teams: GcsTeamEntry[];
  recentTournaments: GcsTournamentEntry[];
  /** Pronouns of the player, missing on team snapshots and older ones. */
  pronoun?: GcsPronoun | null;
};

const RANK_MAX_INDEX = RANK_KEYS.length - 1;

export const posts = pgTable(
  "posts",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    authorId: text("author_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: postTypeEnum("type").notNull(),
    status: postStatusEnum("status").notNull().default("active"),
    displayName: varchar("display_name", { length: 32 }).notNull(),
    gcsTeamId: bigint("gcs_team_id", { mode: "number" }),

    region: regionEnum("region").notNull(),
    country: char("country", { length: 2 }),
    // ISO 639-1 codes.
    languages: varchar("languages", { length: 2 }).array().notNull(),
    roles: agentRoleEnum("roles").array().notNull().default(sql`'{}'`),
    igl: iglRoleEnum("igl").array().notNull().default(sql`'{}'`),
    // LFT and LFP only.
    rosterSpot: rosterSpotEnum("roster_spot"),
    // LFP only, rosterSpot is then derived from them.
    playersWanted: smallint("players_wanted"),
    subsWanted: smallint("subs_wanted"),
    staffRoles: staffRoleEnum("staff_roles").array().notNull().default(sql`'{}'`),
    // Required by the form on every type, null on non LFO posts made before it.
    compensation: compensationEnum("compensation"),
    // LFT, LFP, LFS and LFST. Required by the form, null on posts made before it.
    lan: lanOptionEnum("lan"),
    // LFT only, not required.
    ageGroup: ageGroupEnum("age_group"),
    // LFP, LFS and LFST. Required by the form, null on posts made before it.
    minorsAccepted: boolean("minors_accepted"),

    // Index in RANK_KEYS. Current/peak for players, min/max range for team searches.
    rankCurrent: smallint("rank_current"),
    rankPeak: smallint("rank_peak"),
    rankMin: smallint("rank_min"),
    rankMax: smallint("rank_max"),
    // LFT only, not required. Riot ID of the tracker.gg profile.
    trackerRiotId: varchar("tracker_riot_id", { length: RIOT_ID_MAX }),

    // Months played at each tournament level.
    experience: jsonb("experience").$type<Experience>().notNull().default({}),
    // Levels of `experience`, derived on write for the GIN filter.
    tournamentLevels: tournamentLevelEnum("tournament_levels").array().notNull().default(sql`'{}'`),

    tierList: jsonb("tier_list").$type<TierList>(),
    // Agents in the top tiers, derived from tier_list on write for the "can play X" filter.
    strongAgents: text("strong_agents").array().notNull().default(sql`'{}'::text[]`),

    // IANA timezone the availability was entered in.
    timezone: text("timezone").notNull(),
    availability: jsonb("availability").$type<AvailabilitySlot[]>().notNull().default([]),
    // Same slots as minutes of the week in UTC (0 to 10080), recomputed on every write and renewal.
    availabilityUtc: int4multirange("availability_utc").notNull().default(sql`'{}'::int4multirange`),
    // Declared rhythm: most time per week given to the team, within the availability.
    weeklyMinutes: smallint("weekly_minutes").notNull().default(0),
    activeDays: smallint("active_days").notNull().default(0),

    description: text("description").notNull().default(""),
    contact: jsonb("contact").$type<PostContact>().notNull().default({}),
    // Visitors can start a conversation with the author from the post.
    chatEnabled: boolean("chat_enabled").notNull().default(true),

    gcsSummary: jsonb("gcs_summary").$type<GcsSummary>(),
    gcsSummarySyncedAt: timestamp("gcs_summary_synced_at", { withTimezone: true }),

    publishedAt: timestamp("published_at", { withTimezone: true }).notNull().defaultNow(),
    // Default sort key, moved forward on renewal.
    bumpedAt: timestamp("bumped_at", { withTimezone: true }).notNull().defaultNow(),
    // Expiry is computed on read (expires_at > now()), there is no "expired" status.
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    // Reset to null on renewal, one reminder per cycle.
    expiryNoticeSentAt: timestamp("expiry_notice_sent_at", { withTimezone: true }),

    tweetBy: tweetByEnum("tweet_by").notNull().default("site"),
    // Status id of the author's own tweet, retweeted by GC Scouting.
    authorTweetId: varchar("author_tweet_id", { length: 20 }),
    // Our tweet, or our retweet of the author's one.
    tweetedAt: timestamp("tweeted_at", { withTimezone: true }),
    tweetedByDiscordId: text("tweeted_by_discord_id"),

    closedAt: timestamp("closed_at", { withTimezone: true }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    uniqueIndex("posts_single_active_per_type")
      .on(t.authorId, t.type)
      .where(sql`${t.type} in ('lft', 'lfst') and ${t.status} = 'active'`),
    index("posts_feed_idx")
      .on(t.bumpedAt.desc())
      .where(sql`${t.status} = 'active' and ${t.deletedAt} is null`),
    index("posts_type_region_idx").on(t.type, t.region),
    index("posts_author_idx").on(t.authorId),
    index("posts_expiry_notice_idx")
      .on(t.expiresAt)
      .where(sql`${t.status} = 'active' and ${t.expiryNoticeSentAt} is null`),
    index("posts_languages_idx").using("gin", t.languages),
    index("posts_roles_idx").using("gin", t.roles),
    index("posts_staff_roles_idx").using("gin", t.staffRoles),
    index("posts_tournament_levels_idx").using("gin", t.tournamentLevels),
    index("posts_strong_agents_idx").using("gin", t.strongAgents),
    index("posts_availability_idx").using("gist", t.availabilityUtc),
    check("posts_roster_spot_type", sql`(${t.type} in ('lft', 'lfp')) = (${t.rosterSpot} is not null)`),
    check("posts_wanted_type", sql`(${t.type} = 'lfp') = (${t.playersWanted} is not null and ${t.subsWanted} is not null)`),
    check("posts_wanted_range", sql`${t.playersWanted} between 0 and ${sql.raw(String(PLAYERS_WANTED_MAX))} and ${t.subsWanted} between 0 and ${sql.raw(String(SUBS_WANTED_MAX))}`),
    check("posts_wanted_not_empty", sql`${t.playersWanted} + ${t.subsWanted} > 0`),
    check("posts_compensation_type", sql`${t.type} <> 'lfo' or ${t.compensation} is not null`),
    check("posts_age_group_type", sql`${t.ageGroup} is null or ${t.type} = 'lft'`),
    check("posts_lan_type", sql`${t.lan} is null or ${t.type} in ('lft', 'lfp', 'lfs', 'lfst')`),
    check("posts_tracker_riot_id_type", sql`${t.trackerRiotId} is null or ${t.type} = 'lft'`),
    check("posts_minors_accepted_type", sql`${t.minorsAccepted} is null or ${t.type} in ('lfp', 'lfs', 'lfst')`),
    check("posts_languages_not_empty", sql`cardinality(${t.languages}) > 0`),
    check("posts_rank_current_range", sql`${t.rankCurrent} between 0 and ${sql.raw(String(RANK_MAX_INDEX))}`),
    check("posts_rank_peak_range", sql`${t.rankPeak} between 0 and ${sql.raw(String(RANK_MAX_INDEX))}`),
    check("posts_rank_min_range", sql`${t.rankMin} between 0 and ${sql.raw(String(RANK_MAX_INDEX))}`),
    check("posts_rank_max_range", sql`${t.rankMax} between 0 and ${sql.raw(String(RANK_MAX_INDEX))}`),
    check("posts_rank_min_max", sql`${t.rankMin} is null or ${t.rankMax} is null or ${t.rankMin} <= ${t.rankMax}`),
    check("posts_weekly_minutes_range", sql`${t.weeklyMinutes} between 0 and 10080`),
    check("posts_active_days_range", sql`${t.activeDays} between 0 and 7`),
    check("posts_author_tweet_by_author", sql`${t.authorTweetId} is null or ${t.tweetBy} = 'author'`),
    check("posts_removed_has_deleted_at", sql`(${t.status} = 'removed') = (${t.deletedAt} is not null)`),
  ],
);

// One click renew/delete links sent with the expiry reminder. Single use.
export const actionTokens = pgTable(
  "action_tokens",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    postId: bigint("post_id", { mode: "number" })
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    action: actionTokenActionEnum("action").notNull(),
    // sha256 of the token sent in the link.
    tokenHash: text("token_hash").notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("action_tokens_post_idx").on(t.postId)],
);

// Edits saved by the author, counted by the edit rate limit.
export const postEdits = pgTable(
  "post_edits",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    postId: bigint("post_id", { mode: "number" })
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("post_edits_post_idx").on(t.postId, t.createdAt)],
);
