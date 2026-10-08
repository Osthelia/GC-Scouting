/**
 * GC-Scouting - types
 *
 * Handler types and custom id helpers for commands and components.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

import type {
  APIChatInputApplicationCommandInteraction,
  APIInteractionResponse,
  APIMessageComponentButtonInteraction,
  APIModalSubmitInteraction,
  RESTPostAPIChatInputApplicationCommandsJSONBody,
} from "discord-api-types/v10";
import type { BotContext } from "../core/context";

export type CommandHandler = {
  data: RESTPostAPIChatInputApplicationCommandsJSONBody;
  /** `moderation` commands are only registered on the moderation server. */
  scope: "global" | "moderation";
  execute(interaction: APIChatInputApplicationCommandInteraction, ctx: BotContext): Promise<APIInteractionResponse>;
};

/** Buttons and modals, routed on the first part of their custom id (`prefix:action:arg...`). */
export type ComponentHandler = {
  prefix: string;
  button?(interaction: APIMessageComponentButtonInteraction, ctx: BotContext, args: string[]): Promise<APIInteractionResponse>;
  modal?(interaction: APIModalSubmitInteraction, ctx: BotContext, args: string[]): Promise<APIInteractionResponse>;
};

export function customId(prefix: string, ...args: (string | number)[]): string {
  return [prefix, ...args].join(":");
}
