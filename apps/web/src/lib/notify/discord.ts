/**
 * GC-Scouting - discord
 *
 * Sends Discord messages through the notification service.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

import { loggable } from "@scouting/db/log";

// Discord DMs through the shared Osthelia DiscordNotificationsWorker, reached at DISCORD_NOTIFICATIONS_WORKER_URL.
// Payload shapes mirror the notification service types.

const SERVICE_NAME = "scouting";
const SEND_TIMEOUT_MS = 5000;

export type DiscordButton = { label: string; url: string };

export type DiscordContainerBlock =
  | { kind: "text"; content: string }
  | { kind: "images"; urls: string[] }
  | { kind: "separator"; large?: boolean; divider?: boolean }
  | { kind: "buttons"; buttons: DiscordButton[] };

export type DiscordContainer = { accentColor?: number; spoiler?: boolean; blocks: DiscordContainerBlock[] };

/** `dm_blocked` and validation errors are permanent, the others are worth a retry. */
export type DiscordDmResult = { ok: true } | { ok: false; error: string };

/** Never throws, a failure comes back as a result. */
export async function sendDiscordDm(discordId: string, container: DiscordContainer): Promise<DiscordDmResult> {
  const baseUrl = process.env.DISCORD_NOTIFICATIONS_WORKER_URL?.replace(/\/$/, "");
  const key = process.env.DISCORD_NOTIFICATIONS_WORKER_KEY;
  if (!baseUrl || !key) return { ok: false, error: "not_configured" };

  try {
    const response = await fetch(`${baseUrl}/notify`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({ discordId, service: SERVICE_NAME, type: "container", container }),
      signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
    });
    const body = (await response.json().catch(() => ({}))) as { ok?: boolean; error?: string };
    if (response.ok && body.ok) return { ok: true };
    console.warn(`[discord] notify answered ${response.status}`, body.error);
    return { ok: false, error: body.error ?? "request_failed" };
  } catch (error) {
    console.warn("[discord] notify request failed", loggable(error));
    return { ok: false, error: "request_failed" };
  }
}

export function isTransientDiscordError(error: string): boolean {
  return error === "rate_limited" || error === "request_failed" || error === "not_configured";
}
