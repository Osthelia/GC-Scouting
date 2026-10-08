/**
 * GC-Scouting - discord
 *
 * Sends Discord messages through the notification service.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

import { getCloudflareContext } from "@opennextjs/cloudflare";
import { loggable } from "@scouting/db/log";

// Discord DMs through the shared Osthelia DiscordNotificationsWorker.
// On Cloudflare it is reached with the DISCORD_NOTIFICATIONS Service Binding (the Worker has no public URL),
// DISCORD_NOTIFICATIONS_WORKER_URL is only for local dev. Payload shapes mirror the Worker's own types.

const SERVICE_NAME = "scouting";
const BINDING_BASE_URL = "http://discord-notifications";
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

function transport(): { url: string; fetch: typeof fetch } | null {
  if (process.env.DEPLOY_TARGET === "cloudflare") {
    const binding = getCloudflareContext().env.DISCORD_NOTIFICATIONS;
    return { url: BINDING_BASE_URL, fetch: binding.fetch.bind(binding) as typeof fetch };
  }
  const url = process.env.DISCORD_NOTIFICATIONS_WORKER_URL;
  return url ? { url: url.replace(/\/$/, ""), fetch } : null;
}

/** Never throws, a failure comes back as a result. */
export async function sendDiscordDm(discordId: string, container: DiscordContainer): Promise<DiscordDmResult> {
  const target = transport();
  const key = process.env.DISCORD_NOTIFICATIONS_WORKER_KEY;
  if (!target || !key) return { ok: false, error: "not_configured" };

  try {
    const response = await target.fetch(`${target.url}/notify`, {
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
