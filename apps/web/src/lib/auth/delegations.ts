/**
 * GC-Scouting - delegations
 *
 * Delegations: invites, acceptance and limits.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

import { and, asc, count, eq, gt, isNull } from "drizzle-orm";
import { db } from "@scouting/db/client";
import { delegationInvites, profileDelegations, users, DAY_MS } from "@scouting/db";
import { randomToken, sha256Hex } from "./crypto";

// Profile delegation: an owner gives other accounts access to their Scouting profile through single use invite links.

export const DELEGATION_INVITE_TTL_DAYS = 7;
export const DELEGATES_MAX = 5;
export const PENDING_INVITES_MAX = 5;

// randomToken(32) in base64url.
const TOKEN_FORMAT = /^[A-Za-z0-9_-]{43}$/;

export type InviteError = "invalid" | "used" | "expired" | "self" | "already" | "full";

export type DelegationPerson = { id: number; userId: string; username: string; avatarUrl: string | null; since: string };

export type DelegationOverview = {
  /** Accounts that manage this profile. */
  delegates: DelegationPerson[];
  /** Profiles this account manages. */
  managed: DelegationPerson[];
  invites: { id: number; createdAt: string; expiresAt: string }[];
};

export async function delegationOverview(userId: string): Promise<DelegationOverview> {
  const person = { id: profileDelegations.id, userId: users.id, username: users.username, avatarUrl: users.avatarUrl, since: profileDelegations.createdAt };
  const [delegates, managed, invites] = await Promise.all([
    db.select(person).from(profileDelegations).innerJoin(users, eq(users.id, profileDelegations.delegateId)).where(eq(profileDelegations.ownerId, userId)).orderBy(asc(profileDelegations.createdAt)),
    db.select(person).from(profileDelegations).innerJoin(users, eq(users.id, profileDelegations.ownerId)).where(eq(profileDelegations.delegateId, userId)).orderBy(asc(users.username)),
    db
      .select({ id: delegationInvites.id, createdAt: delegationInvites.createdAt, expiresAt: delegationInvites.expiresAt })
      .from(delegationInvites)
      .where(and(eq(delegationInvites.ownerId, userId), isNull(delegationInvites.usedAt), gt(delegationInvites.expiresAt, new Date())))
      .orderBy(asc(delegationInvites.createdAt)),
  ]);
  const toPerson = (p: (typeof delegates)[number]) => ({ ...p, since: p.since.toISOString() });
  return {
    delegates: delegates.map(toPerson),
    managed: managed.map(toPerson),
    invites: invites.map((i) => ({ id: i.id, createdAt: i.createdAt.toISOString(), expiresAt: i.expiresAt.toISOString() })),
  };
}

/** New invite link token, refused once the owner has reached the delegate or pending invite limit. */
export async function createInvite(ownerId: string): Promise<{ ok: true; token: string; expiresAt: Date } | { ok: false; error: "full" | "tooManyInvites" }> {
  const [[delegates], [pending]] = await Promise.all([
    db.select({ n: count() }).from(profileDelegations).where(eq(profileDelegations.ownerId, ownerId)),
    db
      .select({ n: count() })
      .from(delegationInvites)
      .where(and(eq(delegationInvites.ownerId, ownerId), isNull(delegationInvites.usedAt), gt(delegationInvites.expiresAt, new Date()))),
  ]);
  if ((delegates?.n ?? 0) >= DELEGATES_MAX) return { ok: false, error: "full" };
  if ((pending?.n ?? 0) >= PENDING_INVITES_MAX) return { ok: false, error: "tooManyInvites" };

  const token = randomToken();
  const expiresAt = new Date(Date.now() + DELEGATION_INVITE_TTL_DAYS * DAY_MS);
  await db.insert(delegationInvites).values({ ownerId, tokenHash: await sha256Hex(token), expiresAt });
  return { ok: true, token, expiresAt };
}

type InviteRow = { id: number; ownerId: string; usedAt: Date | null; expiresAt: Date };

function inviteError(invite: InviteRow | undefined, delegateId: string | null): InviteError | null {
  if (!invite) return "invalid";
  if (invite.usedAt) return "used";
  if (invite.expiresAt <= new Date()) return "expired";
  if (delegateId === invite.ownerId) return "self";
  return null;
}

/** Owner of an invite, for the accept page. Nothing is consumed. */
export async function readInvite(
  token: string,
  delegateId: string | null,
): Promise<{ ok: true; owner: { username: string; avatarUrl: string | null } } | { ok: false; error: InviteError }> {
  if (!TOKEN_FORMAT.test(token)) return { ok: false, error: "invalid" };
  const [invite] = await db
    .select({ id: delegationInvites.id, ownerId: delegationInvites.ownerId, usedAt: delegationInvites.usedAt, expiresAt: delegationInvites.expiresAt, username: users.username, avatarUrl: users.avatarUrl })
    .from(delegationInvites)
    .innerJoin(users, eq(users.id, delegationInvites.ownerId))
    .where(eq(delegationInvites.tokenHash, await sha256Hex(token)))
    .limit(1);
  const error = inviteError(invite, delegateId);
  if (error) return { ok: false, error };
  return { ok: true, owner: { username: invite!.username, avatarUrl: invite!.avatarUrl } };
}

/** Consumes an invite and gives `delegateId` access to the owner's profile. Returns the owner id. */
export async function acceptInvite(token: string, delegateId: string): Promise<{ ok: true; ownerId: string } | { ok: false; error: InviteError }> {
  if (!TOKEN_FORMAT.test(token)) return { ok: false, error: "invalid" };
  const tokenHash = await sha256Hex(token);

  return db.transaction(async (tx) => {
    const [invite] = await tx
      .select({ id: delegationInvites.id, ownerId: delegationInvites.ownerId, usedAt: delegationInvites.usedAt, expiresAt: delegationInvites.expiresAt })
      .from(delegationInvites)
      .where(eq(delegationInvites.tokenHash, tokenHash))
      .for("update")
      .limit(1);
    const error = inviteError(invite, delegateId);
    if (error) return { ok: false, error };
    const ownerId = invite!.ownerId;

    const delegations = await tx.select({ delegateId: profileDelegations.delegateId }).from(profileDelegations).where(eq(profileDelegations.ownerId, ownerId));
    // Left unused so it still works for someone else.
    if (delegations.some((d) => d.delegateId === delegateId)) return { ok: false, error: "already" };
    if (delegations.length >= DELEGATES_MAX) return { ok: false, error: "full" };

    await tx.insert(profileDelegations).values({ ownerId, delegateId });
    await tx.update(delegationInvites).set({ usedAt: new Date() }).where(eq(delegationInvites.id, invite!.id));
    return { ok: true, ownerId };
  });
}
