/**
 * GC-Scouting - account-data
 *
 * Export and deletion of everything stored for an account.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

import { and, eq, inArray, isNotNull, or } from "drizzle-orm";
import { db } from "@scouting/db/client";
import {
  delegationInvites,
  discordChannels,
  discordDeliveries,
  discordMessagePurges,
  messageReports,
  messages,
  oauthTokens,
  playerLinks,
  posts,
  profileDelegations,
  reports,
  sessions,
  userBlocks,
  users,
} from "@scouting/db";
import { notifyBotPurge } from "@/lib/notify/bot";
import { decryptSecret } from "./crypto";
import { gcsAccountExists, gcsOAuthConfig, revokeToken } from "./gcs-oauth";
import { deleteShareImages } from "@/lib/share-image";
import { loggable } from "@scouting/db/log";

// Personal data of a Scouting account: export and deletion. The GC Stats account is never touched.

/** Everything stored about the account, secrets and hashes left out. Null when the account is gone. */
export async function exportAccountData(userId: string) {
  const [account] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!account) return null;

  const [gcsConnection, sessionRows, links, postRows, given, received, invites, filedReports, sentMessages, blocked, messageReportRows] = await Promise.all([
    db.select({ scopes: oauthTokens.scopes, expiresAt: oauthTokens.expiresAt, updatedAt: oauthTokens.updatedAt }).from(oauthTokens).where(eq(oauthTokens.userId, userId)),
    db.select({ userAgent: sessions.userAgent, createdAt: sessions.createdAt, expiresAt: sessions.expiresAt }).from(sessions).where(eq(sessions.userId, userId)),
    db
      .select({
        gcsPersonId: playerLinks.gcsPersonId,
        gcsChangeRequestId: playerLinks.gcsChangeRequestId,
        status: playerLinks.status,
        createdAt: playerLinks.createdAt,
        resolvedAt: playerLinks.resolvedAt,
      })
      .from(playerLinks)
      .where(eq(playerLinks.userId, userId)),
    db.select().from(posts).where(eq(posts.authorId, userId)),
    db
      .select({ username: users.username, since: profileDelegations.createdAt })
      .from(profileDelegations)
      .innerJoin(users, eq(users.id, profileDelegations.delegateId))
      .where(eq(profileDelegations.ownerId, userId)),
    db
      .select({ username: users.username, since: profileDelegations.createdAt })
      .from(profileDelegations)
      .innerJoin(users, eq(users.id, profileDelegations.ownerId))
      .where(eq(profileDelegations.delegateId, userId)),
    db
      .select({ createdAt: delegationInvites.createdAt, expiresAt: delegationInvites.expiresAt, usedAt: delegationInvites.usedAt })
      .from(delegationInvites)
      .where(eq(delegationInvites.ownerId, userId)),
    db
      .select({ postId: reports.postId, reason: reports.reason, message: reports.message, status: reports.status, createdAt: reports.createdAt })
      .from(reports)
      .where(eq(reports.reporterUserId, userId)),
    // Messages written as this profile or by this account for someone else.
    db
      .select({ conversationId: messages.conversationId, body: messages.body, status: messages.status, createdAt: messages.createdAt })
      .from(messages)
      .where(or(eq(messages.senderId, userId), eq(messages.sentById, userId))),
    db
      .select({ username: users.username, since: userBlocks.createdAt })
      .from(userBlocks)
      .innerJoin(users, eq(users.id, userBlocks.blockedId))
      .where(eq(userBlocks.blockerId, userId)),
    db
      .select({ messageId: messageReports.messageId, reason: messageReports.reason, message: messageReports.message, status: messageReports.status, createdAt: messageReports.createdAt })
      .from(messageReports)
      .where(eq(messageReports.reporterId, userId)),
  ]);

  return {
    exportedAt: new Date().toISOString(),
    account: {
      id: account.id,
      gcsUserId: account.gcsUserId,
      username: account.username,
      avatarUrl: account.avatarUrl,
      email: account.email,
      discordId: account.discordId,
      locale: account.locale,
      notifyEmail: account.notifyEmail,
      notifyDiscord: account.notifyDiscord,
      notifyPromptedAt: account.notifyPromptedAt,
      chatNotifyEmail: account.chatNotifyEmail,
      chatNotifyDiscord: account.chatNotifyDiscord,
      role: account.role,
      gcsCreatedAt: account.gcsCreatedAt,
      gcsSanctions: account.gcsSanctions,
      createdAt: account.createdAt,
      lastLoginAt: account.lastLoginAt,
    },
    gcsConnection: gcsConnection[0] ?? null,
    sessions: sessionRows,
    playerLinks: links,
    // availability_utc is derived from availability.
    posts: postRows.map(({ availabilityUtc: _, ...post }) => post),
    delegations: { managedBy: given, manages: received, invites },
    reports: filedReports,
    messages: sentMessages,
    blockedUsers: blocked,
    messageReports: messageReportRows,
  };
}

/** Deletes the account when its GC Stats account is gone. "unknown" when GC Stats cannot tell, nothing is deleted then. */
export async function dropIfGcsAccountGone(userId: string): Promise<"deleted" | "exists" | "unknown"> {
  const config = gcsOAuthConfig();
  const [user] = await db.select({ gcsUserId: users.gcsUserId }).from(users).where(eq(users.id, userId)).limit(1);
  if (!config || !user) return "unknown";

  const exists = await gcsAccountExists(config, user.gcsUserId);
  if (exists === null) return "unknown";
  if (exists) return "exists";

  await deleteAccount(userId);
  return "deleted";
}

/** Revokes the GC Stats tokens, then deletes the account and everything attached to it (posts included). */
export async function deleteAccount(userId: string): Promise<void> {
  const config = gcsOAuthConfig();
  const [tokens] = await db.select().from(oauthTokens).where(eq(oauthTokens.userId, userId)).limit(1);
  if (config && tokens) {
    try {
      await revokeToken(config, await decryptSecret(tokens.refreshTokenEnc ?? tokens.accessTokenEnc));
    } catch (error) {
      // The account is deleted anyway, the tokens die with their expiry.
      console.error("GC Stats token revocation failed", loggable(error));
    }
  }

  const postIds = await db.transaction(async (tx) => {
    const owned = (await tx.select({ id: posts.id }).from(posts).where(eq(posts.authorId, userId))).map((post) => post.id);
    // Discord messages naming the account (its posts, its reports and the reports on its posts) are handed to the bot,
    // their deliveries and reports go with the account.
    const delivered = owned.length
      ? await tx
          .select({ channelId: discordChannels.channelId, messageId: discordDeliveries.messageId })
          .from(discordDeliveries)
          .innerJoin(discordChannels, eq(discordChannels.id, discordDeliveries.channelConfigId))
          .where(inArray(discordDeliveries.postId, owned))
      : [];
    // Reports do not store their channel: tried in every moderation channel, the others answer "unknown message".
    const reportMessages = await tx
      .select({ channelId: discordChannels.channelId, messageId: reports.moderationMessageId })
      .from(reports)
      .innerJoin(discordChannels, eq(discordChannels.kind, "moderation"))
      .where(and(or(eq(reports.reporterUserId, userId), owned.length ? inArray(reports.postId, owned) : undefined), isNotNull(reports.moderationMessageId)));
    const purges = [...delivered, ...reportMessages.map((row) => ({ channelId: row.channelId, messageId: row.messageId! }))];
    if (purges.length) await tx.insert(discordMessagePurges).values(purges).onConflictDoNothing();
    // Reports filed from the site are deleted with their author, the Discord id included.
    await tx.delete(reports).where(eq(reports.reporterUserId, userId));
    await tx.delete(users).where(eq(users.id, userId));
    return owned;
  });
  await Promise.all([deleteShareImages(postIds), notifyBotPurge()]);
}
