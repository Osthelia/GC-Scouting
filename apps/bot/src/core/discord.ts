/**
 * GC-Scouting - discord
 *
 * Discord REST client (discord.js) with rate limit queueing, timeout and typed errors.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

import { DiscordAPIError, REST, RESTJSONErrorCodes } from "discord.js";
import { MessageFlags, Routes, type APIChannel, type APIMessage, type RESTPostAPIChannelMessageJSONBody } from "discord-api-types/v10";
import type { Env } from "../env";

/** A stuck Discord call must not hold a sync forever. */
const REQUEST_TIMEOUT_MS = 10_000;

export class DiscordApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: number | undefined,
    message: string,
  ) {
    super(`Discord API ${status}${code ? ` (${code})` : ""}: ${message}`);
  }

  /** The channel is gone or the bot cannot post there anymore. */
  get channelUnreachable(): boolean {
    return (
      this.code === RESTJSONErrorCodes.UnknownChannel ||
      this.code === RESTJSONErrorCodes.MissingAccess ||
      this.code === RESTJSONErrorCodes.MissingPermissions
    );
  }

  get unknownMessage(): boolean {
    return this.code === RESTJSONErrorCodes.UnknownMessage;
  }
}

export const REST_OPTIONS = { version: "10", timeout: REQUEST_TIMEOUT_MS, userAgentAppendix: "GC-Scouting" } as const;

/** One client for the whole process: it queues requests per rate limit bucket and retries on 429. */
let rest: REST | null = null;

/** The gateway client shares its own REST client, so a single rate limit state exists. */
export function useRest(shared: REST): void {
  rest = shared;
}

export function discordRest(env: Pick<Env, "DISCORD_BOT_TOKEN">): REST {
  rest ??= new REST(REST_OPTIONS).setToken(env.DISCORD_BOT_TOKEN);
  return rest;
}

export async function discordRequest<T>(
  env: Pick<Env, "DISCORD_BOT_TOKEN">,
  method: "GET" | "POST" | "PATCH" | "DELETE",
  route: `/${string}`,
  body?: unknown,
  auth = true,
): Promise<T> {
  const client = discordRest(env);
  const call = { GET: client.get, POST: client.post, PATCH: client.patch, DELETE: client.delete }[method].bind(client);
  try {
    return (await call(route, { body, auth })) as T;
  } catch (error) {
    if (error instanceof DiscordAPIError) throw new DiscordApiError(error.status, typeof error.code === "number" ? error.code : undefined, error.message);
    throw error;
  }
}

// Mentions written by users (display name, description) must never ping.
const NO_MENTIONS = { allowed_mentions: { parse: [] } };

export function sendMessage(env: Env, channelId: string, body: RESTPostAPIChannelMessageJSONBody): Promise<APIMessage> {
  return discordRequest(env, "POST", Routes.channelMessages(channelId), { ...NO_MENTIONS, ...body });
}

export function fetchChannel(env: Env, channelId: string): Promise<APIChannel> {
  return discordRequest(env, "GET", Routes.channel(channelId));
}

export function editMessage(env: Env, channelId: string, messageId: string, body: RESTPostAPIChannelMessageJSONBody): Promise<APIMessage> {
  return discordRequest(env, "PATCH", Routes.channelMessage(channelId, messageId), { ...NO_MENTIONS, ...body });
}

export function deleteMessage(env: Env, channelId: string, messageId: string): Promise<void> {
  return discordRequest(env, "DELETE", Routes.channelMessage(channelId, messageId));
}

/** Edits the reply of a deferred interaction. Webhook routes take the interaction token, not the bot token. */
export function editInteractionReply(env: Env, token: string, body: RESTPostAPIChannelMessageJSONBody): Promise<APIMessage> {
  return discordRequest(env, "PATCH", Routes.webhookMessage(env.DISCORD_APPLICATION_ID, token), { ...NO_MENTIONS, ...body }, false);
}

/** Private message sent after an interaction was acknowledged. */
export function sendFollowup(env: Env, token: string, content: string): Promise<APIMessage> {
  return discordRequest(env, "POST", Routes.webhook(env.DISCORD_APPLICATION_ID, token), { ...NO_MENTIONS, content, flags: MessageFlags.Ephemeral }, false);
}
