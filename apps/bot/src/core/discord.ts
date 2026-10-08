/**
 * GC-Scouting - discord
 *
 * Minimal Discord REST client with timeout and rate limit retry handling.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

import { MessageFlags, RESTJSONErrorCodes, Routes, type APIChannel, type APIMessage, type RESTPostAPIChannelMessageJSONBody } from "discord-api-types/v10";
import type { Env } from "../env";

const API_URL = "https://discord.com/api/v10";
/** Longest rate limit wait accepted before giving up, in seconds. */
const MAX_RETRY_AFTER = 5;
/** A stuck Discord call must not hold a sync until the Worker is cut off. */
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

export async function discordRequest<T>(env: Env, method: string, route: `/${string}`, body?: unknown, auth = true): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    const response = await fetch(API_URL + route, {
      method,
      headers: {
        ...(auth ? { Authorization: `Bot ${env.DISCORD_BOT_TOKEN}` } : {}),
        "Content-Type": "application/json",
        "User-Agent": "DiscordBot (https://github.com/Osthelia/GC-Scouting, 1.0.0)",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (response.status === 204) return undefined as T;
    const data = (await response.json().catch(() => null)) as { code?: number; message?: string; retry_after?: number } | null;

    if (response.status === 429 && attempt === 0 && (data?.retry_after ?? Infinity) <= MAX_RETRY_AFTER) {
      await new Promise((resolve) => setTimeout(resolve, data!.retry_after! * 1000));
      continue;
    }
    if (!response.ok) throw new DiscordApiError(response.status, data?.code, data?.message ?? response.statusText);
    return data as T;
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
