/**
 * GC-Scouting - agents
 *
 * Valorant agents and roles lookups.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

import { AGENT_CLASSES, VALORANT_AGENTS } from "@scouting/db/constants";

export { VALORANT_AGENTS };

export const VALORANT_ROLES = AGENT_CLASSES;

export const AGENTS_BY_SLUG = Object.fromEntries(VALORANT_AGENTS.map((a) => [a.slug, a]));

export function agentIconUrl(slug: string): string {
  return `/valorant/agents/${slug}.webp`;
}
