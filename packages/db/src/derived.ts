/**
 * GC-Scouting - derived
 *
 * Post columns computed on write (tier list, availability, experience).
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

import { MINUTES_PER_WEEK, STRONG_TIER_MAX, TOURNAMENT_LEVELS, type TournamentLevel } from "./constants";

// Post columns computed on write, shared by the web app, the seed and the bot.

/** Agent slug to tier index (0 = most confident). */
export type TierList = Record<string, number>;

/** Weekly slot in the author's timezone. `day` 0 = Monday, `start`/`end` in minutes from midnight (end <= 1440). */
export type AvailabilitySlot = { day: number; start: number; end: number };

/** Months of experience at each tournament level played. */
export type Experience = Partial<Record<TournamentLevel, number>>;

/** Levels of an experience, lowest first, stored in `posts.tournament_levels` for the filter. */
export function experienceLevels(experience: Experience): TournamentLevel[] {
  return TOURNAMENT_LEVELS.filter((level) => (experience[level] ?? 0) > 0);
}

/** Minutes of the week, `end` excluded. */
export type WeekRange = [start: number, end: number];

/** Minutes from midnight as "HH:MM", 1440 gives "24:00". */
export function formatTime(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

/** Agents in the top tiers, stored in `posts.strong_agents` for the "can play X" filter. */
export function strongAgents(tierList: TierList): string[] {
  return Object.entries(tierList)
    .filter(([, tier]) => tier <= STRONG_TIER_MAX)
    .map(([slug]) => slug);
}

/** Offset of a timezone from UTC in minutes (Paris in summer = 120). */
export function timezoneOffset(timezone: string, at: Date = new Date()): number {
  const name = new Intl.DateTimeFormat("en-US", { timeZone: timezone, timeZoneName: "longOffset" })
    .formatToParts(at)
    .find((p) => p.type === "timeZoneName")?.value;
  const match = name?.match(/GMT([+-])(\d{2}):(\d{2})/);
  if (!match) return 0;
  const minutes = Number(match[2]) * 60 + Number(match[3]);
  return match[1] === "-" ? -minutes : minutes;
}

/** Sorted, merged ranges. */
function normalize(ranges: WeekRange[]): WeekRange[] {
  const sorted = ranges.filter(([s, e]) => e > s).sort((a, b) => a[0] - b[0]);
  const merged: WeekRange[] = [];
  for (const [s, e] of sorted) {
    const last = merged.at(-1);
    if (last && s <= last[1]) last[1] = Math.max(last[1], e);
    else merged.push([s, e]);
  }
  return merged;
}

/** Moves ranges by `delta` minutes, wrapping around the week. */
export function shiftRanges(ranges: WeekRange[], delta: number): WeekRange[] {
  const out: WeekRange[] = [];
  for (const [s, e] of ranges) {
    const start = (((s + delta) % MINUTES_PER_WEEK) + MINUTES_PER_WEEK) % MINUTES_PER_WEEK;
    const end = start + (e - s);
    if (end <= MINUTES_PER_WEEK) out.push([start, end]);
    else out.push([start, MINUTES_PER_WEEK], [0, end - MINUTES_PER_WEEK]);
  }
  return normalize(out);
}

export function slotsToRanges(slots: AvailabilitySlot[]): WeekRange[] {
  return normalize(slots.map((s) => [s.day * 1440 + s.start, s.day * 1440 + s.end]));
}

/** Local slots to UTC minutes of the week, with the offset of `at` (recomputed on renewal for DST). */
export function slotsToUtc(slots: AvailabilitySlot[], timezone: string, at?: Date): WeekRange[] {
  return shiftRanges(slotsToRanges(slots), -timezoneOffset(timezone, at));
}

/** Postgres `int4multirange` literal. */
export function toMultirange(ranges: WeekRange[]): string {
  return `{${ranges.map(([s, e]) => `[${s},${e})`).join(",")}}`;
}

export function parseMultirange(value: string): WeekRange[] {
  return [...value.matchAll(/\[(\d+),(\d+)\)/g)].map((m) => [Number(m[1]), Number(m[2])]);
}

/** Minutes covered by the slots, the most a declared rhythm can reach. */
export function availabilityTotals(slots: AvailabilitySlot[]): { minutes: number; days: number } {
  return {
    minutes: slotsToRanges(slots).reduce((sum, [s, e]) => sum + e - s, 0),
    days: new Set(slots.map((s) => s.day)).size,
  };
}

/** UTC column of the availability, recomputed on every write and renewal (DST). */
export function deriveAvailability(slots: AvailabilitySlot[], timezone: string, at?: Date) {
  return { availabilityUtc: toMultirange(slotsToUtc(slots, timezone, at)) };
}

export function isValidTimezone(value: string): boolean {
  if (!value || value.length > 64) return false;
  try {
    new Intl.DateTimeFormat("en", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

/** True when two sets of week ranges share at least one minute. */
export function rangesOverlap(a: readonly WeekRange[], b: readonly WeekRange[]): boolean {
  return a.some(([s1, e1]) => b.some(([s2, e2]) => s1 < e2 && s2 < e1));
}
