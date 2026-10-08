/**
 * GC-Scouting - tracker
 *
 * Tracker.gg profile handling.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

// Tracker.gg Valorant profiles. Only the Riot ID is stored, the link is rebuilt from it.

export const TRACKER_URL_MAX = 200;
/** Game name (16) + "#" + tagline (5). */
export const RIOT_ID_MAX = 22;

const GAME_NAME = /^[\p{L}\p{M}\p{N} _.]{3,16}$/u;
const TAGLINE = /^[\p{L}\p{N}]{3,5}$/u;
const PROFILE_PATH = /^\/valorant\/profile\/riot\/([^/]+)(?:\/|$)/;

/** Riot ID ("Name#TAG") of a tracker.gg Valorant profile link, null if it is not one. */
export function parseTrackerUrl(value: string): string | null {
  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
  } catch {
    return null;
  }
  if (url.hostname !== "tracker.gg" && url.hostname !== "www.tracker.gg") return null;
  let segment = url.pathname.match(PROFILE_PATH)?.[1];
  if (!segment) return null;
  // An unencoded "#" puts the tagline in the hash.
  if (!/%23/i.test(segment) && url.pathname.endsWith(segment)) segment += encodeURIComponent(url.hash.split("/")[0]!);
  let riotId: string;
  try {
    riotId = decodeURIComponent(segment).normalize("NFC");
  } catch {
    return null;
  }
  const hash = riotId.lastIndexOf("#");
  const name = riotId.slice(0, hash).trim();
  const tag = riotId.slice(hash + 1).trim();
  return hash > 0 && GAME_NAME.test(name) && TAGLINE.test(tag) ? `${name}#${tag}` : null;
}

export function trackerUrl(riotId: string): string {
  return `https://tracker.gg/valorant/profile/riot/${encodeURIComponent(riotId)}/overview`;
}
