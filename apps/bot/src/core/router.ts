/**
 * GC-Scouting - router
 *
 * Dispatches an incoming interaction to its command, button or modal handler.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

import {
  ApplicationCommandType,
  ComponentType,
  InteractionResponseType,
  InteractionType,
  type APIInteraction,
  type APIInteractionResponse,
} from "discord-api-types/v10";
import { commands, components } from "../interactions";
import type { BotContext } from "./context";
import { t, toLocale } from "./i18n";
import { reply } from "./responses";
import { loggable } from "@scouting/db/log";

export async function handleInteraction(interaction: APIInteraction, ctx: BotContext): Promise<APIInteractionResponse> {
  if (interaction.type === InteractionType.Ping) return { type: InteractionResponseType.Pong };

  const locale = toLocale(interaction.locale);
  try {
    switch (interaction.type) {
      case InteractionType.ApplicationCommand: {
        const command = commands.get(interaction.data.name);
        if (command && interaction.data.type === ApplicationCommandType.ChatInput) {
          return await command.execute(interaction as Parameters<typeof command.execute>[0], ctx);
        }
        break;
      }
      case InteractionType.MessageComponent: {
        const [prefix = "", ...args] = interaction.data.custom_id.split(":");
        const handler = components.get(prefix);
        if (handler?.button && interaction.data.component_type === ComponentType.Button) {
          return await handler.button(interaction as Parameters<typeof handler.button>[0], ctx, args);
        }
        break;
      }
      case InteractionType.ModalSubmit: {
        const [prefix = "", ...args] = interaction.data.custom_id.split(":");
        const handler = components.get(prefix);
        if (handler?.modal) return await handler.modal(interaction, ctx, args);
        break;
      }
      case InteractionType.ApplicationCommandAutocomplete:
        return { type: InteractionResponseType.ApplicationCommandAutocompleteResult, data: { choices: [] } };
    }
    // Name or custom id only: modal and command values are user input.
    const data = "data" in interaction ? (interaction.data as { name?: string; custom_id?: string } | undefined) : undefined;
    console.warn("[bot] no handler for interaction", interaction.type, data?.name ?? data?.custom_id ?? null);
    return reply(t(locale, "errors.unknownInteraction"));
  } catch (error) {
    console.error("[bot] interaction failed", loggable(error));
    return reply(t(locale, "errors.generic"));
  }
}
