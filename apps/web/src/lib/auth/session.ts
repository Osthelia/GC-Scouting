/**
 * GC-Scouting - session
 *
 * Session cookies, creation, lookup and revocation.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

import { cache } from "react";
import { cookies } from "next/headers";
import { and, eq, gt, inArray, lt } from "drizzle-orm";
import { db } from "@scouting/db/client";
import { playerLinks, profileDelegations, sessions, users, type UserRole } from "@scouting/db";
import { randomToken, sha256Hex } from "./crypto";

// `__Host-` (Secure, Path=/, no Domain) stops a subdomain from setting it. Browsers require HTTPS for it, so production only.
export const SESSION_COOKIE = process.env.NODE_ENV === "production" ? "__Host-sc_session" : "sc_session";
/** Id of the managed profile the account acts as, absent when acting as itself. */
export const PROFILE_COOKIE = "sc_profile";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export type SessionUser = {
  id: string;
  username: string;
  avatarUrl: string | null;
  role: UserRole;
  profile: { gcsPersonId: number; status: "verified" | "pending" } | null;
};

/** Profile posts are written for: the account itself, or a profile it manages (`actorId` and `actorName` are then the logged in account). */
export type ActiveProfile = SessionUser & { actorId: string; actorName: string; delegated: boolean };

export function sessionCookieOptions(maxAgeSeconds: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: maxAgeSeconds,
  };
}

/** Expires a cookie with the same attributes it was set with (`__Host-` refuses a plain delete). */
export function expiredCookie(name: string) {
  return { name, value: "", ...sessionCookieOptions(0) };
}

/** Creates a session row and returns the raw cookie value (only its hash is stored). */
export async function createSession(userId: string, userAgent: string | null): Promise<{ token: string; maxAge: number }> {
  const token = randomToken();
  await db.insert(sessions).values({
    id: await sha256Hex(token),
    userId,
    userAgent: userAgent?.slice(0, 512) ?? null,
    expiresAt: new Date(Date.now() + SESSION_TTL_MS),
  });
  return { token, maxAge: SESSION_TTL_MS / 1000 };
}

export async function deleteSession(token: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.id, await sha256Hex(token)));
}

/** Removes expired sessions, they are already ignored on read. */
export async function purgeExpiredSessions(): Promise<{ deleted: number }> {
  const rows = await db.delete(sessions).where(lt(sessions.expiresAt, new Date())).returning({ id: sessions.id });
  return { deleted: rows.length };
}

async function withPlayerLink(row: Omit<SessionUser, "profile">): Promise<SessionUser> {
  const [link] = await db
    .select({ gcsPersonId: playerLinks.gcsPersonId, status: playerLinks.status })
    .from(playerLinks)
    .where(and(eq(playerLinks.userId, row.id), inArray(playerLinks.status, ["pending", "approved"])))
    .limit(1);

  return {
    ...row,
    profile: link ? { gcsPersonId: link.gcsPersonId, status: link.status === "approved" ? "verified" : "pending" } : null,
  };
}

/** Logged in account from the session cookie, once per request. */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const [row] = await db
    .select({ id: users.id, username: users.username, avatarUrl: users.avatarUrl, role: users.role })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.id, await sha256Hex(token)), gt(sessions.expiresAt, new Date())))
    .limit(1);
  return row ? withPlayerLink(row) : null;
});

/** Profiles the account manages, with their owner's identity. */
export async function managedProfiles(delegateId: string): Promise<{ id: string; username: string; avatarUrl: string | null }[]> {
  return db
    .select({ id: users.id, username: users.username, avatarUrl: users.avatarUrl })
    .from(profileDelegations)
    .innerJoin(users, eq(users.id, profileDelegations.ownerId))
    .where(eq(profileDelegations.delegateId, delegateId))
    .orderBy(users.username);
}

/** Selected profile, checked against the delegations on every request (a revoked access falls back to the account). */
export const getActiveProfile = cache(async (): Promise<ActiveProfile | null> => {
  const user = await getCurrentUser();
  if (!user) return null;
  const self = { ...user, actorId: user.id, actorName: user.username, delegated: false };

  const selected = (await cookies()).get(PROFILE_COOKIE)?.value;
  if (!selected || selected === user.id) return self;

  const [owner] = await db
    .select({ id: users.id, username: users.username, avatarUrl: users.avatarUrl, role: users.role })
    .from(profileDelegations)
    .innerJoin(users, eq(users.id, profileDelegations.ownerId))
    .where(and(eq(profileDelegations.ownerId, selected), eq(profileDelegations.delegateId, user.id)))
    .limit(1);
  if (!owner) return self;
  return { ...(await withPlayerLink(owner)), actorId: user.id, actorName: user.username, delegated: true };
});

/** Staff and admins moderate the site. Read on the logged in account, never on a managed profile. */
export function isStaff(user: Pick<SessionUser, "role"> | null): boolean {
  return user?.role === "staff" || user?.role === "admin";
}
