/**
 * GC-Scouting - account
 *
 * Server actions for the account: profile switching and account level changes.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

"use server";

import { cookies } from "next/headers";
import { and, eq, isNull, or } from "drizzle-orm";
import { db } from "@scouting/db/client";
import { delegationInvites, profileDelegations, users } from "@scouting/db";
import { expiredCookie, getCurrentUser, PROFILE_COOKIE, SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth/session";
import { acceptInvite, createInvite, type InviteError } from "@/lib/auth/delegations";
import { deleteAccount as deleteAccountData } from "@/lib/auth/account-data";
import { loggable } from "@scouting/db/log";

const PROFILE_COOKIE_MAX_AGE = 30 * 24 * 60 * 60;

const isId = (v: unknown): v is number => Number.isSafeInteger(v) && (v as number) > 0;

export type SwitchProfileResult = { ok: true } | { ok: false; error: "auth" | "invalid" | "notFound" };

/** Acts as a managed profile, or as the account itself with `null`. */
export async function switchProfile(rawOwnerId: unknown): Promise<SwitchProfileResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "auth" };
  const store = await cookies();

  if (rawOwnerId === null || rawOwnerId === user.id) {
    store.delete(PROFILE_COOKIE);
    return { ok: true };
  }
  if (typeof rawOwnerId !== "string" || rawOwnerId.length > 64) return { ok: false, error: "invalid" };

  const [delegation] = await db
    .select({ id: profileDelegations.id })
    .from(profileDelegations)
    .where(and(eq(profileDelegations.ownerId, rawOwnerId), eq(profileDelegations.delegateId, user.id)))
    .limit(1);
  if (!delegation) return { ok: false, error: "notFound" };

  store.set(PROFILE_COOKIE, rawOwnerId, sessionCookieOptions(PROFILE_COOKIE_MAX_AGE));
  return { ok: true };
}

export type CreateInviteResult = { ok: true; path: string; expiresAt: string } | { ok: false; error: "auth" | "full" | "tooManyInvites" | "server" };

/** Invite link to the logged in account's profile. Only the path is returned, the client adds its origin. */
export async function createDelegationInvite(locale: unknown): Promise<CreateInviteResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "auth" };
  try {
    const result = await createInvite(user.id);
    if (!result.ok) return result;
    const prefix = typeof locale === "string" && /^[a-z]{2}$/.test(locale) ? `/${locale}` : "";
    return { ok: true, path: `${prefix}/invite/${result.token}`, expiresAt: result.expiresAt.toISOString() };
  } catch (error) {
    console.error("createDelegationInvite failed", loggable(error));
    return { ok: false, error: "server" };
  }
}

export type DelegationActionResult = { ok: true } | { ok: false; error: "auth" | "invalid" | "notFound" | "server" };

export async function revokeDelegationInvite(rawId: unknown): Promise<DelegationActionResult> {
  if (!isId(rawId)) return { ok: false, error: "invalid" };
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "auth" };
  try {
    const [row] = await db
      .delete(delegationInvites)
      .where(and(eq(delegationInvites.id, rawId), eq(delegationInvites.ownerId, user.id), isNull(delegationInvites.usedAt)))
      .returning({ id: delegationInvites.id });
    return row ? { ok: true } : { ok: false, error: "notFound" };
  } catch (error) {
    console.error("revokeDelegationInvite failed", loggable(error));
    return { ok: false, error: "server" };
  }
}

/** Ends a delegation, from either side: the owner removes a delegate, or a delegate leaves. */
export async function removeDelegation(rawId: unknown): Promise<DelegationActionResult> {
  if (!isId(rawId)) return { ok: false, error: "invalid" };
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "auth" };
  try {
    const [row] = await db
      .delete(profileDelegations)
      .where(and(eq(profileDelegations.id, rawId), or(eq(profileDelegations.ownerId, user.id), eq(profileDelegations.delegateId, user.id))))
      .returning({ ownerId: profileDelegations.ownerId });
    if (!row) return { ok: false, error: "notFound" };
    const store = await cookies();
    if (store.get(PROFILE_COOKIE)?.value === row.ownerId) store.delete(PROFILE_COOKIE);
    return { ok: true };
  } catch (error) {
    console.error("removeDelegation failed", loggable(error));
    return { ok: false, error: "server" };
  }
}

export type AcceptInviteResult = { ok: true } | { ok: false; error: InviteError | "auth" | "server" };

/** Accepts an invite and switches to the new profile right away. */
export async function acceptDelegationInvite(rawToken: unknown): Promise<AcceptInviteResult> {
  if (typeof rawToken !== "string") return { ok: false, error: "invalid" };
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "auth" };
  try {
    const result = await acceptInvite(rawToken, user.id);
    if (!result.ok) return result;
    (await cookies()).set(PROFILE_COOKIE, result.ownerId, sessionCookieOptions(PROFILE_COOKIE_MAX_AGE));
    return { ok: true };
  } catch (error) {
    console.error("acceptDelegationInvite failed", loggable(error));
    return { ok: false, error: "server" };
  }
}

export type DeleteAccountResult = { ok: true } | { ok: false; error: "auth" | "confirmation" | "server" };

/** Deletes the Scouting account for good. The username must be typed again as a confirmation. */
export async function deleteAccount(rawConfirmation: unknown): Promise<DeleteAccountResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "auth" };
  const confirmation = typeof rawConfirmation === "string" ? rawConfirmation.trim() : "";
  if (confirmation.toLowerCase() !== user.username.trim().toLowerCase()) return { ok: false, error: "confirmation" };

  try {
    await deleteAccountData(user.id);
  } catch (error) {
    console.error("deleteAccount failed", loggable(error));
    return { ok: false, error: "server" };
  }
  const store = await cookies();
  store.set(expiredCookie(SESSION_COOKIE));
  store.set(expiredCookie(PROFILE_COOKIE));
  return { ok: true };
}

export type ChatNotificationsResult = { ok: true } | { ok: false; error: "auth" | "invalid" | "noEmail" | "noDiscord" | "server" };

/** Email and Discord alerts for new messages, a channel must exist on the GC Stats account to be turned on. */
export async function updateChatNotifications(raw: unknown): Promise<ChatNotificationsResult> {
  const input = (raw && typeof raw === "object" ? raw : {}) as { email?: unknown; discord?: unknown };
  if (typeof input.email !== "boolean" || typeof input.discord !== "boolean") return { ok: false, error: "invalid" };
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "auth" };

  try {
    const [account] = await db.select({ email: users.email, discordId: users.discordId }).from(users).where(eq(users.id, user.id)).limit(1);
    if (!account) return { ok: false, error: "auth" };
    if (input.email && !account.email) return { ok: false, error: "noEmail" };
    if (input.discord && !account.discordId) return { ok: false, error: "noDiscord" };
    await db.update(users).set({ chatNotifyEmail: input.email, chatNotifyDiscord: input.discord }).where(eq(users.id, user.id));
    return { ok: true };
  } catch (error) {
    console.error("updateChatNotifications failed", loggable(error));
    return { ok: false, error: "server" };
  }
}
