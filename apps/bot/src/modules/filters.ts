/**
 * GC-Scouting - filters
 *
 * Turns a posts page link into validated feed filters.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

import {
  AGE_GROUPS,
  AGENT_ROLES,
  COMPENSATIONS,
  LAN_OPTIONS,
  EXPERIENCE_MONTHS,
  IGL_ROLES,
  LANGUAGES,
  POST_TYPES,
  RANK_KEYS,
  REGIONS,
  ROSTER_SPOTS,
  STAFF_ROLES,
  TOURNAMENT_LEVELS,
  VALORANT_AGENTS,
  filtersFromParams,
  filtersToParams,
  postFiltersSchema,
  type PostFilters,
  type PostType,
} from "@scouting/db";
import { label, t, type LabelGroup, type Locale } from "../core/i18n";
import { agentName, duration, languageName, postCode, rankRange } from "./format";

export const LINK_MAX = 2000;

export type FilterLinkError = "invalidUrl" | "wrongSite" | "notPostsPage" | "invalidFilters";

export type FilterLinkResult =
  | { ok: true; filters: PostFilters; ignored: string[] }
  | { ok: false; error: FilterLinkError };

/**
 * Filters of a link copied from the posts page (`/{locale}/posts/{type}?regions=eu...`), same format as the site.
 * Query params the site would drop are reported in `ignored`.
 */
export function filtersFromLink(link: string, appUrl: string): FilterLinkResult {
  if (link.length > LINK_MAX) return { ok: false, error: "invalidUrl" };
  let url: URL;
  try {
    url = new URL(link);
  } catch {
    return { ok: false, error: "invalidUrl" };
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return { ok: false, error: "invalidUrl" };
  if (url.host !== new URL(appUrl).host) return { ok: false, error: "wrongSite" };

  const segments = url.pathname.split("/").filter(Boolean);
  const index = segments.indexOf("posts");
  const type = segments[index + 1];
  if (index < 0 || index > 1 || segments.length > index + 2 || (type !== undefined && !(POST_TYPES as readonly string[]).includes(type))) {
    return { ok: false, error: "notPostsPage" };
  }

  const { filters, sort } = filtersFromParams(url.searchParams);
  if (type) filters.types = [type as PostType];

  const parsed = postFiltersSchema.safeParse(filters);
  if (!parsed.success) return { ok: false, error: "invalidFilters" };

  const kept = filtersToParams(parsed.data, sort);
  const ignored = [...new Set(url.searchParams.keys())].filter((key) => key !== "sort" && !kept.has(key));
  return { ok: true, filters: parsed.data, ignored };
}

/** Posts page of the site showing the same filters. */
export function filtersLink(appUrl: string, locale: Locale, filters: PostFilters): string {
  const { types, ...rest } = filters;
  const single = types?.length === 1 ? types[0] : undefined;
  const params = filtersToParams(single ? rest : filters, "recent").toString();
  return `${appUrl.replace(/\/$/, "")}/${locale}/posts${single ? `/${single}` : ""}${params ? `?${params}` : ""}`;
}

/** One line per active filter, for the channel confirmation and `/feed list`. */
export function describeFilters(locale: Locale, filters: PostFilters): string[] {
  const line = (key: string, values: string[] | string | null | undefined) => {
    const value = Array.isArray(values) ? values.join(", ") : values;
    return value ? `**${t(locale, `filters.${key}`)}** ${value}` : null;
  };
  const labels = (group: LabelGroup, values: readonly string[] | undefined) => values?.map((v) => label(locale, group, v));

  let experience: string | null = null;
  if (filters.levels?.length || filters.minMonths) {
    const levels = labels("levels", filters.levels)?.join(", ") || t(locale, "filters.anyLevel");
    experience = filters.minMonths ? t(locale, "filters.experienceValue", { levels, duration: duration(locale, filters.minMonths) }) : levels;
  }
  const slot = filters.week ?? filters.slot;

  const lines = [
    line("types", filters.types?.map(postCode)),
    line("regions", labels("regions", filters.regions)),
    line("languages", filters.languages?.map((code) => languageName(locale, code))),
    line("spots", labels("rosterSpots", filters.spots)),
    line("roles", labels("roles", filters.roles)),
    line("igl", labels("igl", filters.igl)),
    line("staffRoles", labels("staffRoles", filters.staffRoles)),
    line("compensation", labels("compensation", filters.compensation)),
    line("lan", labels("lan", filters.lan)),
    line("ages", labels("ageGroups", filters.ages)),
    line("rank", filters.rankMin !== undefined || filters.rankMax !== undefined ? rankRange(locale, filters.rankMin ?? null, filters.rankMax ?? null) : null),
    line("agents", filters.agents?.map(agentName)),
    line("experience", experience),
    line("minHours", filters.minHours ? t(locale, "filters.minHoursValue", { hours: filters.minHours }) : null),
    line("minDays", filters.minDays ? t(locale, "filters.minDaysValue", { count: filters.minDays }) : null),
    line("availability", slot ? t(locale, "filters.availabilityValue", { timezone: slot.timezone }) : null),
  ].filter((l): l is string => l !== null);

  return lines.length ? lines : [t(locale, "filters.none")];
}

type DraftField = { bits: number; get(filters: PostFilters): bigint; set(filters: Record<string, unknown>, code: bigint): void };

type ListKey = "types" | "regions" | "languages" | "roles" | "igl" | "spots" | "staffRoles" | "compensation" | "lan" | "ages" | "levels" | "agents";

/** One bit per value. */
const listField = (key: ListKey, values: readonly string[]): DraftField => ({
  bits: values.length,
  get: (filters) => values.reduce((code, value, i) => ((filters[key] as string[] | undefined)?.includes(value) ? code | (1n << BigInt(i)) : code), 0n),
  set: (filters, code) => {
    const picked = values.filter((_, i) => (code >> BigInt(i)) & 1n);
    if (picked.length) filters[key] = picked;
  },
});

/** Index + 1 of the value, 0 when unset. */
const choiceField = (key: "rankMin" | "rankMax" | "minMonths" | "minHours" | "minDays", values: readonly number[]): DraftField => ({
  bits: values.length.toString(2).length,
  get: (filters) => BigInt(filters[key] === undefined ? 0 : values.indexOf(filters[key]) + 1),
  set: (filters, code) => {
    const value = values[Number(code) - 1];
    if (value !== undefined) filters[key] = value;
  },
});

// New fields go first: they take the highest bits, so codes made before them still decode.
const DRAFT_FIELDS: DraftField[] = [
  choiceField("minDays", [1, 2, 3, 4, 5, 6, 7]),
  listField("types", POST_TYPES),
  listField("regions", REGIONS),
  listField("languages", LANGUAGES),
  listField("roles", AGENT_ROLES),
  listField("igl", IGL_ROLES),
  listField("spots", ROSTER_SPOTS),
  listField("staffRoles", STAFF_ROLES),
  listField("compensation", COMPENSATIONS),
  listField("ages", AGE_GROUPS),
  listField("levels", TOURNAMENT_LEVELS),
  listField("agents", VALORANT_AGENTS.map((a) => a.slug)),
  choiceField("rankMin", RANK_KEYS.map((_, i) => i)),
  choiceField("rankMax", RANK_KEYS.map((_, i) => i)),
  choiceField("minMonths", EXPERIENCE_MONTHS),
  choiceField("minHours", Array.from({ length: 168 }, (_, i) => i + 1)),
  listField("lan", LAN_OPTIONS),
];

const BASE36 = "0123456789abcdefghijklmnopqrstuvwxyz";

/**
 * Filters packed in a short base 36 string, small enough for a Discord custom id (100 characters).
 * Availability (`slot`, `week`) is not part of it.
 */
export function encodeFilterDraft(filters: PostFilters): string {
  let code = 0n;
  for (const field of DRAFT_FIELDS) code = (code << BigInt(field.bits)) | field.get(filters);
  return code.toString(36);
}

/** Filters of `encodeFilterDraft`, null when the string is malformed. */
export function decodeFilterDraft(value: string): PostFilters | null {
  if (!/^[0-9a-z]{1,40}$/.test(value)) return null;
  let code = 0n;
  for (const char of value) code = code * 36n + BigInt(BASE36.indexOf(char));

  const filters: Record<string, unknown> = {};
  for (const field of [...DRAFT_FIELDS].reverse()) {
    field.set(filters, code & ((1n << BigInt(field.bits)) - 1n));
    code >>= BigInt(field.bits);
  }
  if (code !== 0n) return null;
  const parsed = postFiltersSchema.safeParse(filters);
  return parsed.success ? parsed.data : null;
}
