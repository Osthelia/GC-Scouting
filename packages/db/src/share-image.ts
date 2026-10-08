/**
 * GC-Scouting - share-image
 *
 * Share image data of a post and its version hash.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

import type { TierList } from "./derived";

// Share image of a post (OG, Twitter, Discord), always in English: rendered by the site, stored in R2, linked by the site and the bot.

/** Bump when the image layout changes, stored images are then rendered again. */
const LAYOUT_VERSION = 5;

/** Post columns drawn on the image. */
export type ShareImagePost = {
  id: number;
  type: string;
  displayName: string;
  region: string;
  country: string | null;
  rosterSpot: string | null;
  roles: readonly string[];
  igl: readonly string[];
  staffRoles: readonly string[];
  rankCurrent: number | null;
  rankPeak: number | null;
  rankMin: number | null;
  rankMax: number | null;
  tierList: TierList | null;
};

/** Changes whenever something drawn on the image changes (FNV-1a of the drawn columns). */
export function shareImageVersion(post: ShareImagePost): string {
  const tiers = post.tierList ? Object.entries(post.tierList).sort(([a], [b]) => (a < b ? -1 : 1)) : null;
  const input = JSON.stringify([
    LAYOUT_VERSION,
    post.type,
    post.displayName,
    post.region,
    post.country,
    post.rosterSpot,
    post.roles,
    post.igl,
    post.staffRoles,
    post.rankCurrent,
    post.rankPeak,
    post.rankMin,
    post.rankMax,
    tiers,
  ]);
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}

/** Absolute URL of the image, the version in the URL busts Discord and Twitter caches. */
export function shareImageUrl(appUrl: string, post: ShareImagePost): string {
  return `${appUrl.replace(/\/$/, "")}/api/posts/${post.id}/image?v=${shareImageVersion(post)}`;
}
