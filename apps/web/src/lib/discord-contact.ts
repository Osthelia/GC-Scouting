/**
 * GC-Scouting - discord-contact
 *
 * Parsing and validation of the Discord contact of a post.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

// Discord contact of a post: a user ID, and for teams an invite to their server (only its code is stored).

export const DISCORD_INVITE_MAX = 100;

/** Discord snowflake. */
const DISCORD_ID = /^\d{17,20}$/;
const INVITE_CODE = /^[A-Za-z0-9-]{2,32}$/;
const INVITE_HOSTS: Record<string, RegExp> = {
  "discord.gg": /^\/([^/]+)\/?$/,
  "discord.com": /^\/invite\/([^/]+)\/?$/,
  "discordapp.com": /^\/invite\/([^/]+)\/?$/,
};

export function isDiscordId(value: string): boolean {
  return DISCORD_ID.test(value);
}

/** Invite code of a Discord invite link, null if it is not one. */
export function parseDiscordInvite(value: string): string | null {
  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^www\./, "");
  const code = INVITE_HOSTS[host]?.exec(url.pathname)?.[1];
  return code && INVITE_CODE.test(code) ? code : null;
}

export function discordInviteUrl(code: string): string {
  return `https://discord.gg/${code}`;
}

export function discordProfileUrl(id: string): string {
  return `https://discord.com/users/${id}`;
}
