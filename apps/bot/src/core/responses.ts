/**
 * GC-Scouting - responses
 *
 * Builders for Discord interaction responses (messages, components, modals).
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

import {
  InteractionResponseType,
  MessageFlags,
  type APIInteractionResponse,
  type APIMessageTopLevelComponent,
  type APIModalInteractionResponseCallbackData,
  type RESTPostAPIChannelMessageJSONBody,
} from "discord-api-types/v10";
import { editInteractionReply, sendFollowup } from "./discord";
import type { BotContext } from "./context";
import { t, type Locale } from "./i18n";
import { loggable } from "@scouting/db/log";

const NO_MENTIONS = { allowed_mentions: { parse: [] } };

/** Private text answer, used for confirmations and validation errors. */
export function reply(content: string): APIInteractionResponse {
  return { type: InteractionResponseType.ChannelMessageWithSource, data: { ...NO_MENTIONS, content, flags: MessageFlags.Ephemeral } };
}

/** Private Components V2 answer. */
export function replyComponents(components: APIMessageTopLevelComponent[]): APIInteractionResponse {
  return {
    type: InteractionResponseType.ChannelMessageWithSource,
    data: { ...NO_MENTIONS, components, flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 },
  };
}

/** Replaces the message the button (or the modal opened from it) belongs to. */
export function updateMessage(body: RESTPostAPIChannelMessageJSONBody): APIInteractionResponse {
  return { type: InteractionResponseType.UpdateMessage, data: { ...NO_MENTIONS, ...body } };
}

export function openModal(data: APIModalInteractionResponseCallbackData): APIInteractionResponse {
  return { type: InteractionResponseType.Modal, data };
}

/**
 * Answers "thinking..." right away and edits the answer once `work` is done.
 * For anything that calls Discord or may run past the 3 second deadline.
 */
export function deferred(ctx: BotContext, token: string, locale: Locale, work: () => Promise<string>): APIInteractionResponse {
  ctx.defer(async () => {
    let content: string;
    try {
      content = await work();
    } catch (error) {
      console.error("[bot] deferred interaction failed", loggable(error));
      content = t(locale, "errors.generic");
    }
    await editInteractionReply(ctx.env, token, { content });
  });
  return { type: InteractionResponseType.DeferredChannelMessageWithSource, data: { flags: MessageFlags.Ephemeral } };
}

/** What a button or modal ends with: the new state of its message, or a private error. */
export type ComponentOutcome = { update: RESTPostAPIChannelMessageJSONBody } | { error: string };

/**
 * Acknowledges a button or modal right away (the button stops loading), then runs `work`
 * and edits the message it belongs to. Keeps database work out of the 3 second deadline.
 */
export function deferredUpdate(ctx: BotContext, token: string, locale: Locale, work: () => Promise<ComponentOutcome>): APIInteractionResponse {
  ctx.defer(async () => {
    let outcome: ComponentOutcome;
    try {
      outcome = await work();
    } catch (error) {
      console.error("[bot] deferred update failed", loggable(error));
      outcome = { error: t(locale, "errors.generic") };
    }
    if ("update" in outcome) await editInteractionReply(ctx.env, token, outcome.update);
    else await sendFollowup(ctx.env, token, outcome.error);
  });
  return { type: InteractionResponseType.DeferredMessageUpdate };
}
