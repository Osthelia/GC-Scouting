/**
 * GC-Scouting - delivery
 *
 * Delivers new posts to the configured feeds, with leases, retries and catch up.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

import { and, desc, eq, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { discordChannels, discordDeliveries, discordMessagePurges, discordSyncLeases, posts, reports, users } from "@scouting/db/schema";
import { matchesFilters } from "@scouting/db";
import type { BotContext } from "../core/context";
import { DiscordApiError, deleteMessage, editMessage, sendMessage } from "../core/discord";
import { configFilters, configLocale, disableChannel, enabledChannels, moderationConfig, type ChannelConfig } from "./channels";
import { moderationMessage, reportMessage, type Report } from "./moderation-message";
import { feedMessage } from "./post-message";
import { isVisible, loadPost, moderationRemoval, toMatchable, visiblePost, type BotPost, type Queryable } from "./posts";
import { loggable } from "@scouting/db/log";

/** A sync cut short (restart, crash) frees its post once this is past. */
const LEASE_MS = 90 * 1000;
/** Posts bumped earlier than this are left alone by the catch up. */
const CATCH_UP_WINDOW_MS = 6 * 60 * 60 * 1000;
const CATCH_UP_LIMIT = 100;
/** Discord calls in flight at once while delivering a post. */
const CONCURRENCY = 5;

async function inBatches<T>(items: T[], run: (item: T) => Promise<void>): Promise<void> {
  for (let i = 0; i < items.length; i += CONCURRENCY) await Promise.all(items.slice(i, i + CONCURRENCY).map(run));
}

/** Latest delivery of a post in each channel. */
type Delivery = { id: number; messageId: string; sentAt: Date };

async function latestDeliveries(db: Queryable, postId: number): Promise<Map<number, Delivery>> {
  const rows = await db
    .select({ id: discordDeliveries.id, channelConfigId: discordDeliveries.channelConfigId, messageId: discordDeliveries.messageId, sentAt: discordDeliveries.sentAt })
    .from(discordDeliveries)
    .where(eq(discordDeliveries.postId, postId))
    .orderBy(desc(discordDeliveries.sentAt));
  const latest = new Map<number, Delivery>();
  for (const row of rows) if (!latest.has(row.channelConfigId)) latest.set(row.channelConfigId, row);
  return latest;
}

function wants(channel: ChannelConfig, post: BotPost): boolean {
  if (channel.kind === "moderation") return true;
  const filters = configFilters(channel);
  if (!filters) {
    console.warn(`[bot] channel ${channel.channelId} has invalid filters, skipped`);
    return false;
  }
  return matchesFilters(toMatchable(post), filters);
}

/** Channel gone or bot kicked: the config is paused instead of failing on every post. */
async function onSendError(db: Queryable, channel: ChannelConfig, error: unknown): Promise<void> {
  if (error instanceof DiscordApiError && error.channelUnreachable) {
    console.warn(`[bot] channel ${channel.channelId} unreachable, disabled`, error.message);
    await disableChannel(db, channel.id);
    return;
  }
  console.error(`[bot] delivery to ${channel.channelId} failed`, loggable(error));
}

/** Edited post: its feed message is redrawn, or deleted when the channel filters no longer match. */
async function refreshFeedMessage(ctx: BotContext, db: Queryable, channel: ChannelConfig, post: BotPost, delivery: Delivery): Promise<void> {
  try {
    if (wants(channel, post)) {
      await editMessage(ctx.env, channel.channelId, delivery.messageId, feedMessage(post, configLocale(channel), ctx.env.APP_URL));
      return;
    }
    await deleteMessage(ctx.env, channel.channelId, delivery.messageId).catch((error) => {
      if (!(error instanceof DiscordApiError && (error.unknownMessage || error.channelUnreachable))) throw error;
    });
    // Without its delivery, the post is sent again if an edit makes it match.
    await db.delete(discordDeliveries).where(eq(discordDeliveries.id, delivery.id));
  } catch (error) {
    console.warn(`[bot] feed message ${delivery.messageId} of post ${post.id} not refreshed`, loggable(error));
  }
}

type Lease = { holder: string };

/**
 * Takes the post for this call, so the cron and the site never send it twice at once.
 * Busy: a refresh is left to the call holding it, which runs it once done (or the cron, if that call was cut off).
 */
async function acquireLease(ctx: BotContext, postId: number, refresh: boolean): Promise<Lease | null> {
  const holder = crypto.randomUUID();
  const until = new Date(Date.now() + LEASE_MS);
  for (;;) {
    const taken = await ctx.db
      .insert(discordSyncLeases)
      .values({ postId, holder, lockedUntil: until })
      .onConflictDoUpdate({
        target: discordSyncLeases.postId,
        set: { holder, lockedUntil: until, refreshPending: false },
        setWhere: sql`${discordSyncLeases.lockedUntil} < now()`,
      })
      .returning({ postId: discordSyncLeases.postId });
    if (taken.length) return { holder };
    if (!refresh) return null;
    const marked = await ctx.db
      .update(discordSyncLeases)
      .set({ refreshPending: true })
      .where(eq(discordSyncLeases.postId, postId))
      .returning({ postId: discordSyncLeases.postId });
    // Released in between: try to take it again.
    if (marked.length) return null;
  }
}

/** Frees the post. True when a refresh was asked meanwhile: the lease is kept and the caller runs it. */
async function releaseLease(ctx: BotContext, postId: number, lease: Lease): Promise<boolean> {
  const owned = and(eq(discordSyncLeases.postId, postId), eq(discordSyncLeases.holder, lease.holder));
  const released = await ctx.db
    .delete(discordSyncLeases)
    .where(and(owned, eq(discordSyncLeases.refreshPending, false)))
    .returning({ postId: discordSyncLeases.postId });
  if (released.length) return false;
  const kept = await ctx.db
    .update(discordSyncLeases)
    .set({ refreshPending: false, lockedUntil: new Date(Date.now() + LEASE_MS) })
    .where(owned)
    .returning({ postId: discordSyncLeases.postId });
  return kept.length > 0;
}

/**
 * Sends a post to every channel that wants it and has not received it since its last bump.
 * `refresh` also redraws the messages already sent (edit, close, deletion by the author)
 * and deletes the feed messages of a post taken offline.
 * No transaction around the Discord calls: each delivery is saved as soon as its message is sent.
 */
export async function syncPost(ctx: BotContext, postId: number, { refresh = false } = {}): Promise<void> {
  const lease = await acquireLease(ctx, postId, refresh);
  if (!lease) return;
  try {
    for (let again = true; again; ) {
      await runSync(ctx, postId, refresh);
      again = await releaseLease(ctx, postId, lease);
      refresh = true;
    }
  } catch (error) {
    // The lease expires on its own, the cron picks a pending refresh back up.
    console.error(`[bot] sync of post ${postId} failed`, loggable(error));
  }
}

async function runSync(ctx: BotContext, postId: number, refresh: boolean): Promise<void> {
  const post = await loadPost(ctx.db, postId);
  if (!post) return;
  const [channels, delivered] = await Promise.all([enabledChannels(ctx.db), latestDeliveries(ctx.db, postId)]);
  const removal = refresh ? await moderationRemoval(ctx.db, post) : null;

  await inBatches(channels, async (channel) => {
    const locale = configLocale(channel);
    const last = delivered.get(channel.id);
    const upToDate = last !== undefined && last.sentAt >= post.bumpedAt;

    if (upToDate) {
      if (refresh && channel.kind === "moderation") {
        await editMessage(ctx.env, channel.channelId, last.messageId, moderationMessage(post, removal, locale, ctx.env.APP_URL)).catch((error) =>
          console.warn(`[bot] moderation message of post ${post.id} not refreshed`, loggable(error)),
        );
      }
      // Offline posts leave the feeds below. An expired post is still redrawn.
      if (refresh && channel.kind === "feed" && post.status === "active" && post.deletedAt === null) {
        await refreshFeedMessage(ctx, ctx.db, channel, post, last);
      }
      return;
    }
    // Channels only receive what was bumped after they were set up.
    if (!isVisible(post) || post.bumpedAt <= channel.createdAt || !wants(channel, post)) return;

    const body = channel.kind === "moderation" ? moderationMessage(post, null, locale, ctx.env.APP_URL) : feedMessage(post, locale, ctx.env.APP_URL);
    let messageId: string;
    try {
      messageId = (await sendMessage(ctx.env, channel.channelId, body)).id;
    } catch (error) {
      await onSendError(ctx.db, channel, error);
      return;
    }
    try {
      await ctx.db.insert(discordDeliveries).values({ postId: post.id, channelConfigId: channel.id, messageId });
    } catch (error) {
      // Channel config or post deleted meanwhile: an untracked message would never be edited nor deleted.
      console.error(`[bot] delivery of post ${post.id} to ${channel.channelId} not saved, message deleted`, loggable(error));
      await deleteMessage(ctx.env, channel.channelId, messageId).catch(() => {});
    }
  });

  // Deleted, closed or removed. An expired post stays in the feeds.
  if (refresh && (post.status !== "active" || post.deletedAt !== null)) await removeFromFeeds(ctx, postId);
}

/** Recently bumped visible posts still missing from at least one channel. */
export async function catchUp(ctx: BotContext): Promise<void> {
  const since = new Date(Date.now() - CATCH_UP_WINDOW_MS);
  const pending = await ctx.db
    .select({ id: posts.id })
    .from(posts)
    .where(
      and(
        visiblePost(),
        sql`${posts.bumpedAt} > ${since}`,
        sql`exists (
          select 1 from ${discordChannels} c
          where c.enabled and c.created_at < ${posts.bumpedAt}
            and not exists (
              select 1 from ${discordDeliveries} d
              where d.post_id = ${posts.id} and d.channel_config_id = c.id and d.sent_at >= ${posts.bumpedAt}
            )
        )`,
      ),
    )
    .orderBy(posts.bumpedAt)
    .limit(CATCH_UP_LIMIT);

  for (const { id } of pending) await syncPost(ctx, id);

  // Syncs cut short by a restart: a refresh asked meanwhile is run now, a bare lease just expires.
  const stale = await ctx.db
    .delete(discordSyncLeases)
    .where(sql`${discordSyncLeases.lockedUntil} < now()`)
    .returning({ postId: discordSyncLeases.postId, refreshPending: discordSyncLeases.refreshPending });
  for (const { postId } of stale.filter((lease) => lease.refreshPending)) await syncPost(ctx, postId, { refresh: true });

  // Reports the site call missed. The last minute is left to that call.
  const unsent = await ctx.db
    .select({ id: reports.id })
    .from(reports)
    .where(
      and(
        eq(reports.status, "open"),
        isNull(reports.moderationMessageId),
        sql`${reports.createdAt} > ${since}`,
        sql`${reports.createdAt} < now() - interval '1 minute'`,
      ),
    )
    .orderBy(reports.createdAt)
    .limit(CATCH_UP_LIMIT);

  for (const { id } of unsent) await sendReport(ctx, id);
  await purgeMessages(ctx);
}

/** Deletes the messages of deleted accounts. A failed delete stays queued for the next cron. */
export async function purgeMessages(ctx: BotContext): Promise<void> {
  const rows = await ctx.db.select().from(discordMessagePurges).orderBy(discordMessagePurges.createdAt).limit(CATCH_UP_LIMIT);
  const gone: number[] = [];
  await inBatches(rows, async (row) => {
    try {
      await deleteMessage(ctx.env, row.channelId, row.messageId);
      gone.push(row.id);
    } catch (error) {
      if (error instanceof DiscordApiError && (error.unknownMessage || error.channelUnreachable)) gone.push(row.id);
      else console.error(`[bot] message ${row.messageId} of a deleted account not deleted`, loggable(error));
    }
  });
  if (gone.length) await ctx.db.delete(discordMessagePurges).where(inArray(discordMessagePurges.id, gone));
}

/** Deletes a post from the feeds. Deliveries go too, so a restore sends it again. */
export async function removeFromFeeds(ctx: BotContext, postId: number): Promise<void> {
  const rows = await ctx.db
    .select({ id: discordDeliveries.id, messageId: discordDeliveries.messageId, channelId: discordChannels.channelId })
    .from(discordDeliveries)
    .innerJoin(discordChannels, eq(discordChannels.id, discordDeliveries.channelConfigId))
    .where(and(eq(discordDeliveries.postId, postId), eq(discordChannels.kind, "feed")));

  // A failed delete keeps its delivery, the next call tries again.
  const gone: number[] = [];
  await inBatches(rows, async (row) => {
    try {
      await deleteMessage(ctx.env, row.channelId, row.messageId);
      gone.push(row.id);
    } catch (error) {
      if (error instanceof DiscordApiError && (error.unknownMessage || error.channelUnreachable)) gone.push(row.id);
      else console.error(`[bot] feed message ${row.messageId} of post ${postId} not deleted`, loggable(error));
    }
  });
  if (gone.length) await ctx.db.delete(discordDeliveries).where(inArray(discordDeliveries.id, gone));
}

export async function loadReport(db: Queryable, reportId: number): Promise<Report | null> {
  const handler = alias(users, "handler");
  const [row] = await db
    .select({ report: reports, reporterName: users.username, handlerName: handler.username })
    .from(reports)
    .leftJoin(users, eq(users.id, reports.reporterUserId))
    .leftJoin(handler, eq(handler.id, reports.handledByUserId))
    .where(eq(reports.id, reportId))
    .limit(1);
  return row ? { ...row.report, reporterName: row.reporterName, handlerName: row.handlerName } : null;
}

/** Posts a new report in the moderation channel, once. */
export async function sendReport(ctx: BotContext, reportId: number): Promise<void> {
  const config = await moderationConfig(ctx.db, ctx.env.MODERATION_GUILD_ID);
  const report = await loadReport(ctx.db, reportId);
  if (!config?.enabled || !report || report.moderationMessageId) return;
  const post = await loadPost(ctx.db, report.postId);
  if (!post) return;

  try {
    const message = await sendMessage(ctx.env, config.channelId, reportMessage(report, post, configLocale(config), ctx.env.APP_URL));
    await ctx.db.update(reports).set({ moderationMessageId: message.id }).where(eq(reports.id, report.id));
  } catch (error) {
    await onSendError(ctx.db, config, error);
  }
}

/**
 * Redraws every moderation message of a post (its card and its reports) after an action.
 * `skipMessageId` is the message the interaction already updated.
 */
export async function refreshModeration(ctx: BotContext, postId: number, skipMessageId?: string): Promise<void> {
  const config = await moderationConfig(ctx.db, ctx.env.MODERATION_GUILD_ID);
  const post = await loadPost(ctx.db, postId);
  if (!config || !post) return;
  const locale = configLocale(config);
  const removal = await moderationRemoval(ctx.db, post);

  const delivered = (await latestDeliveries(ctx.db, postId)).get(config.id);
  const postReports = await ctx.db
    .select({ id: reports.id })
    .from(reports)
    .where(and(eq(reports.postId, postId), isNotNull(reports.moderationMessageId)));

  const edits: (() => Promise<unknown>)[] = [];
  if (delivered && delivered.messageId !== skipMessageId) {
    edits.push(() => editMessage(ctx.env, config.channelId, delivered.messageId, moderationMessage(post, removal, locale, ctx.env.APP_URL)));
  }
  for (const { id } of postReports) {
    const report = await loadReport(ctx.db, id);
    if (!report?.moderationMessageId || report.moderationMessageId === skipMessageId) continue;
    edits.push(() => editMessage(ctx.env, config.channelId, report.moderationMessageId!, reportMessage(report, post, locale, ctx.env.APP_URL)));
  }

  await inBatches(edits, async (edit) => {
    await edit().catch((error) => console.warn(`[bot] moderation message of post ${postId} not refreshed`, loggable(error)));
  });
}
