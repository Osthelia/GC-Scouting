/**
 * GC-Scouting - posts
 *
 * Server actions to create, edit, renew and delete posts, with validation and limits.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

"use server";

import { after } from "next/server";
import { and, count, eq, gt, inArray, isNull, ne, sql } from "drizzle-orm";
import { db } from "@scouting/db/client";
import { isUniqueViolation, moderationActions, parseId, playerLinks, postEdits, posts, users, DAY_MS, POST_LIFETIME_DAYS, SINGLE_ACTIVE_POST_TYPES } from "@scouting/db";
import { deriveAvailability, experienceLevels, strongAgents } from "@scouting/db/derived";
import { getActiveProfile, type SessionUser } from "@/lib/auth/session";
import { validatePostForm, type PostFieldError, type PostFieldErrors, type ValidPost } from "@/lib/post-form";
import type { Tx } from "@/lib/auth/account";
import { gcsCurrentTeamIds, syncPostGcsSummary } from "@/lib/gcs-summary";
import { gcsApiConfigured } from "@/lib/gcs-api";
import { notifyBotPost } from "@/lib/notify/bot";
import { sanctionBlocking } from "@/lib/auth/sanctions";
import { getStaffUser } from "@/lib/admin/access";
import { REMOVAL_REASON_MAX, REMOVAL_REASON_MIN } from "@/lib/admin/constants";
import { notifyPostEditedByStaff } from "@/lib/notify/post-moderated";
import { loggable } from "@scouting/db/log";
import { lockRateLimit } from "@/lib/rate-limit";
import { activePostsFull } from "@/lib/post-limits";
import { cleanText } from "@scouting/db/text-input";

export type PostFormError = "auth" | "activeExists" | "expiredExists" | "limitReached" | "notFound" | "notEditable" | "sanctioned" | "rateLimited" | "server";

/** Each post is sent to every partner Discord server, these limits keep one account from flooding them. */
const POSTS_PER_HOUR = 5;
const POSTS_PER_DAY = 15;
const EDITS_PER_HOUR = 25;

export type SavePostResult =
  | { ok: true; href: string }
  | { ok: false; fieldErrors: PostFieldErrors; formError?: PostFormError; existingId?: number; sanctionEndsAt?: string | null; reasonError?: "length" | "invalidCharacters" };

/** Columns written from the form, on creation and edit. */
function postColumns(post: ValidPost, now: Date) {
  return {
    displayName: post.displayName,
    gcsTeamId: post.gcsTeamId,
    region: post.region,
    country: post.country,
    languages: post.languages,
    rosterSpot: post.rosterSpot,
    playersWanted: post.playersWanted,
    subsWanted: post.subsWanted,
    roles: post.roles,
    igl: post.igl,
    staffRoles: post.staffRoles,
    compensation: post.compensation,
    lan: post.lan,
    ageGroup: post.ageGroup,
    minorsAccepted: post.minorsAccepted,
    rankCurrent: post.rankCurrent,
    rankPeak: post.rankPeak,
    rankMin: post.rankMin,
    rankMax: post.rankMax,
    trackerRiotId: post.trackerRiotId,
    experience: post.experience,
    tournamentLevels: experienceLevels(post.experience),
    tierList: Object.keys(post.tierList).length ? post.tierList : null,
    strongAgents: strongAgents(post.tierList),
    timezone: post.timezone,
    availability: post.availability,
    ...deriveAvailability(post.availability, post.timezone, now),
    weeklyMinutes: post.weeklyMinutes,
    activeDays: post.activeDays,
    description: post.description,
    contact: post.contact,
    chatEnabled: post.chatEnabled,
  };
}

function saveNotifyPrefs(tx: Tx, userId: string, post: ValidPost) {
  return tx
    .update(users)
    .set({ notifyEmail: post.notifyEmail, notifyDiscord: post.notifyDiscord, notifyPromptedAt: sql`coalesce(${users.notifyPromptedAt}, now())` })
    .where(eq(users.id, userId));
}

/** Reminder channels must exist on the account, a new team page needs a member of its roster. Null when the account is gone. */
async function checkAccount(user: SessionUser, post: ValidPost, previousTeamId: number | null): Promise<PostFieldErrors | null> {
  const [account] = await db.select({ email: users.email, discordId: users.discordId }).from(users).where(eq(users.id, user.id)).limit(1);
  if (!account) return null;
  const fieldErrors: PostFieldErrors = {};
  if (post.notifyEmail && !account.email) fieldErrors.notifyEmail = "invalid";
  if (post.notifyDiscord && !account.discordId) fieldErrors.notifyDiscord = "invalid";
  if (post.gcsTeamId !== null && post.gcsTeamId !== previousTeamId) {
    const teamError = await checkGcsTeam(user, post.gcsTeamId);
    if (teamError) fieldErrors.gcsTeamUrl = teamError;
  }
  return fieldErrors;
}

/** A team page can only be linked by a current member: the author's linked profile (pending or approved) must be on its roster. */
async function checkGcsTeam(user: Pick<SessionUser, "profile">, teamId: number): Promise<PostFieldError | null> {
  if (!user.profile) return "gcsTeamNoProfile";
  if (!gcsApiConfigured()) return "gcsTeamCheckFailed";
  try {
    return (await gcsCurrentTeamIds(user.profile.gcsPersonId)).includes(teamId) ? null : "gcsTeamNotMember";
  } catch (error) {
    console.error("GC Stats team check failed", teamId, loggable(error));
    return "gcsTeamCheckFailed";
  }
}

/** Publishes a post. `replaceExpired` closes the author's expired post of the same type first (one active LFT/LFST per account). */
export async function createPost(raw: unknown, options: { replaceExpired?: boolean } = {}): Promise<SavePostResult> {
  const user = await getActiveProfile();
  if (!user) return { ok: false, fieldErrors: {}, formError: "auth" };

  const result = validatePostForm(raw);
  if (!result.ok) return { ok: false, fieldErrors: result.fieldErrors };
  const post = result.post;

  const sanction = await sanctionBlocking([user.actorId, user.id]);
  if (sanction) return { ok: false, fieldErrors: {}, formError: "sanctioned", sanctionEndsAt: sanction.endsAt };

  const fieldErrors = await checkAccount(user, post, null);
  if (!fieldErrors) return { ok: false, fieldErrors: {}, formError: "auth" };
  if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors };

  let replaceId: number | null = null;
  if ((SINGLE_ACTIVE_POST_TYPES as readonly string[]).includes(post.type)) {
    const [existing] = await db
      .select({ id: posts.id, expiresAt: posts.expiresAt })
      .from(posts)
      .where(and(eq(posts.authorId, user.id), eq(posts.type, post.type), eq(posts.status, "active"), isNull(posts.deletedAt)))
      .limit(1);
    if (existing) {
      if (existing.expiresAt > new Date()) return { ok: false, fieldErrors: {}, formError: "activeExists", existingId: existing.id };
      if (!options.replaceExpired) return { ok: false, fieldErrors: {}, formError: "expiredExists", existingId: existing.id };
      replaceId = existing.id;
    }
  }

  const now = new Date();
  try {
    const id = await db.transaction(async (tx) => {
      await lockRateLimit(tx, "posts", user.id);
      const [recent] = await tx
        .select({
          hour: count(sql`case when ${posts.publishedAt} > ${new Date(now.getTime() - 60 * 60 * 1000)} then 1 end`),
          day: count(),
        })
        .from(posts)
        .where(and(eq(posts.authorId, user.id), gt(posts.publishedAt, new Date(now.getTime() - DAY_MS))));
      if ((recent?.hour ?? 0) >= POSTS_PER_HOUR || (recent?.day ?? 0) >= POSTS_PER_DAY) return "rateLimited" as const;
      if (await activePostsFull(tx, user.id, post.type)) return "limitReached" as const;

      if (replaceId !== null) {
        await tx.update(posts).set({ status: "closed", closedAt: now }).where(and(eq(posts.id, replaceId), eq(posts.authorId, user.id)));
      }
      const [row] = await tx
        .insert(posts)
        .values({
          authorId: user.id,
          type: post.type,
          ...postColumns(post, now),
          tweetBy: post.tweetBy,
          publishedAt: now,
          bumpedAt: now,
          expiresAt: new Date(now.getTime() + POST_LIFETIME_DAYS * DAY_MS),
        })
        .returning({ id: posts.id });

      await saveNotifyPrefs(tx, user.id, post);
      return row!.id;
    });
    if (typeof id === "string") return { ok: false, fieldErrors: {}, formError: id };
    // GC Stats history is fetched after the response, the post is published without waiting.
    after(() => syncPostGcsSummary(id));
    after(() => notifyBotPost(id));
    if (replaceId !== null) after(() => notifyBotPost(replaceId));
    return { ok: true, href: `/posts/${post.type}/${id}` };
  } catch (error) {
    // Two submits at once: the partial unique index keeps a single active post.
    if (isUniqueViolation(error)) return { ok: false, fieldErrors: {}, formError: "activeExists" };
    console.error("createPost failed", loggable(error));
    return { ok: false, fieldErrors: {}, formError: "server" };
  }
}

/** Edits an active post of its author. The type and the dates stay, expiry included. */
export async function updatePost(rawPostId: unknown, raw: unknown): Promise<SavePostResult> {
  const postId = parseId(rawPostId);
  if (!postId) return { ok: false, fieldErrors: {}, formError: "notFound" };

  const user = await getActiveProfile();
  if (!user) return { ok: false, fieldErrors: {}, formError: "auth" };

  const [current] = await db
    .select({ authorId: posts.authorId, type: posts.type, status: posts.status, gcsTeamId: posts.gcsTeamId, tweetBy: posts.tweetBy, tweetedAt: posts.tweetedAt })
    .from(posts)
    .where(and(eq(posts.id, postId), isNull(posts.deletedAt)))
    .limit(1);
  if (!current || current.authorId !== user.id || current.status === "removed") return { ok: false, fieldErrors: {}, formError: "notFound" };
  if (current.status !== "active") return { ok: false, fieldErrors: {}, formError: "notEditable" };

  const result = validatePostForm(raw);
  if (!result.ok) return { ok: false, fieldErrors: result.fieldErrors };
  const post = result.post;
  if (post.type !== current.type) return { ok: false, fieldErrors: {}, formError: "notEditable" };

  const sanction = await sanctionBlocking([user.actorId, user.id]);
  if (sanction) return { ok: false, fieldErrors: {}, formError: "sanctioned", sanctionEndsAt: sanction.endsAt };

  const fieldErrors = await checkAccount(user, post, current.gcsTeamId);
  if (!fieldErrors) return { ok: false, fieldErrors: {}, formError: "auth" };
  if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors };

  // Another team page means another history: the old one is dropped until the new one is fetched.
  const teamChanged = post.gcsTeamId !== current.gcsTeamId;
  // Once tweeted, who tweets no longer changes.
  const tweetChanged = current.tweetedAt === null && post.tweetBy !== current.tweetBy;
  try {
    const saved = await db.transaction(async (tx) => {
      await lockRateLimit(tx, "post-edits", postId);
      const [recent] = await tx
        .select({ total: count() })
        .from(postEdits)
        .where(and(eq(postEdits.postId, postId), gt(postEdits.createdAt, new Date(Date.now() - 60 * 60 * 1000))));
      if ((recent?.total ?? 0) >= EDITS_PER_HOUR) return "rateLimited" as const;

      // Closed, removed or deleted since it was read above.
      const [row] = await tx
        .update(posts)
        .set({
          ...postColumns(post, new Date()),
          ...(teamChanged && { gcsSummary: null, gcsSummarySyncedAt: null }),
          ...(tweetChanged && { tweetBy: post.tweetBy, authorTweetId: null }),
        })
        .where(and(eq(posts.id, postId), eq(posts.authorId, user.id), eq(posts.status, "active"), isNull(posts.deletedAt)))
        .returning({ id: posts.id });
      if (!row) return "notEditable" as const;
      await tx.insert(postEdits).values({ postId });
      await saveNotifyPrefs(tx, user.id, post);
      return null;
    });
    if (saved) return { ok: false, fieldErrors: {}, formError: saved };
  } catch (error) {
    console.error("updatePost failed", loggable(error));
    return { ok: false, fieldErrors: {}, formError: "server" };
  }
  if (teamChanged) after(() => syncPostGcsSummary(postId));
  after(() => notifyBotPost(postId));
  return { ok: true, href: `/posts/${post.type}/${postId}` };
}

/**
 * Staff edit of someone else's active post. The reason is logged and sent to the author.
 * Reminder settings belong to the author and are left as they are.
 */
export async function updatePostAsStaff(rawPostId: unknown, raw: unknown, rawReason: unknown): Promise<SavePostResult> {
  const postId = parseId(rawPostId);
  if (!postId) return { ok: false, fieldErrors: {}, formError: "notFound" };

  const staff = await getStaffUser();
  if (!staff) return { ok: false, fieldErrors: {}, formError: "auth" };

  const [current] = await db
    .select({ authorId: posts.authorId, type: posts.type, status: posts.status, gcsTeamId: posts.gcsTeamId, tweetBy: posts.tweetBy, tweetedAt: posts.tweetedAt })
    .from(posts)
    .where(and(eq(posts.id, postId), isNull(posts.deletedAt)))
    .limit(1);
  if (!current || current.status === "removed") return { ok: false, fieldErrors: {}, formError: "notFound" };
  if (current.status !== "active") return { ok: false, fieldErrors: {}, formError: "notEditable" };

  const { text: reason, invalid: reasonInvalid } = cleanText(rawReason, { multiline: true });
  const reasonError = reasonInvalid
    ? ("invalidCharacters" as const)
    : reason.length < REMOVAL_REASON_MIN || reason.length > REMOVAL_REASON_MAX
      ? ("length" as const)
      : undefined;
  const result = validatePostForm(raw);
  if (!result.ok || reasonError) return { ok: false, fieldErrors: result.ok ? {} : result.fieldErrors, reasonError };
  const post = result.post;
  if (post.type !== current.type) return { ok: false, fieldErrors: {}, formError: "notEditable" };

  // A new team page is checked against the author's profile, not the staff member's.
  const teamChanged = post.gcsTeamId !== current.gcsTeamId;
  if (teamChanged && post.gcsTeamId !== null) {
    const [link] = await db
      .select({ gcsPersonId: playerLinks.gcsPersonId })
      .from(playerLinks)
      .where(and(eq(playerLinks.userId, current.authorId), inArray(playerLinks.status, ["pending", "approved"])))
      .limit(1);
    const teamError = await checkGcsTeam({ profile: link ? { gcsPersonId: link.gcsPersonId, status: "pending" } : null }, post.gcsTeamId);
    if (teamError) return { ok: false, fieldErrors: { gcsTeamUrl: teamError } };
  }

  const tweetChanged = current.tweetedAt === null && post.tweetBy !== current.tweetBy;
  try {
    const updated = await db.transaction(async (tx) => {
      const [row] = await tx
        .update(posts)
        .set({
          ...postColumns(post, new Date()),
          ...(teamChanged && { gcsSummary: null, gcsSummarySyncedAt: null }),
          ...(tweetChanged && { tweetBy: post.tweetBy, authorTweetId: null }),
        })
        .where(and(eq(posts.id, postId), eq(posts.status, "active"), isNull(posts.deletedAt)))
        .returning({ id: posts.id });
      if (!row) return false;
      await tx.insert(moderationActions).values({ postId, action: "edit", actorUserId: staff.id, reason });
      return true;
    });
    if (!updated) return { ok: false, fieldErrors: {}, formError: "notEditable" };
  } catch (error) {
    console.error("updatePostAsStaff failed", loggable(error));
    return { ok: false, fieldErrors: {}, formError: "server" };
  }
  if (teamChanged) after(() => syncPostGcsSummary(postId));
  after(() => notifyBotPost(postId));
  after(() => notifyPostEditedByStaff(postId, reason));
  return { ok: true, href: `/posts/${post.type}/${postId}` };
}

export type ClosePostResult = { ok: true } | { ok: false; error: "invalid" | "auth" | "notFound" | "server" };

/** Takes a post offline for good, its link keeps working. */
export async function closePost(rawPostId: unknown): Promise<ClosePostResult> {
  const postId = parseId(rawPostId);
  if (!postId) return { ok: false, error: "invalid" };

  const user = await getActiveProfile();
  if (!user) return { ok: false, error: "auth" };

  try {
    const [row] = await db
      .update(posts)
      .set({ status: "closed", closedAt: new Date() })
      .where(and(eq(posts.id, postId), eq(posts.authorId, user.id), eq(posts.status, "active"), isNull(posts.deletedAt)))
      .returning({ id: posts.id });
    if (!row) return { ok: false, error: "notFound" };
    after(() => notifyBotPost(postId));
    return { ok: true };
  } catch (error) {
    console.error("closePost failed", loggable(error));
    return { ok: false, error: "server" };
  }
}

/** Keeps the shared GC Stats API key away from its rate limit. */
const GCS_REFRESH_COOLDOWN_MS = 5 * 60 * 1000;

export type RefreshGcsSummaryResult =
  | { ok: true }
  | { ok: false; error: "invalid" | "auth" | "notFound" | "forbidden" | "cooldown" | "noProfile" | "notConfigured" | "failed"; retryInSeconds?: number };

/** Refetches the GC Stats history of a post, for its author only. */
export async function refreshPostGcsSummary(rawPostId: unknown): Promise<RefreshGcsSummaryResult> {
  const postId = parseId(rawPostId);
  if (!postId) return { ok: false, error: "invalid" };

  const user = await getActiveProfile();
  if (!user) return { ok: false, error: "auth" };

  const [post] = await db
    .select({ authorId: posts.authorId, syncedAt: posts.gcsSummarySyncedAt })
    .from(posts)
    .where(and(eq(posts.id, postId), isNull(posts.deletedAt), ne(posts.status, "removed")))
    .limit(1);
  if (!post) return { ok: false, error: "notFound" };
  if (post.authorId !== user.id) return { ok: false, error: "forbidden" };

  const elapsed = post.syncedAt ? Date.now() - post.syncedAt.getTime() : Infinity;
  if (elapsed < GCS_REFRESH_COOLDOWN_MS) return { ok: false, error: "cooldown", retryInSeconds: Math.ceil((GCS_REFRESH_COOLDOWN_MS - elapsed) / 1000) };

  const result = await syncPostGcsSummary(postId);
  return result === "ok" ? { ok: true } : { ok: false, error: result };
}

/** Whether the GC Stats history of a post has been fetched, polled by the post page right after publication. */
export async function isGcsSummarySynced(rawPostId: unknown): Promise<boolean | null> {
  const postId = parseId(rawPostId);
  if (!postId) return null;
  const [post] = await db
    .select({ syncedAt: posts.gcsSummarySyncedAt })
    .from(posts)
    .where(and(eq(posts.id, postId), isNull(posts.deletedAt), ne(posts.status, "removed")))
    .limit(1);
  return post ? post.syncedAt !== null : null;
}
