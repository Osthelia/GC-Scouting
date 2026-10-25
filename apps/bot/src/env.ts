/**
 * GC-Scouting - env
 *
 * Configuration of the bot process, read from the environment.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

export interface Env {
  DATABASE_URL: string;
  APP_URL: string;
  DISCORD_APPLICATION_ID: string;
  DISCORD_BOT_TOKEN: string;
  /** Only server allowed to host the moderation channel. */
  MODERATION_GUILD_ID: string;
  /** Bearer key of the /internal/* routes called by the site. */
  BOT_INTERNAL_KEY: string;
  /** Port of the internal HTTP server. */
  PORT: string;
  /** UptimeRobot heartbeat URL; push monitoring is off when empty. */
  UPTIMEROBOT_PUSH_URL?: string;
  /** Seconds between two pings (default 60). */
  UPTIMEROBOT_PUSH_INTERVAL?: string;
}

const REQUIRED = ["DATABASE_URL", "APP_URL", "DISCORD_APPLICATION_ID", "DISCORD_BOT_TOKEN", "MODERATION_GUILD_ID", "BOT_INTERNAL_KEY"] as const;

/** Reads the environment, failing at startup on a missing value instead of at the first Discord call. */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const missing = REQUIRED.filter((name) => !source[name]?.trim());
  if (missing.length > 0) throw new Error(`Missing environment variables: ${missing.join(", ")}`);
  return {
    ...(Object.fromEntries(REQUIRED.map((name) => [name, source[name]!.trim()])) as Omit<Env, "PORT" | "UPTIMEROBOT_PUSH_URL" | "UPTIMEROBOT_PUSH_INTERVAL">),
    PORT: source.PORT?.trim() || "8788",
    UPTIMEROBOT_PUSH_URL: source.UPTIMEROBOT_PUSH_URL?.trim() || undefined,
    UPTIMEROBOT_PUSH_INTERVAL: source.UPTIMEROBOT_PUSH_INTERVAL?.trim() || undefined,
  };
}
