/**
 * GC-Scouting - account
 *
 * Creates or updates the account after a GC Stats login.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

import { and, eq, inArray, ne } from "drizzle-orm";
import { db } from "@scouting/db/client";
import { oauthTokens, playerLinks, posts, users } from "@scouting/db";
import { decryptSecret, encryptSecret } from "./crypto";
import { dropIfGcsAccountGone } from "./account-data";
import { gcsOAuthConfig, GcsOAuthError, refreshTokens, type GcsTokens, type GcsUserinfo } from "./gcs-oauth";

export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Creates or refreshes the local account from GC Stats claims, stores the tokens. `linked`: a profile link was just approved. */
export async function syncAccount(info: GcsUserinfo, tokens: GcsTokens, locale: string): Promise<{ userId: string; linked: boolean }> {
  const discordId = info.linkedAccounts?.find((a) => a.provider === "discord")?.providerAccountId ?? null;
  const email = info.email && info.emailVerified ? info.email : null;
  const username = (info.username?.trim() || info.player?.handle?.trim() || "GC Stats").slice(0, 32);
  const accessTokenEnc = await encryptSecret(tokens.accessToken);
  const refreshTokenEnc = tokens.refreshToken ? await encryptSecret(tokens.refreshToken) : null;

  const gcsCreatedAt = info.createdAt ? new Date(info.createdAt) : null;
  // Claims missing (scope not granted yet) keep what is stored.
  const sanctions = info.activeSanctions ? { gcsSanctions: info.activeSanctions, sanctionsCheckedAt: new Date() } : {};
  const bootstrapAdmin = adminGcsUserIds().includes(info.sub);

  return db.transaction(async (tx) => {
    // A Discord account moved to another GC Stats account is released first (unique column).
    const noDiscord = { discordId: null, notifyDiscord: false, chatNotifyDiscord: false };
    if (discordId) await tx.update(users).set(noDiscord).where(and(eq(users.discordId, discordId), ne(users.gcsUserId, info.sub)));

    const profile = { username, avatarUrl: info.image ?? null, email, ...(discordId ? { discordId } : noDiscord), lastLoginAt: new Date(), ...(gcsCreatedAt && { gcsCreatedAt }), ...sanctions };
    const [user] = await tx
      .insert(users)
      .values({ gcsUserId: info.sub, locale, ...profile, ...(bootstrapAdmin && { role: "admin" as const }) })
      .onConflictDoUpdate({ target: users.gcsUserId, set: { ...profile, ...(bootstrapAdmin && { role: "admin" as const }) } })
      .returning({ id: users.id });
    const userId = user!.id;

    await tx
      .insert(oauthTokens)
      .values({ userId, accessTokenEnc, refreshTokenEnc, expiresAt: tokens.expiresAt, scopes: tokens.scopes })
      .onConflictDoUpdate({
        target: oauthTokens.userId,
        set: { accessTokenEnc, refreshTokenEnc, expiresAt: tokens.expiresAt, scopes: tokens.scopes },
      });

    const linked = await syncPlayerLink(tx, userId, info);
    return { userId, linked };
  });
}

/** GC Stats accounts that are always admin (`ADMIN_GCS_USER_IDS`, comma separated), to give the first roles. */
export function adminGcsUserIds(): string[] {
  return (process.env.ADMIN_GCS_USER_IDS ?? "").split(",").map((id) => id.trim()).filter(Boolean);
}

/** Change request item statuses that end a link request without linking. */
const REQUEST_REFUSED = new Set(["rejected", "failed", "withdrawn"]);

/** The author's posts lose what came from the profile: its history, and the team page it vouched for. */
async function dropProfileData(tx: Tx, userId: string) {
  await tx.update(posts).set({ gcsTeamId: null, gcsSummary: null, gcsSummarySyncedAt: null }).where(eq(posts.authorId, userId));
}

/** GC Stats is the source of truth: `player` shows an approved link, `playerLinkRequest` a refused one. True when a link was just approved. */
export async function syncPlayerLink(tx: Tx, userId: string, info: Pick<GcsUserinfo, "player" | "playerLinkRequest">): Promise<boolean> {
  const gcsPersonId = info.player?.id ?? null;
  let [active] = await tx
    .select({ id: playerLinks.id, gcsPersonId: playerLinks.gcsPersonId, gcsChangeRequestId: playerLinks.gcsChangeRequestId, status: playerLinks.status })
    .from(playerLinks)
    .where(and(eq(playerLinks.userId, userId), inArray(playerLinks.status, ["pending", "approved"])))
    .limit(1);

  const request = info.playerLinkRequest;
  const refused =
    active?.status === "pending" &&
    request &&
    REQUEST_REFUSED.has(request.status) &&
    request.personId === active.gcsPersonId &&
    (active.gcsChangeRequestId === null || active.gcsChangeRequestId === request.changeRequestId);
  if (refused) {
    await tx.update(playerLinks).set({ status: "rejected", resolvedAt: new Date() }).where(eq(playerLinks.id, active!.id));
    await dropProfileData(tx, userId);
    active = undefined;
  }

  if (gcsPersonId === null) {
    // Unlinked on GC Stats.
    if (active?.status === "approved") {
      await tx.update(playerLinks).set({ status: "withdrawn", resolvedAt: new Date() }).where(eq(playerLinks.id, active.id));
      await dropProfileData(tx, userId);
    }
    return false;
  }

  if (active?.gcsPersonId === gcsPersonId) {
    if (active.status !== "pending") return false;
    await tx.update(playerLinks).set({ status: "approved", resolvedAt: new Date() }).where(eq(playerLinks.id, active.id));
    return true;
  }
  // A pending request for another profile may still replace the current link on GC Stats.
  if (active?.status === "pending") return false;
  if (active) await tx.update(playerLinks).set({ status: "withdrawn", resolvedAt: new Date() }).where(eq(playerLinks.id, active.id));

  await tx.insert(playerLinks).values({ userId, gcsPersonId, status: "approved", resolvedAt: new Date() });
  return true;
}

const DEAD_REFRESH = Symbol("dead_refresh");

/** Valid GC Stats access token of a user, refreshed when expired. Null when the user must log in again. */
export async function getGcsAccessToken(userId: string): Promise<string | null> {
  const config = gcsOAuthConfig();
  if (!config) return null;

  const [current] = await db.select().from(oauthTokens).where(eq(oauthTokens.userId, userId)).limit(1);
  if (!current) return null;
  if (current.expiresAt.getTime() > Date.now()) return decryptSecret(current.accessTokenEnc);

  // Row lock: GC Stats rotates refresh tokens and revokes everything on reuse, two parallel refreshes would log the user out.
  const result = await db.transaction(async (tx) => {
    const [row] = await tx.select().from(oauthTokens).where(eq(oauthTokens.userId, userId)).for("update").limit(1);
    if (!row) return null;
    if (row.expiresAt.getTime() > Date.now()) return decryptSecret(row.accessTokenEnc);
    if (!row.refreshTokenEnc) return null;

    try {
      const tokens = await refreshTokens(config, await decryptSecret(row.refreshTokenEnc));
      await tx
        .update(oauthTokens)
        .set({
          accessTokenEnc: await encryptSecret(tokens.accessToken),
          refreshTokenEnc: tokens.refreshToken ? await encryptSecret(tokens.refreshToken) : row.refreshTokenEnc,
          expiresAt: tokens.expiresAt,
          scopes: tokens.scopes,
        })
        .where(eq(oauthTokens.userId, userId));
      return tokens.accessToken;
    } catch (error) {
      if (error instanceof GcsOAuthError && error.code === "invalid_grant") return DEAD_REFRESH;
      throw error;
    }
  });
  if (result !== DEAD_REFRESH) return result;

  // Revoked or reused refresh token, or a deleted GC Stats account. Outside the transaction: the account delete cascades to the locked row.
  // When GC Stats cannot answer, the tokens are kept so the next call asks again.
  if ((await dropIfGcsAccountGone(userId)) === "exists") await db.delete(oauthTokens).where(eq(oauthTokens.userId, userId));
  return null;
}
