/**
 * GC-Scouting - links
 *
 * Link detection and the allowlist for chat messages.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

// Links in chat messages. Trusted domains are clickable, the others stay hidden until the reader asks for them.

export const CHAT_LINK_ALLOWLIST = ["discord.com", "discord.gg", "discordapp.com", "x.com", "twitter.com", "gc-stats.app", "vlr.gg", "liquipedia.net"] as const;

export type ChatToken = { kind: "text"; value: string } | { kind: "link"; href: string; label: string; host: string; trusted: boolean };

const URL_PATTERN = /\b(?:https?:\/\/|www\.)[^\s<>"']+/gi;
const TRAILING = /[.,;:!?)\]}'"]+$/;

export function isTrustedHost(host: string): boolean {
  const h = host.toLowerCase().replace(/\.$/, "");
  return CHAT_LINK_ALLOWLIST.some((domain) => h === domain || h.endsWith(`.${domain}`));
}

/** Splits a message into text and links. A link that does not parse stays text. */
export function tokenizeMessage(body: string): ChatToken[] {
  const tokens: ChatToken[] = [];
  let last = 0;
  for (const match of body.matchAll(URL_PATTERN)) {
    const raw = match[0].replace(TRAILING, "");
    const start = match.index!;
    let url: URL | null = null;
    try {
      url = new URL(raw.startsWith("www.") ? `https://${raw}` : raw);
    } catch {}
    if (!url) continue;
    if (start > last) tokens.push({ kind: "text", value: body.slice(last, start) });
    tokens.push({ kind: "link", href: url.toString(), label: raw, host: url.hostname, trusted: isTrustedHost(url.hostname) });
    last = start + raw.length;
  }
  if (last < body.length) tokens.push({ kind: "text", value: body.slice(last) });
  return tokens;
}
