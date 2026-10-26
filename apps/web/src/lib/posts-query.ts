/**
 * GC-Scouting - posts-query
 *
 * Database queries that build the post views and cards.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

import { cache } from "react";
import { connection } from "next/server";
import { and, desc, eq, inArray, isNull, ne, sql, type SQL } from "drizzle-orm";
import { db } from "@scouting/db/client";
import { playerLinks, posts, visiblePost, type PostType, type Region } from "@scouting/db";
import { parseMultirange } from "@scouting/db/derived";
import type { PostCardView, PostView, ProfileStatus } from "./posts";

// Server side reads of public posts. Every call opts the page out of static rendering.

const visible = visiblePost;

type PostRow = typeof posts.$inferSelect;

/** Profile badge of each author, from their active GC Stats link. */
async function profilesOf(authorIds: string[]): Promise<Map<string, { status: ProfileStatus; gcsPersonId: number }>> {
  if (authorIds.length === 0) return new Map();
  const rows = await db
    .select({ userId: playerLinks.userId, status: playerLinks.status, gcsPersonId: playerLinks.gcsPersonId })
    .from(playerLinks)
    .where(and(inArray(playerLinks.userId, [...new Set(authorIds)]), inArray(playerLinks.status, ["pending", "approved"])));
  return new Map(rows.map((r) => [r.userId, { status: r.status === "approved" ? "verified" : "pending", gcsPersonId: r.gcsPersonId }]));
}

function toView(row: PostRow, profile?: { status: ProfileStatus; gcsPersonId: number }): PostView {
  return {
    id: row.id,
    type: row.type,
    status: row.status === "closed" ? "closed" : "active",
    displayName: row.displayName,
    profile: profile?.status ?? "none",
    gcsPersonId: profile?.status === "verified" ? profile.gcsPersonId : null,
    gcsTeamId: row.gcsTeamId,
    region: row.region,
    country: row.country,
    languages: row.languages,
    roles: row.roles,
    igl: row.igl,
    rosterSpot: row.rosterSpot,
    playersWanted: row.playersWanted,
    subsWanted: row.subsWanted,
    staffRoles: row.staffRoles,
    compensation: row.compensation,
    lan: row.lan,
    ageGroup: row.ageGroup,
    minorsAccepted: row.minorsAccepted,
    rankCurrent: row.rankCurrent,
    rankPeak: row.rankPeak,
    rankMin: row.rankMin,
    rankMax: row.rankMax,
    trackerRiotId: row.trackerRiotId,
    experience: row.experience,
    tournamentLevels: row.tournamentLevels,
    tierList: row.tierList,
    strongAgents: row.strongAgents,
    timezone: row.timezone,
    availability: row.availability,
    weeklyMinutes: row.weeklyMinutes,
    availabilityUtc: parseMultirange(row.availabilityUtc),
    activeDays: row.activeDays,
    description: row.description,
    contact: row.contact,
    chatEnabled: row.chatEnabled,
    tweetBy: row.tweetBy,
    authorTweetId: row.authorTweetId,
    tweeted: row.tweetedAt !== null,
    gcsSummary: row.gcsSummary,
    gcsSummarySyncedAt: row.gcsSummarySyncedAt?.toISOString() ?? null,
    publishedAt: row.publishedAt.toISOString(),
    bumpedAt: row.bumpedAt.toISOString(),
    expiresAt: row.expiresAt.toISOString(),
  };
}

// Columns of a card, a list never sends contacts, description or tweet state.
const cardColumns = {
  id: posts.id,
  type: posts.type,
  displayName: posts.displayName,
  region: posts.region,
  languages: posts.languages,
  roles: posts.roles,
  igl: posts.igl,
  rosterSpot: posts.rosterSpot,
  playersWanted: posts.playersWanted,
  subsWanted: posts.subsWanted,
  staffRoles: posts.staffRoles,
  compensation: posts.compensation,
  lan: posts.lan,
  ageGroup: posts.ageGroup,
  minorsAccepted: posts.minorsAccepted,
  rankCurrent: posts.rankCurrent,
  rankMin: posts.rankMin,
  rankMax: posts.rankMax,
  experience: posts.experience,
  tournamentLevels: posts.tournamentLevels,
  tierList: posts.tierList,
  strongAgents: posts.strongAgents,
  weeklyMinutes: posts.weeklyMinutes,
  activeDays: posts.activeDays,
  availabilityUtc: posts.availabilityUtc,
  bumpedAt: posts.bumpedAt,
};

type CardRow = { [K in keyof typeof cardColumns]: PostRow[K] };

function toCardView(row: CardRow): PostCardView {
  return { ...row, availabilityUtc: parseMultirange(row.availabilityUtc), bumpedAt: row.bumpedAt.toISOString() };
}

async function withProfiles(rows: PostRow[]): Promise<PostView[]> {
  const profiles = await profilesOf(rows.map((r) => r.authorId));
  return rows.map((r) => toView(r, profiles.get(r.authorId)));
}

/** Cap of the list pages, above it the oldest posts are left out. */
const LIST_LIMIT = 500;

/** Visible posts, newest first. Filters and sort are applied on the client with the shared schema. */
export async function listPosts({ type, region, limit = LIST_LIMIT, where }: { type?: PostType; region?: Region; limit?: number; where?: SQL } = {}): Promise<PostCardView[]> {
  await connection();
  const rows = await db
    .select(cardColumns)
    .from(posts)
    .where(and(visible(), type ? eq(posts.type, type) : undefined, region ? eq(posts.region, region) : undefined, where))
    .orderBy(desc(posts.bumpedAt))
    .limit(limit);
  // Time to filter on the server: older posts are now out of reach of the filters.
  if (limit === LIST_LIMIT && rows.length === LIST_LIMIT) console.warn("Post list cap reached", { type: type ?? "all", limit });
  return rows.map(toCardView);
}

/** Any post that was not removed, expired and closed ones included (their links stay shared). Cached per request, the layout and the page share it. */
export const getPost = cache(async (id: number): Promise<PostView | null> => {
  await connection();
  const [row] = await db
    .select()
    .from(posts)
    .where(and(eq(posts.id, id), isNull(posts.deletedAt), ne(posts.status, "removed")))
    .limit(1);
  if (!row) return null;
  const [view] = await withProfiles([row]);
  return view!;
});

/** Every post of an author that was not removed, last renewed first. */
export async function listAuthorPosts(authorId: string): Promise<PostView[]> {
  await connection();
  const rows = await db
    .select()
    .from(posts)
    .where(and(eq(posts.authorId, authorId), isNull(posts.deletedAt), ne(posts.status, "removed")))
    .orderBy(desc(posts.bumpedAt))
    .limit(200);
  return withProfiles(rows);
}

/** Author account of a post, kept out of `PostView` (never sent to the client). */
export async function postAuthorId(postId: number): Promise<string | null> {
  const [row] = await db.select({ authorId: posts.authorId }).from(posts).where(eq(posts.id, postId)).limit(1);
  return row?.authorId ?? null;
}

export const isPostAuthor = cache(async (postId: number, userId: string): Promise<boolean> => {
  const [row] = await db.select({ id: posts.id }).from(posts).where(and(eq(posts.id, postId), eq(posts.authorId, userId))).limit(1);
  return !!row;
});

/** Other visible posts of the same type, same region first. */
export async function similarPosts(post: PostView, limit = 4): Promise<PostCardView[]> {
  await connection();
  const rows = await db
    .select(cardColumns)
    .from(posts)
    .where(and(visible(), eq(posts.type, post.type), ne(posts.id, post.id)))
    .orderBy(sql`${posts.region} = ${post.region} desc`, desc(posts.bumpedAt))
    .limit(limit);
  return rows.map(toCardView);
}
