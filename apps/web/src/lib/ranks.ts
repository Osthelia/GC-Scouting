/**
 * GC-Scouting - ranks
 *
 * Valorant ranks with their tier label and color.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

import { RANK_KEYS, type RankKey, type RankTier } from "@scouting/db/constants";

export type Rank = RankKey;

const TIER_STYLE: Record<RankTier, { label: string; color: string }> = {
  iron: { label: "Iron", color: "#8b8b8b" },
  bronze: { label: "Bronze", color: "#b8804a" },
  silver: { label: "Silver", color: "#c9d1d6" },
  gold: { label: "Gold", color: "#e8c04f" },
  platinum: { label: "Platinum", color: "#4fc3c9" },
  diamond: { label: "Diamond", color: "#c38cf2" },
  ascendant: { label: "Ascendant", color: "#4fd08a" },
  immortal: { label: "Immortal", color: "#e8566c" },
  radiant: { label: "Radiant", color: "#fff2a8" },
};

/** Ordered from lowest to highest, the index is the value stored in base. */
export const RANKS = RANK_KEYS.map((key) => {
  const [tier, division] = key.split("_") as [RankTier, string?];
  const style = TIER_STYLE[tier];
  return { key, tier, color: style.color, label: division ? `${style.label} ${division}` : style.label };
});

export const RANK_BY_KEY = Object.fromEntries(RANKS.map((r) => [r.key, r])) as Record<Rank, (typeof RANKS)[number]>;

export function rankKey(index: number | null): Rank | null {
  return index === null ? null : (RANK_KEYS[index] ?? null);
}

export function rankIconUrl(rank: Rank): string {
  return `/valorant/ranks/${rank}.webp`;
}
