/**
 * GC-Scouting - social
 *
 * Community links configured for the site.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

// Community links, set in the wrangler vars. Null when not configured, the link is then hidden.
export function socialLinks(): { discordBot: string | null; twitter: string | null } {
  return {
    discordBot: process.env.DISCORD_BOT_INVITE_URL || null,
    twitter: process.env.TWITTER_URL || null,
  };
}
