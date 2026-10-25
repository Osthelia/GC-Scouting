/**
 * GC-Scouting - gateway
 *
 * Discord gateway connection (discord.js): receives interactions and answers them through the REST client.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

import { Client, Events, Options } from "discord.js";
import { GatewayDispatchEvents, Routes, type APIInteraction, type GatewayDispatchPayload } from "discord-api-types/v10";
import { loggable } from "@scouting/db/log";
import type { BotContext } from "./context";
import { REST_OPTIONS, discordRest, useRest } from "./discord";
import { handleInteraction } from "./router";

/**
 * Connects the bot. Handlers work on the raw interaction payload, so discord.js is only the transport:
 * the interactions arrive over the gateway and the answer goes back through its REST queue.
 * No intent: interactions, and the permissions they carry, are delivered without any.
 */
export function createGateway(ctx: BotContext): Client {
  const client = new Client({
    intents: [],
    // Nothing reads the discord.js caches, keep them empty.
    makeCache: Options.cacheWithLimits({ MessageManager: 0, GuildMemberManager: 0, UserManager: 0, PresenceManager: 0 }),
    rest: REST_OPTIONS,
  });
  useRest(client.rest);

  client.on(Events.Raw, (packet: GatewayDispatchPayload) => {
    if (packet.t !== GatewayDispatchEvents.InteractionCreate) return;
    void answer(ctx, packet.d);
  });
  client.on(Events.Error, (error) => console.error("[bot] gateway error", loggable(error)));
  client.once(Events.ClientReady, (ready) => console.info(`[bot] connected as ${ready.user.tag}`));
  return client;
}

/** Runs the handler and sends its response: Discord expects it within 3 seconds. */
async function answer(ctx: BotContext, interaction: APIInteraction): Promise<void> {
  try {
    const response = await handleInteraction(interaction, ctx);
    await discordRest(ctx.env).post(Routes.interactionCallback(interaction.id, interaction.token), { body: response, auth: false });
  } catch (error) {
    console.error("[bot] interaction callback failed", loggable(error));
  }
}
