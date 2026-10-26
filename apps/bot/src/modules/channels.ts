/**
 * GC-Scouting - channels
 *
 * Stored channel configuration (feeds and moderation) and its limits.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

import { and, asc, eq } from "drizzle-orm";
import { discordChannels } from "@scouting/db/schema";
import { postFiltersSchema, type PostFilters } from "@scouting/db";
import { isLocale, type Locale } from "../core/i18n";
import type { Queryable } from "./posts";

export type ChannelConfig = typeof discordChannels.$inferSelect;

/** Feed channels a single server can configure. */
export const FEEDS_PER_GUILD_MAX = 10;

export function configLocale(config: ChannelConfig): Locale {
  return isLocale(config.locale) ? config.locale : "en";
}

/** Stored filters, null when they no longer pass the shared schema (the feed is then skipped). */
export function configFilters(config: ChannelConfig): PostFilters | null {
  const parsed = postFiltersSchema.safeParse(config.filters);
  return parsed.success ? parsed.data : null;
}

export async function findChannelConfig(db: Queryable, channelId: string): Promise<ChannelConfig | null> {
  const [config] = await db.select().from(discordChannels).where(eq(discordChannels.channelId, channelId)).limit(1);
  return config ?? null;
}

export function listGuildFeeds(db: Queryable, guildId: string): Promise<ChannelConfig[]> {
  return db
    .select()
    .from(discordChannels)
    .where(and(eq(discordChannels.guildId, guildId), eq(discordChannels.kind, "feed")))
    .orderBy(asc(discordChannels.createdAt));
}

export async function moderationConfig(db: Queryable, guildId: string): Promise<ChannelConfig | null> {
  const [config] = await db
    .select()
    .from(discordChannels)
    .where(and(eq(discordChannels.guildId, guildId), eq(discordChannels.kind, "moderation")))
    .limit(1);
  return config ?? null;
}

export function enabledChannels(db: Queryable): Promise<ChannelConfig[]> {
  return db.select().from(discordChannels).where(eq(discordChannels.enabled, true));
}

export async function disableChannel(db: Queryable, id: number): Promise<void> {
  await db.update(discordChannels).set({ enabled: false }).where(eq(discordChannels.id, id));
}
