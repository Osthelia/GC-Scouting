/**
 * GC-Scouting - shared
 *
 * Option builders and constants shared by the slash commands.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

import {
  ApplicationCommandOptionType,
  ApplicationIntegrationType,
  ComponentType,
  InteractionContextType,
  type APIApplicationCommandBasicOption,
  type APIMessageComponentInteraction,
  type APIModalSubmitInteraction,
} from "discord-api-types/v10";
import type { BotContext } from "../core/context";
import { localized, t, type Locale } from "../core/i18n";
import { isModerator } from "../core/permissions";
import { findChannelConfig, type ChannelConfig } from "../modules/channels";
import { FEED_CHANNEL_TYPES } from "../modules/feed";

/** Server only commands, installed on servers. */
export const GUILD_COMMAND = {
  contexts: [InteractionContextType.Guild],
  integration_types: [ApplicationIntegrationType.GuildInstall],
};

export function channelOption(descriptionKey: string): APIApplicationCommandBasicOption {
  return {
    type: ApplicationCommandOptionType.Channel,
    name: "channel",
    ...localized(descriptionKey),
    required: true,
    channel_types: FEED_CHANNEL_TYPES,
  };
}

export function languageOption(descriptionKey: string): APIApplicationCommandBasicOption {
  return {
    type: ApplicationCommandOptionType.String,
    name: "language",
    ...localized(descriptionKey),
    required: false,
    choices: [
      { name: "English", value: "en" },
      { name: "Français", value: "fr" },
      { name: "Español", value: "es" },
    ],
  };
}

export { parseId } from "@scouting/db";

/** Inputs of a submitted modal, inside a Label (current modals) or an action row (older ones). */
function modalInputs(interaction: APIModalSubmitInteraction) {
  return interaction.data.components.flatMap((row) => (row.type === ComponentType.Label ? [row.component] : row.type === ComponentType.ActionRow ? row.components : []));
}

/** Value of a text input of a submitted modal. */
export function modalValue(interaction: APIModalSubmitInteraction, id: string): string | null {
  const input = modalInputs(interaction).find((i) => i.custom_id === id);
  return input?.type === ComponentType.TextInput ? input.value : null;
}

/** Picked values of a select of a submitted modal, null when it is missing. */
export function modalSelectValues(interaction: APIModalSubmitInteraction, id: string): string[] | null {
  const input = modalInputs(interaction).find((i) => i.custom_id === id);
  return input?.type === ComponentType.StringSelect ? input.values : null;
}

/** Moderation buttons and modals only work in the moderation channel, for its moderators. */
export async function moderatorGuard(
  interaction: APIMessageComponentInteraction | APIModalSubmitInteraction,
  ctx: BotContext,
  locale: Locale,
): Promise<{ ok: true; config: ChannelConfig; userId: string } | { ok: false; error: string }> {
  const channelId = interaction.channel?.id;
  const config = channelId ? await findChannelConfig(ctx.db, channelId) : null;
  if (!config || config.kind !== "moderation") return { ok: false, error: t(locale, "mod.errors.notModerationChannel") };
  if (!interaction.member || !isModerator(interaction.member, config.moderatorRoleId)) {
    return { ok: false, error: t(locale, "mod.errors.forbidden", { role: config.moderatorRoleId ? `<@&${config.moderatorRoleId}>` : "?" }) };
  }
  return { ok: true, config, userId: interaction.member.user.id };
}
