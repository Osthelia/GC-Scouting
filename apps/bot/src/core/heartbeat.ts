/**
 * GC-Scouting - heartbeat
 *
 * Push monitoring: periodically calls the UptimeRobot heartbeat URL so the monitor raises an alert when the pings stop.
 * Pings are only sent while the gateway connection is ready and the database answers, so a bot that runs but is
 * disconnected is reported as down.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

import { sql } from "drizzle-orm";
import type { Client } from "discord.js";
import type { BotContext } from "./context";

const DEFAULT_INTERVAL_SECONDS = 60;
const REQUEST_TIMEOUT_MS = 10_000;

async function ping(client: Client, ctx: BotContext, url: string): Promise<void> {
  if (!client.isReady()) return;
  try {
    await ctx.db.execute(sql`select 1`);
    const response = await fetch(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
    if (!response.ok) console.error(`[bot] heartbeat rejected: HTTP ${response.status}`);
  } catch (error) {
    console.error("[bot] heartbeat failed:", error instanceof Error ? error.message : error);
  }
}

/** Starts the pings; returns the timer to clear on shutdown, or null when no URL is configured. */
export function startHeartbeat(client: Client, ctx: BotContext): NodeJS.Timeout | null {
  const url = ctx.env.UPTIMEROBOT_PUSH_URL;
  if (!url) return null;

  const seconds = Number(ctx.env.UPTIMEROBOT_PUSH_INTERVAL) || DEFAULT_INTERVAL_SECONDS;
  void ping(client, ctx, url);
  const timer = setInterval(() => void ping(client, ctx, url), seconds * 1000);
  timer.unref();
  console.info(`[bot] push monitoring enabled (every ${seconds}s)`);
  return timer;
}
