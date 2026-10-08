/**
 * GC-Scouting - filters
 *
 * Post filters: parsing, validation and the database conditions.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

import * as z from "zod/mini";
import {
  AGE_GROUPS,
  AGENT_ROLES,
  COMPENSATIONS,
  EXPERIENCE_MONTHS,
  FILTER_AGENTS_MAX,
  IGL_ROLES,
  LANGUAGES,
  LAN_OPTIONS,
  POST_SORTS,
  POST_TYPES,
  RANK_KEYS,
  REGIONS,
  ROSTER_SPOTS,
  STAFF_ROLES,
  TOURNAMENT_LEVELS,
  AVAILABILITY_STEP_MINUTES,
  type AgeGroup,
  type Compensation,
  type LanOption,
  type PostSort,
  type RosterSpot,
} from "./constants";
import { formatTime, isValidTimezone, rangesOverlap, shiftRanges, timezoneOffset, type Experience, type WeekRange } from "./derived";

// One filter format for the /posts page (URL + localStorage) and the Discord channel configs.

const RANK_MAX_INDEX = RANK_KEYS.length - 1;
const AGENT_SLUG = /^[a-z0-9]{2,20}$/;

const list = <T extends string>(values: readonly [T, ...T[]]) => z.array(z.enum(values)).check(z.maxLength(values.length));
const intBetween = (min: number, max: number) => z.int().check(z.minimum(min), z.maximum(max));

const DAY = 1440;
const STEP = AVAILABILITY_STEP_MINUTES;
const minuteFrom = () => intBetween(0, DAY - STEP).check(z.multipleOf(STEP));
const minuteTo = () => intBetween(STEP, DAY).check(z.multipleOf(STEP));
const timezone = () => z.string().check(z.refine(isValidTimezone));

/** Hours searched on some days (every day when `days` is empty), in `timezone`. `to <= from` runs past midnight. */
const slotSchema = z
  .object({
    days: z.array(intBetween(0, 6)).check(z.maxLength(7)),
    from: minuteFrom(),
    to: minuteTo(),
    timezone: timezone(),
  })
  .check(z.refine((s) => s.from !== s.to, { path: ["to"], message: "to must differ from from" }));

export type SlotFilter = z.infer<typeof slotSchema>;

/** Advanced availability search: one range per day, in `timezone`. `to <= from` runs past midnight. */
const weekSchema = z.object({
  days: z
    .array(
      z
        .object({ day: intBetween(0, 6), from: minuteFrom(), to: minuteTo() })
        .check(z.refine((d) => d.from !== d.to, { path: ["to"], message: "to must differ from from" })),
    )
    .check(
      z.minLength(1),
      z.maxLength(7),
      z.refine((days) => new Set(days.map((d) => d.day)).size === days.length, { message: "one range per day" }),
    ),
  timezone: timezone(),
});

export type WeekFilter = z.infer<typeof weekSchema>;

// zod/mini: the same validation as classic zod, a fraction of its size in the /posts client bundle.
export const postFiltersSchema = z
  .object({
    types: z.optional(list(POST_TYPES)),
    regions: z.optional(list(REGIONS)),
    languages: z.optional(list(LANGUAGES)),
    roles: z.optional(list(AGENT_ROLES)),
    staffRoles: z.optional(list(STAFF_ROLES)),
    levels: z.optional(list(TOURNAMENT_LEVELS)),
    compensation: z.optional(list(COMPENSATIONS)),
    lan: z.optional(list(LAN_OPTIONS)),
    ages: z.optional(list(AGE_GROUPS)),
    agents: z.optional(z.array(z.string().check(z.regex(AGENT_SLUG))).check(z.maxLength(FILTER_AGENTS_MAX))),
    igl: z.optional(list(IGL_ROLES)),
    spots: z.optional(list(ROSTER_SPOTS)),
    rankMin: z.optional(intBetween(0, RANK_MAX_INDEX)),
    rankMax: z.optional(intBetween(0, RANK_MAX_INDEX)),
    minMonths: z.optional(z.int().check(z.refine((m) => (EXPERIENCE_MONTHS as readonly number[]).includes(m)))),
    minHours: z.optional(intBetween(0, 168)),
    minDays: z.optional(intBetween(1, 7)),
    slot: z.optional(slotSchema),
    week: z.optional(weekSchema),
  })
  .check(
    z.refine((f) => f.rankMin === undefined || f.rankMax === undefined || f.rankMin <= f.rankMax, {
      path: ["rankMax"],
      message: "rankMax must be greater than or equal to rankMin",
    }),
  );

export type PostFilters = z.infer<typeof postFiltersSchema>;

/** Fields a post needs to be matched against filters, on the site and by the bot. */
export type MatchablePost = {
  type: (typeof POST_TYPES)[number];
  displayName: string;
  region: (typeof REGIONS)[number];
  languages: readonly string[];
  roles: readonly (typeof AGENT_ROLES)[number][];
  igl: readonly (typeof IGL_ROLES)[number][];
  rosterSpot: RosterSpot | null;
  playersWanted: number | null;
  subsWanted: number | null;
  staffRoles: readonly (typeof STAFF_ROLES)[number][];
  compensation: Compensation | null;
  lan: LanOption | null;
  ageGroup: AgeGroup | null;
  minorsAccepted: boolean | null;
  rankCurrent: number | null;
  rankMin: number | null;
  rankMax: number | null;
  experience: Experience;
  tournamentLevels: readonly (typeof TOURNAMENT_LEVELS)[number][];
  strongAgents: readonly string[];
  /** Declared rhythm. */
  weeklyMinutes: number;
  activeDays: number;
  /** Availability as UTC minutes of the week. */
  availabilityUtc: readonly WeekRange[];
};

const overlaps = (a: readonly string[], b: readonly string[]) => a.some((v) => b.includes(v));

/** Spots a post is about, a LFP can look for players and subs at once. */
export function postSpots(post: Pick<MatchablePost, "rosterSpot" | "playersWanted" | "subsWanted">): RosterSpot[] {
  if (post.playersWanted !== null && post.subsWanted !== null) {
    return [...(post.playersWanted > 0 ? (["player"] as const) : []), ...(post.subsWanted > 0 ? (["sub"] as const) : [])];
  }
  return post.rosterSpot ? [post.rosterSpot] : [];
}

/** Rank span of a post: its current rank, or the range a team is looking for. */
function rankSpan(post: MatchablePost): [number, number] | null {
  if (post.rankCurrent !== null) return [post.rankCurrent, post.rankCurrent];
  if (post.rankMin !== null || post.rankMax !== null) return [post.rankMin ?? 0, post.rankMax ?? RANK_MAX_INDEX];
  return null;
}

const slotCache = new WeakMap<SlotFilter | WeekFilter, WeekRange[]>();

const dayRange = (day: number, from: number, to: number): WeekRange => [day * DAY + from, day * DAY + (to > from ? to : to + DAY)];

/** Searched hours (simple or per day) as UTC minutes of the week, with the current offset of their timezone. */
export function slotRanges(slot: SlotFilter | WeekFilter): WeekRange[] {
  const cached = slotCache.get(slot);
  if (cached) return cached;
  const local =
    "from" in slot
      ? (slot.days.length ? slot.days : [0, 1, 2, 3, 4, 5, 6]).map((d) => dayRange(d, slot.from, slot.to))
      : slot.days.map((d) => dayRange(d.day, d.from, d.to));
  const ranges = shiftRanges(local, -timezoneOffset(slot.timezone));
  slotCache.set(slot, ranges);
  return ranges;
}

/** True when the post has `minMonths` or more at one of `levels` (any level when empty). */
function hasExperience(experience: Experience, levels: readonly (typeof TOURNAMENT_LEVELS)[number][], minMonths: number): boolean {
  return (levels.length ? levels : TOURNAMENT_LEVELS).some((level) => (experience[level] ?? 0) >= minMonths);
}

/** Highest level reached first, then the months played at that level. */
function experienceScore(experience: Experience): number {
  for (let i = TOURNAMENT_LEVELS.length - 1; i >= 0; i--) {
    const months = experience[TOURNAMENT_LEVELS[i]!] ?? 0;
    if (months > 0) return (i + 1) * 1000 + months;
  }
  return 0;
}

export function matchesFilters(post: MatchablePost, f: PostFilters): boolean {
  if (f.types?.length && !f.types.includes(post.type)) return false;
  if (f.regions?.length && !f.regions.includes(post.region)) return false;
  if (f.languages?.length && !overlaps(f.languages, post.languages)) return false;
  // A flex player fits any role.
  if (f.roles?.length && !post.roles.includes("flex") && !overlaps(f.roles, post.roles)) return false;
  if (f.staffRoles?.length && !overlaps(f.staffRoles, post.staffRoles)) return false;
  if (f.compensation?.length && (!post.compensation || !f.compensation.includes(post.compensation))) return false;
  if (f.lan?.length && (!post.lan || !f.lan.includes(post.lan))) return false;
  // A LFT matches on its declared age, other posts on whether they accept minors (adults always are).
  if (f.ages?.length) {
    if (post.type === "lft" ? !post.ageGroup || !f.ages.includes(post.ageGroup) : !f.ages.includes("adult") && post.minorsAccepted !== true) return false;
  }
  // "1 year of Main event": the duration applies to the picked levels.
  if ((f.levels?.length || f.minMonths) && !hasExperience(post.experience, f.levels ?? [], f.minMonths ?? 1)) return false;
  if (f.agents?.length && !f.agents.every((a) => post.strongAgents.includes(a))) return false;
  if (f.igl?.length && !overlaps(f.igl, post.igl)) return false;
  if (f.spots?.length && !overlaps(f.spots, postSpots(post))) return false;
  // Partial overlap is enough: one common half hour matches.
  const slot = f.week ?? f.slot;
  if (slot && !rangesOverlap(post.availabilityUtc, slotRanges(slot))) return false;
  if (f.minHours && post.weeklyMinutes < f.minHours * 60) return false;
  if (f.minDays && post.activeDays < f.minDays) return false;

  if (f.rankMin !== undefined || f.rankMax !== undefined) {
    const span = rankSpan(post);
    if (!span) return false;
    if (span[1] < (f.rankMin ?? 0) || span[0] > (f.rankMax ?? RANK_MAX_INDEX)) return false;
  }
  return true;
}

export function comparePosts<T extends MatchablePost & { bumpedAt: Date | string }>(sort: PostSort): (a: T, b: T) => number {
  const recent = (a: T, b: T) => new Date(b.bumpedAt).getTime() - new Date(a.bumpedAt).getTime();
  const best = (p: T) => rankSpan(p)?.[1] ?? -1;
  switch (sort) {
    case "rank":
      return (a, b) => best(b) - best(a) || recent(a, b);
    case "experience":
      return (a, b) => experienceScore(b.experience) - experienceScore(a.experience) || recent(a, b);
    case "availability":
      return (a, b) => b.weeklyMinutes - a.weeklyMinutes || recent(a, b);
    default:
      return recent;
  }
}

// URL format: comma separated lists, rank keys instead of indexes, slot as `days=mon,fri&from=18:00&to=23:00&tz=Europe/Paris`,
// per day slot as `week=mon.18:00-23:00,fri.20:00-02:00&tz=Europe/Paris`.

const LIST_KEYS = ["types", "regions", "languages", "roles", "igl", "spots", "staffRoles", "levels", "compensation", "lan", "ages", "agents"] as const;
const NUMBER_KEYS = ["minMonths", "minHours", "minDays"] as const;
const SLOT_KEYS = ["days", "from", "to", "week", "tz"] as const;
const DAY_CODES = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;

/** Every query param this format uses, sort included. */
export const FILTER_PARAM_KEYS = [...LIST_KEYS, ...NUMBER_KEYS, ...SLOT_KEYS, "rankMin", "rankMax", "sort"] as const;

/** "18:30" to 1110, null when malformed. "24:00" is the end of the day. */
function parseTime(value: string | null): number | null {
  const match = value?.match(/^(\d{2}):(\d{2})$/);
  if (!match) return null;
  const minutes = Number(match[1]) * 60 + Number(match[2]);
  return minutes <= DAY ? minutes : null;
}

function slotFromParams(params: ParamSource): SlotFilter | undefined {
  if (!SLOT_KEYS.some((key) => params.get(key))) return undefined;
  const days = [...new Set((params.get("days") ?? "").split(","))].map((d) => DAY_CODES.indexOf(d as (typeof DAY_CODES)[number])).filter((d) => d >= 0);
  const slot = { days: days.sort((a, b) => a - b), from: parseTime(params.get("from")) ?? 0, to: parseTime(params.get("to")) ?? DAY, timezone: params.get("tz") ?? "UTC" };
  if (slot.days.length === 0 && slot.from === 0 && slot.to === DAY) return undefined;
  return slotSchema.safeParse(slot).success ? slot : undefined;
}

function weekFromParams(params: ParamSource): WeekFilter | undefined {
  const value = params.get("week");
  if (!value) return undefined;
  const days = value.split(",").flatMap((part) => {
    const match = part.match(/^([a-z]{3})\.(\d{2}:\d{2})-(\d{2}:\d{2})$/);
    const day = DAY_CODES.indexOf(match?.[1] as (typeof DAY_CODES)[number]);
    const from = parseTime(match?.[2] ?? null);
    const to = parseTime(match?.[3] ?? null);
    return day >= 0 && from !== null && to !== null ? [{ day, from, to }] : [];
  });
  const week = { days: days.sort((a, b) => a.day - b.day), timezone: params.get("tz") ?? "UTC" };
  return weekSchema.safeParse(week).success ? week : undefined;
}

type ParamSource = { get(key: string): string | null };

/** Lenient parse for shared links and stored filters: invalid values are dropped, never thrown. */
export function filtersFromParams(params: ParamSource): { filters: PostFilters; sort: PostSort } {
  const raw: Record<string, unknown> = {};
  for (const key of LIST_KEYS) {
    const value = params.get(key);
    if (value) raw[key] = [...new Set(value.split(",").filter(Boolean))];
  }
  for (const key of NUMBER_KEYS) {
    const value = Number(params.get(key));
    if (Number.isInteger(value) && value > 0) raw[key] = value;
  }
  for (const key of ["rankMin", "rankMax"] as const) {
    const index = RANK_KEYS.indexOf(params.get(key) as (typeof RANK_KEYS)[number]);
    if (index >= 0) raw[key] = index;
  }

  const week = weekFromParams(params);
  const slot = week ? undefined : slotFromParams(params);
  if (week) raw.week = week;
  if (slot) raw.slot = slot;

  const shape = postFiltersSchema.shape;
  const filters: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(raw)) {
    const field = shape[key as keyof typeof shape];
    const cleaned = Array.isArray(value) ? value.filter((v) => field.safeParse([v]).success) : value;
    if (field.safeParse(cleaned).success && !(Array.isArray(cleaned) && cleaned.length === 0)) filters[key] = cleaned;
  }
  if (filters.rankMin !== undefined && filters.rankMax !== undefined && (filters.rankMin as number) > (filters.rankMax as number)) delete filters.rankMax;

  const sortParam = params.get("sort") as PostSort | null;
  return { filters: filters as PostFilters, sort: sortParam && POST_SORTS.includes(sortParam) ? sortParam : "recent" };
}

export function filtersToParams(filters: PostFilters, sort: PostSort): URLSearchParams {
  const params = new URLSearchParams();
  for (const key of LIST_KEYS) if (filters[key]?.length) params.set(key, filters[key]!.join(","));
  for (const key of NUMBER_KEYS) if (filters[key]) params.set(key, String(filters[key]));
  if (filters.rankMin !== undefined) params.set("rankMin", RANK_KEYS[filters.rankMin]!);
  if (filters.rankMax !== undefined) params.set("rankMax", RANK_KEYS[filters.rankMax]!);
  if (filters.slot) {
    const { days, from, to, timezone } = filters.slot;
    if (days.length) params.set("days", days.map((d) => DAY_CODES[d]).join(","));
    if (from !== 0) params.set("from", formatTime(from));
    if (to !== DAY) params.set("to", formatTime(to));
    params.set("tz", timezone);
  } else if (filters.week) {
    params.set("week", filters.week.days.map((d) => `${DAY_CODES[d.day]}.${formatTime(d.from)}-${formatTime(d.to)}`).join(","));
    params.set("tz", filters.week.timezone);
  }
  if (sort !== "recent") params.set("sort", sort);
  return params;
}

export function countActiveFilters(filters: PostFilters): number {
  let count = 0;
  for (const [key, value] of Object.entries(filters)) {
    if (key === "rankMax" && filters.rankMin !== undefined) continue;
    if (Array.isArray(value) ? value.length > 0 : value !== undefined) count++;
  }
  return count;
}
