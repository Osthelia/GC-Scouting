/**
 * GC-Scouting - sanction-rules
 *
 * Rules to tell which GC Stats sanctions are active or blocking.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

import { BLOCKING_SANCTIONS } from "@scouting/db/constants";
import type { GcsSanction } from "@scouting/db/schema";

export function activeSanctions(list: GcsSanction[], now = new Date()): GcsSanction[] {
  return list.filter((s) => new Date(s.startsAt) <= now && (s.endsAt === null || new Date(s.endsAt) > now));
}

/** Mute, suspension or ban in force, the one that ends last. */
export function blockingSanction(list: GcsSanction[], now = new Date()): GcsSanction | null {
  const blocking = activeSanctions(list, now).filter((s) => BLOCKING_SANCTIONS.includes(s.type));
  if (!blocking.length) return null;
  return blocking.reduce((a, b) => (a.endsAt === null ? a : b.endsAt === null || b.endsAt > a.endsAt ? b : a));
}

export function hasWarning(list: GcsSanction[], now = new Date()): boolean {
  return activeSanctions(list, now).some((s) => s.type === "warning");
}
