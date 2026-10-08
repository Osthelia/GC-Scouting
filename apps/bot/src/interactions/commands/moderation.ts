/**
 * GC-Scouting - moderation
 *
 * Slash command that sets up the moderation channel and roles.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

import { ApplicationCommandOptionType, ComponentType, MessageFlags, PermissionFlagsBits, type RESTPostAPIChannelMessageJSONBody } from "discord-api-types/v10";
import { eq } from "drizzle-orm";
import { discordChannels } from "@scouting/db/schema";
import type { CommandHandler } from "../types";
import { channelOption, GUILD_COMMAND, languageOption } from "../shared";
import { DiscordApiError, sendMessage } from "../../core/discord";
import { isLocale, localized, t, toLocale, type Locale } from "../../core/i18n";
import { CommandOptions } from "../../core/options";
import { isAdministrator } from "../../core/permissions";
import { deferred, reply } from "../../core/responses";
import { findChannelConfig, moderationConfig } from "../../modules/channels";

const ACCENT = 0x9b7bff;

function welcomeMessage(locale: Locale, roleId: string): RESTPostAPIChannelMessageJSONBody {
  return {
    flags: MessageFlags.IsComponentsV2,
    components: [
      {
        type: ComponentType.Container,
        accent_color: ACCENT,
        components: [
          { type: ComponentType.TextDisplay, content: `## ${t(locale, "moderation.welcome.title")}\n${t(locale, "moderation.welcome.text", { role: `<@&${roleId}>` })}` },
        ],
      },
    ],
  };
}

export default {
  scope: "moderation",
  data: {
    name: "moderation",
    ...localized("commands.moderation.description"),
    ...GUILD_COMMAND,
    default_member_permissions: String(PermissionFlagsBits.Administrator),
    options: [
      {
        type: ApplicationCommandOptionType.Subcommand,
        name: "setup",
        ...localized("commands.moderation.setup.description"),
        options: [
          channelOption("commands.moderation.setup.channel"),
          { type: ApplicationCommandOptionType.Role, name: "role", ...localized("commands.moderation.setup.role"), required: true },
          languageOption("commands.moderation.setup.language"),
        ],
      },
      { type: ApplicationCommandOptionType.Subcommand, name: "remove", ...localized("commands.moderation.remove") },
    ],
  },

  async execute(interaction, ctx) {
    const locale = toLocale(interaction.locale);
    const guildId = interaction.guild_id;
    const userId = interaction.member?.user.id;
    if (!guildId || !userId) return reply(t(locale, "errors.guildOnly"));
    // The command is only registered there, checked again in case it leaks to another server.
    if (guildId !== ctx.env.MODERATION_GUILD_ID) return reply(t(locale, "moderation.errors.wrongGuild"));
    if (!isAdministrator(interaction.member)) return reply(t(locale, "errors.administrator"));

    const options = new CommandOptions(interaction);
    const { db, env } = ctx;
    const current = await moderationConfig(db, guildId);

    if (options.subcommand === "remove") {
      if (!current) return reply(t(locale, "moderation.errors.notConfigured"));
      await db.delete(discordChannels).where(eq(discordChannels.id, current.id));
      return reply(t(locale, "moderation.removed"));
    }

    const channel = options.channel("channel");
    const role = options.role("role");
    if (!channel) return reply(t(locale, "errors.channelRequired"));
    if (!role) return reply(t(locale, "moderation.errors.roleRequired"));
    if (role.id === guildId) return reply(t(locale, "moderation.errors.everyone"));
    const mention = `<#${channel.id}>`;

    const existing = await findChannelConfig(db, channel.id);
    if (existing?.kind === "feed") return reply(t(locale, "moderation.errors.feedChannel", { channel: mention }));
    const language = options.string("language");
    const channelLocale = isLocale(language) ? language : toLocale(interaction.guild_locale);

    return deferred(ctx, interaction.token, locale, async () => {
      try {
        await sendMessage(env, channel.id, welcomeMessage(channelLocale, role.id));
      } catch (error) {
        if (error instanceof DiscordApiError && error.channelUnreachable) return t(locale, "errors.channelUnreachable", { channel: mention });
        throw error;
      }

      // A single moderation channel: setting another one moves it.
      const values = { channelId: channel.id, moderatorRoleId: role.id, locale: channelLocale, enabled: true };
      if (current) await db.update(discordChannels).set(values).where(eq(discordChannels.id, current.id));
      else await db.insert(discordChannels).values({ ...values, guildId, kind: "moderation", createdByDiscordId: userId });
      return t(locale, "moderation.setupDone", { channel: mention, role: `<@&${role.id}>` });
    });
  },
} satisfies CommandHandler;
