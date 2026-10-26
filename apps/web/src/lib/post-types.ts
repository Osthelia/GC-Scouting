/**
 * GC-Scouting - post-types
 *
 * Post types with their code and color.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

import { POST_TYPES as POST_TYPE_KEYS, POST_TYPE_COLORS, type PostType } from "@scouting/db/constants";

export type { PostType };

export const POST_TYPES = POST_TYPE_KEYS.map((key) => ({ key, code: key.toUpperCase(), color: POST_TYPE_COLORS[key] }));

export const POST_TYPE_BY_KEY = Object.fromEntries(POST_TYPES.map((t) => [t.key, t])) as Record<PostType, (typeof POST_TYPES)[number]>;

export type FilterGroup = "spot" | "role" | "staffRole" | "compensation" | "lan" | "age" | "rank" | "agents" | "experience" | "availability";

/** Filter groups shown on each type page, region and language apply everywhere. */
export const FILTER_GROUPS: Record<PostType, readonly FilterGroup[]> = {
  lft: ["spot", "age", "role", "rank", "agents", "compensation", "lan", "experience", "availability"],
  lfp: ["spot", "age", "role", "rank", "compensation", "lan", "experience", "availability"],
  lfs: ["staffRole", "age", "compensation", "lan", "experience", "availability"],
  lfo: ["compensation", "experience", "availability"],
  lfst: ["staffRole", "age", "compensation", "lan", "experience", "availability"],
};

export function isPostType(value: string): value is PostType {
  return Object.hasOwn(POST_TYPE_BY_KEY, value);
}
