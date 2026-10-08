/**
 * GC-Scouting - tiers
 *
 * Tier list tiers and helpers.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

export { strongAgents, type TierList } from "@scouting/db/derived";
import type { TierList } from "@scouting/db/derived";

export type TierKey = "confident" | "improve" | "canLearn";

/** Fixed tier colors, independent of the site palette (mirrors the classic tiermaker scale). */
export const TIERS: { key: TierKey; color: string }[] = [
  { key: "confident", color: "#ff7f7f" },
  { key: "improve", color: "#ffbf7f" },
  { key: "canLearn", color: "#ffff7f" },
];

export function groupByTier(tierList: TierList): string[][] {
  const rows: string[][] = TIERS.map(() => []);
  for (const [slug, tier] of Object.entries(tierList)) rows[tier]?.push(slug);
  return rows;
}
