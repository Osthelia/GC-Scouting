/**
 * GC-Scouting - env
 *
 * Bindings and secrets available to the bot worker.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

export interface Env {
  HYPERDRIVE: Hyperdrive;
  APP_URL: string;
  /** "Ouvrir KASM" link of the moderation messages, opens the tweets page of the site. */
  KASM_TWEETS_URL: string;
  DISCORD_APPLICATION_ID: string;
  DISCORD_PUBLIC_KEY: string;
  DISCORD_BOT_TOKEN: string;
  /** Only server allowed to host the moderation channel. */
  MODERATION_GUILD_ID: string;
  /** Bearer key of the /internal/* routes called by the site. */
  BOT_INTERNAL_KEY: string;
}
