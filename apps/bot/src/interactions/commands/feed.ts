/**
 * GC-Scouting - feed
 *
 * Slash command that configures a post feed in a channel.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

import { ApplicationCommandOptionType, ComponentType, PermissionFlagsBits, type APIComponentInContainer } from "discord-api-types/v10";
import { and, eq } from "drizzle-orm";
import { discordChannels } from "@scouting/db/schema";
import type { CommandHandler } from "../types";
import { channelOption, GUILD_COMMAND, languageOption } from "../shared";
import { isLocale, localized, t, toLocale } from "../../core/i18n";
import { CommandOptions } from "../../core/options";
import { canManageGuild } from "../../core/permissions";
import { reply, replyComponents } from "../../core/responses";
import { configFilters, configLocale, FEEDS_PER_GUILD_MAX, findChannelConfig, listGuildFeeds } from "../../modules/channels";
import { FEED_ACCENT, setupMessage } from "../../modules/feed";
import { describeFilters } from "../../modules/filters";

export default {
  scope: "global",
  data: {
    name: "feed",
    ...localized("commands.feed.description"),
    ...GUILD_COMMAND,
    default_member_permissions: String(PermissionFlagsBits.ManageGuild),
    options: [
      {
        type: ApplicationCommandOptionType.Subcommand,
        name: "add",
        ...localized("commands.feed.add.description"),
        options: [
          channelOption("commands.feed.add.channel"),
          languageOption("commands.feed.add.language"),
        ],
      },
      { type: ApplicationCommandOptionType.Subcommand, name: "remove", ...localized("commands.feed.remove"), options: [channelOption("commands.feed.channel")] },
      { type: ApplicationCommandOptionType.Subcommand, name: "pause", ...localized("commands.feed.pause"), options: [channelOption("commands.feed.channel")] },
      { type: ApplicationCommandOptionType.Subcommand, name: "resume", ...localized("commands.feed.resume"), options: [channelOption("commands.feed.channel")] },
      { type: ApplicationCommandOptionType.Subcommand, name: "list", ...localized("commands.feed.list") },
    ],
  },

  async execute(interaction, ctx) {
    const locale = toLocale(interaction.locale);
    const guildId = interaction.guild_id;
    const userId = interaction.member?.user.id;
    if (!guildId || !userId) return reply(t(locale, "errors.guildOnly"));
    // Discord already hides the command, checked again here.
    if (!canManageGuild(interaction.member)) return reply(t(locale, "errors.manageGuild"));

    const options = new CommandOptions(interaction);
    const { db, env } = ctx;

    if (options.subcommand === "list") {
      const feeds = await listGuildFeeds(db, guildId);
      if (!feeds.length) return reply(t(locale, "feed.list.empty"));

      const blocks: APIComponentInContainer[] = [{ type: ComponentType.TextDisplay, content: `## ${t(locale, "feed.list.title")}` }];
      for (const feed of feeds) {
        const filters = configFilters(feed);
        const state = [t(locale, `languages.${configLocale(feed)}`), feed.enabled ? null : t(locale, "feed.list.paused")].filter(Boolean).join(", ");
        const lines = filters ? describeFilters(locale, filters) : [t(locale, "feed.list.invalidFilters")];
        blocks.push(
          { type: ComponentType.Separator },
          { type: ComponentType.TextDisplay, content: [`### <#${feed.channelId}>`, `-# ${state}`, ...lines].join("\n") },
        );
      }
      return replyComponents([{ type: ComponentType.Container, accent_color: FEED_ACCENT, components: blocks }]);
    }

    const channel = options.channel("channel");
    if (!channel) return reply(t(locale, "errors.channelRequired"));
    const mention = `<#${channel.id}>`;
    const existing = await findChannelConfig(db, channel.id);

    if (options.subcommand === "add") {
      if (existing?.kind === "moderation") return reply(t(locale, "feed.errors.moderationChannel", { channel: mention }));
      if (!existing && (await listGuildFeeds(db, guildId)).length >= FEEDS_PER_GUILD_MAX) {
        return reply(t(locale, "feed.errors.limit", { max: FEEDS_PER_GUILD_MAX }));
      }
      const language = options.string("language");
      const feedLocale = isLocale(language) ? language : existing ? configLocale(existing) : toLocale(interaction.guild_locale);
      const filters = (existing && configFilters(existing)) || {};
      // Saved from the setup message, which posts a new "Scouting posts" message in the channel.
      const session = { channelId: channel.id, messageId: null, locale: feedLocale, filters };
      return replyComponents(setupMessage(locale, session, env.APP_URL).components ?? []);
    }

    if (!existing || existing.kind !== "feed" || existing.guildId !== guildId) return reply(t(locale, "feed.errors.notFound", { channel: mention }));
    const where = and(eq(discordChannels.id, existing.id), eq(discordChannels.guildId, guildId));

    switch (options.subcommand) {
      case "remove":
        await db.delete(discordChannels).where(where);
        return reply(t(locale, "feed.removed", { channel: mention }));
      case "pause":
        await db.update(discordChannels).set({ enabled: false }).where(where);
        return reply(t(locale, "feed.paused", { channel: mention }));
      case "resume":
        await db.update(discordChannels).set({ enabled: true }).where(where);
        return reply(t(locale, "feed.resumed", { channel: mention }));
    }
    return reply(t(locale, "errors.unknownInteraction"));
  },
} satisfies CommandHandler;
