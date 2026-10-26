/**
 * GC-Scouting - post-form
 *
 * Server side validation of the post form, with field level errors.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

import {
  AGE_GROUPS,
  AGENT_ROLES,
  AVAILABILITY_STEP_MINUTES,
  COMPENSATIONS,
  EXPERIENCE_MONTHS,
  IGL_ROLES,
  LANGUAGES,
  LAN_OPTIONS,
  PLAYERS_WANTED_MAX,
  RANK_KEYS,
  REGIONS,
  RHYTHM_HOURS_MAX,
  ROSTER_SPOTS,
  STAFF_ROLES,
  SUBS_WANTED_MAX,
  TIER_COUNT,
  TOURNAMENT_LEVELS,
  TWEET_BY,
  VALORANT_AGENTS,
  type AgeGroup,
  type AgentRole,
  type Compensation,
  type Language,
  type LanOption,
  type PostType,
  type Region,
  type RosterSpot,
  type TweetBy,
} from "@scouting/db/constants";
import { availabilityTotals, isValidTimezone, type AvailabilitySlot, type Experience, type TierList } from "@scouting/db/derived";
import { isCountryCode } from "./countries";
import { gcsTeamUrl, parseGcsTeamUrl } from "./gcs";
import type { PostContact } from "@scouting/db";
import type { PostView } from "./posts";
import { cleanText } from "@scouting/db/text-input";
import { TRACKER_URL_MAX, parseTrackerUrl, trackerUrl } from "@scouting/db/tracker";
import { DISCORD_INVITE_MAX, discordInviteUrl, isDiscordId, parseDiscordInvite } from "./discord-contact";

// Post form: which fields each type shows, and the validation run by the server action.

export const DISPLAY_NAME_MAX = 32;
export const DESCRIPTION_MAX = 1500;
export const LANGUAGES_MAX = 5;
/** Most separate slots a painted day can hold (every other half hour). */
export const SLOTS_PER_DAY_MAX = 1440 / AVAILABILITY_STEP_MINUTES / 2;
export const GCS_TEAM_URL_MAX = 200;
export const EMAIL_MAX = 254;
export const AGENT_NAME_MAX = 64;
export const AGENCY_MAX = 64;

export type FormSection =
  | "teamLink"
  | "spot"
  | "wanted"
  | "age"
  | "minors"
  | "roles"
  | "staffRoles"
  | "compensation"
  | "lan"
  | "rank"
  | "tracker"
  | "rankRange"
  | "experience"
  | "tierList"
  | "availability";

/** Sections of the form for each type, in display order. The rhythm goes with the availability. */
export const FORM_SECTIONS: Record<PostType, readonly FormSection[]> = {
  lft: ["spot", "age", "roles", "rank", "tracker", "compensation", "lan", "experience", "tierList", "availability"],
  lfp: ["teamLink", "wanted", "minors", "roles", "rankRange", "compensation", "lan", "experience", "availability"],
  lfs: ["staffRoles", "minors", "compensation", "lan", "experience", "availability"],
  lfo: ["teamLink", "compensation", "experience", "availability"],
  lfst: ["staffRoles", "minors", "compensation", "lan", "experience", "availability"],
};

/** Availability and rhythm are optional only for rosters looking for an organization. */
export const AVAILABILITY_REQUIRED: Record<PostType, boolean> = { lft: true, lfp: true, lfs: true, lfo: false, lfst: true };

/** Posts written by a team (the name is the team name). */
export const TEAM_TYPES: readonly PostType[] = ["lfp", "lfs", "lfo"];

/** Teams offering a spot: the deal and LAN describe the spot, not what the author wants. */
export const OFFER_TYPES: readonly PostType[] = ["lfp", "lfs"];

export type PostFormValues = {
  type: PostType;
  displayName: string;
  gcsTeamUrl: string;
  region: Region | "";
  country: string;
  languages: Language[];
  rosterSpot: RosterSpot;
  playersWanted: number | null;
  subsWanted: number | null;
  roles: AgentRole[];
  igl: (typeof IGL_ROLES)[number][];
  staffRoles: (typeof STAFF_ROLES)[number][];
  compensation: Compensation | "";
  lan: LanOption | "";
  /** LFT, not required. */
  ageGroup: AgeGroup | "";
  /** LFP, LFS and LFST. */
  minorsAccepted: boolean | null;
  rankCurrent: number | null;
  rankPeak: number | null;
  rankMin: number | null;
  rankMax: number | null;
  /** LFT, not required. */
  trackerUrl: string;
  experience: Experience;
  tierList: TierList;
  timezone: string;
  availability: AvailabilitySlot[];
  rhythmHours: number | null;
  rhythmDays: number | null;
  description: string;
  /** Discord user ID. */
  discord: string;
  /** LFP, LFS and LFO: invite link to the team's server. */
  discordInvite: string;
  twitter: string;
  email: string;
  /** Contact fields reach an agent instead of the author. */
  agent: boolean;
  agentName: string;
  agentAgency: string;
  notifyEmail: boolean;
  notifyDiscord: boolean;
  /** Visitors can message the author from the post. */
  chatEnabled: boolean;
  /** Who tweets the post, the author's tweet is then retweeted. */
  tweetBy: TweetBy;
};

export type PostField = Exclude<keyof PostFormValues, "type"> | "contact";

export type PostFieldError =
  | "required"
  | "invalid"
  | "tooLong"
  | "tooMany"
  | "peakBelowCurrent"
  | "rangeOrder"
  | "wantedEmpty"
  | "tierEmpty"
  | "slotInvalid"
  | "slotOverlap"
  | "rhythmAboveAvailability"
  | "contactRequired"
  | "discordInvalid"
  | "discordInviteInvalid"
  | "twitterInvalid"
  | "emailInvalid"
  | "gcsTeamInvalid"
  | "gcsTeamNoProfile"
  | "gcsTeamNotMember"
  | "gcsTeamCheckFailed"
  | "trackerInvalid"
  | "invalidCharacters";

export type PostFieldErrors = Partial<Record<PostField, PostFieldError>>;

/** Validated post, ready to be written. */
export type ValidPost = Omit<
  PostFormValues,
  "gcsTeamUrl" | "region" | "country" | "rosterSpot" | "playersWanted" | "subsWanted" | "compensation" | "lan" | "ageGroup" | "trackerUrl" | "rhythmHours" | "rhythmDays" | "discord" | "discordInvite" | "twitter" | "email" | "agent" | "agentName" | "agentAgency"
> & {
  gcsTeamId: number | null;
  region: Region;
  country: string | null;
  rosterSpot: RosterSpot | null;
  playersWanted: number | null;
  subsWanted: number | null;
  compensation: Compensation | null;
  lan: LanOption | null;
  ageGroup: AgeGroup | null;
  trackerRiotId: string | null;
  weeklyMinutes: number;
  activeDays: number;
  contact: PostContact;
};

const RANK_MAX_INDEX = RANK_KEYS.length - 1;
const AGENT_SLUGS = VALORANT_AGENTS.map((a) => a.slug);
const TWITTER_HANDLE = /^[A-Za-z0-9_]{1,15}$/;
/** Plain address only (checked lowercased): nothing that could add a subject or body to a `mailto:` link. */
const EMAIL = /^[a-z0-9._%+-]+@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/;

export function emptyPostForm(
  type: PostType,
  defaults: { displayName: string; region: Region | ""; timezone: string; discordId: string | null; notifyEmail: boolean; notifyDiscord: boolean }
): PostFormValues {
  return {
    type,
    displayName: TEAM_TYPES.includes(type) ? "" : defaults.displayName,
    gcsTeamUrl: "",
    region: defaults.region,
    country: "",
    languages: [],
    rosterSpot: "player",
    playersWanted: type === "lfp" ? 1 : null,
    subsWanted: type === "lfp" ? 0 : null,
    roles: [],
    igl: [],
    staffRoles: [],
    compensation: "",
    lan: "",
    ageGroup: "",
    minorsAccepted: null,
    rankCurrent: null,
    rankPeak: null,
    rankMin: null,
    rankMax: null,
    trackerUrl: "",
    experience: {},
    tierList: {},
    timezone: defaults.timezone,
    availability: [],
    rhythmHours: null,
    rhythmDays: null,
    description: "",
    discord: defaults.discordId ?? "",
    discordInvite: "",
    twitter: "",
    email: "",
    agent: false,
    agentName: "",
    agentAgency: "",
    notifyEmail: defaults.notifyEmail,
    notifyDiscord: defaults.notifyDiscord,
    chatEnabled: true,
    tweetBy: "site",
  };
}

/** Form values of an existing post, for editing. */
export function postToFormValues(post: PostView, locale: string, notify: { notifyEmail: boolean; notifyDiscord: boolean }): PostFormValues {
  return {
    type: post.type,
    displayName: post.displayName,
    gcsTeamUrl: post.gcsTeamId ? gcsTeamUrl(locale, post.gcsTeamId, post.displayName) : "",
    region: post.region,
    country: post.country ?? "",
    languages: post.languages.filter((l): l is Language => (LANGUAGES as readonly string[]).includes(l)),
    rosterSpot: post.rosterSpot ?? "player",
    playersWanted: post.playersWanted,
    subsWanted: post.subsWanted,
    roles: [...post.roles],
    igl: [...post.igl],
    staffRoles: [...post.staffRoles],
    compensation: post.compensation ?? "",
    lan: post.lan ?? "",
    ageGroup: post.ageGroup ?? "",
    minorsAccepted: post.minorsAccepted,
    rankCurrent: post.rankCurrent,
    rankPeak: post.rankPeak,
    rankMin: post.rankMin,
    rankMax: post.rankMax,
    trackerUrl: post.trackerRiotId ? trackerUrl(post.trackerRiotId) : "",
    experience: post.experience,
    tierList: post.tierList ?? {},
    timezone: post.timezone,
    availability: post.availability,
    rhythmHours: post.weeklyMinutes > 0 ? Math.round(post.weeklyMinutes / 60) : null,
    rhythmDays: post.activeDays > 0 ? post.activeDays : null,
    description: post.description,
    discord: post.contact.discord ?? "",
    discordInvite: post.contact.discordInvite ? discordInviteUrl(post.contact.discordInvite) : "",
    twitter: post.contact.twitter ?? "",
    email: post.contact.email ?? "",
    agent: !!post.contact.agent,
    agentName: post.contact.agent?.name ?? "",
    agentAgency: post.contact.agent?.agency ?? "",
    ...notify,
    chatEnabled: post.chatEnabled,
    tweetBy: post.tweetBy,
  };
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const isCount = (v: unknown, max: number): v is number => Number.isInteger(v) && (v as number) >= 0 && (v as number) <= max;
const isRank = (v: unknown): v is number => Number.isInteger(v) && (v as number) >= 0 && (v as number) <= RANK_MAX_INDEX;

/** Unique values of `raw` that belong to `allowed`, null when anything else is found. */
function pickList<T extends string>(raw: unknown, allowed: readonly T[]): T[] | null {
  if (raw === undefined) return [];
  if (!Array.isArray(raw) || raw.length > allowed.length) return null;
  if (!raw.every((v) => allowed.includes(v as T))) return null;
  return [...new Set(raw as T[])];
}

function checkSlots(raw: unknown): { slots: AvailabilitySlot[] } | { error: PostFieldError } {
  if (raw === undefined) return { slots: [] };
  if (!Array.isArray(raw) || raw.length > 7 * SLOTS_PER_DAY_MAX) return { error: "slotInvalid" };
  const slots: AvailabilitySlot[] = [];
  for (const s of raw) {
    if (!isObject(s)) return { error: "slotInvalid" };
    const { day, start, end } = s;
    const valid =
      Number.isInteger(day) && (day as number) >= 0 && (day as number) <= 6 &&
      Number.isInteger(start) && Number.isInteger(end) &&
      (start as number) >= 0 && (end as number) <= 1440 && (start as number) < (end as number) &&
      (start as number) % AVAILABILITY_STEP_MINUTES === 0 && (end as number) % AVAILABILITY_STEP_MINUTES === 0;
    if (!valid) return { error: "slotInvalid" };
    slots.push({ day: day as number, start: start as number, end: end as number });
  }
  slots.sort((a, b) => a.day - b.day || a.start - b.start);
  for (let i = 1; i < slots.length; i++) {
    const prev = slots[i - 1]!;
    if (slots[i]!.day === prev.day && slots[i]!.start < prev.end) return { error: "slotOverlap" };
  }
  for (let day = 0; day < 7; day++) {
    if (slots.filter((s) => s.day === day).length > SLOTS_PER_DAY_MAX) return { error: "tooMany" };
  }
  return { slots };
}

/** Checks every field of the form. Fields that do not apply to the type are reset. */
export function validatePostForm(raw: unknown): { ok: true; post: ValidPost } | { ok: false; type: PostType | null; fieldErrors: PostFieldErrors } {
  const input = isObject(raw) ? raw : {};
  const type = (["lft", "lfp", "lfs", "lfo", "lfst"] as const).find((t) => t === input.type) ?? null;
  const errors: PostFieldErrors = {};
  if (!type) return { ok: false, type, fieldErrors: { displayName: "invalid" } };
  const sections = FORM_SECTIONS[type];

  const { text: displayName, invalid: displayNameInvalid } = cleanText(input.displayName);
  if (!displayName) errors.displayName = "required";
  else if (displayNameInvalid) errors.displayName = "invalidCharacters";
  else if (displayName.length > DISPLAY_NAME_MAX) errors.displayName = "tooLong";

  let gcsTeamId: number | null = null;
  const gcsTeamUrl = str(input.gcsTeamUrl);
  if (sections.includes("teamLink") && gcsTeamUrl) {
    gcsTeamId = gcsTeamUrl.length <= GCS_TEAM_URL_MAX ? parseGcsTeamUrl(gcsTeamUrl) : null;
    if (gcsTeamId === null) errors.gcsTeamUrl = "gcsTeamInvalid";
  }

  const region = REGIONS.find((r) => r === input.region);
  if (!region) errors.region = input.region ? "invalid" : "required";

  const country = str(input.country).toUpperCase();
  if (country && !isCountryCode(country)) errors.country = "invalid";

  const languages = pickList(input.languages, LANGUAGES);
  if (!languages) errors.languages = "invalid";
  else if (languages.length === 0) errors.languages = "required";
  else if (languages.length > LANGUAGES_MAX) errors.languages = "tooMany";

  let rosterSpot: RosterSpot | null = null;
  if (sections.includes("spot")) {
    rosterSpot = ROSTER_SPOTS.find((s) => s === input.rosterSpot) ?? null;
    if (!rosterSpot) errors.rosterSpot = input.rosterSpot ? "invalid" : "required";
  }

  // LFP: number of players and subs looked for, the roster spot follows.
  let playersWanted: number | null = null;
  let subsWanted: number | null = null;
  if (sections.includes("wanted")) {
    if (input.playersWanted === null || input.playersWanted === undefined) errors.playersWanted = "required";
    else if (!isCount(input.playersWanted, PLAYERS_WANTED_MAX)) errors.playersWanted = "invalid";
    else playersWanted = input.playersWanted;
    if (input.subsWanted === null || input.subsWanted === undefined) errors.subsWanted = "required";
    else if (!isCount(input.subsWanted, SUBS_WANTED_MAX)) errors.subsWanted = "invalid";
    else subsWanted = input.subsWanted;
    if (playersWanted !== null && subsWanted !== null) {
      if (playersWanted + subsWanted === 0) errors.playersWanted = "wantedEmpty";
      rosterSpot = playersWanted > 0 ? "player" : "sub";
    }
  }

  let roles: AgentRole[] = [];
  let igl: ValidPost["igl"] = [];
  if (sections.includes("roles")) {
    const picked = pickList(input.roles, AGENT_ROLES);
    if (!picked) errors.roles = "invalid";
    else if (picked.length === 0) errors.roles = "required";
    else roles = picked;
    const shotcalling = pickList(input.igl, IGL_ROLES);
    if (!shotcalling) errors.igl = "invalid";
    else igl = shotcalling;
  }

  let staffRoles: ValidPost["staffRoles"] = [];
  if (sections.includes("staffRoles")) {
    const picked = pickList(input.staffRoles, STAFF_ROLES);
    if (!picked) errors.staffRoles = "invalid";
    else if (picked.length === 0) errors.staffRoles = "required";
    else staffRoles = picked;
  }

  let compensation: Compensation | null = null;
  if (sections.includes("compensation")) {
    compensation = COMPENSATIONS.find((c) => c === input.compensation) ?? null;
    if (!compensation) errors.compensation = input.compensation ? "invalid" : "required";
  }

  let lan: LanOption | null = null;
  if (sections.includes("lan")) {
    lan = LAN_OPTIONS.find((l) => l === input.lan) ?? null;
    if (!lan) errors.lan = input.lan ? "invalid" : "required";
  }

  let ageGroup: AgeGroup | null = null;
  if (sections.includes("age") && input.ageGroup !== "" && input.ageGroup != null) {
    ageGroup = AGE_GROUPS.find((a) => a === input.ageGroup) ?? null;
    if (!ageGroup) errors.ageGroup = "invalid";
  }

  let minorsAccepted: boolean | null = null;
  if (sections.includes("minors")) {
    if (typeof input.minorsAccepted === "boolean") minorsAccepted = input.minorsAccepted;
    else errors.minorsAccepted = input.minorsAccepted == null ? "required" : "invalid";
  }

  let rankCurrent: number | null = null;
  let rankPeak: number | null = null;
  if (sections.includes("rank")) {
    if (input.rankCurrent === null || input.rankCurrent === undefined) errors.rankCurrent = "required";
    else if (!isRank(input.rankCurrent)) errors.rankCurrent = "invalid";
    else rankCurrent = input.rankCurrent;
    if (input.rankPeak === null || input.rankPeak === undefined) errors.rankPeak = "required";
    else if (!isRank(input.rankPeak)) errors.rankPeak = "invalid";
    else rankPeak = input.rankPeak;
    if (rankCurrent !== null && rankPeak !== null && rankPeak < rankCurrent) errors.rankPeak = "peakBelowCurrent";
  }

  let trackerRiotId: string | null = null;
  const tracker = str(input.trackerUrl);
  if (sections.includes("tracker") && tracker) {
    trackerRiotId = tracker.length <= TRACKER_URL_MAX ? parseTrackerUrl(tracker) : null;
    if (trackerRiotId === null) errors.trackerUrl = "trackerInvalid";
  }

  let rankMin: number | null = null;
  let rankMax: number | null = null;
  if (sections.includes("rankRange")) {
    if (input.rankMin !== null && input.rankMin !== undefined) {
      if (isRank(input.rankMin)) rankMin = input.rankMin;
      else errors.rankMin = "invalid";
    }
    if (input.rankMax !== null && input.rankMax !== undefined) {
      if (isRank(input.rankMax)) rankMax = input.rankMax;
      else errors.rankMax = "invalid";
    }
    if (rankMin !== null && rankMax !== null && rankMin > rankMax) errors.rankMax = "rangeOrder";
  }

  let experience: Experience = {};
  if (sections.includes("experience")) {
    const rawExperience = input.experience ?? {};
    const entries = isObject(rawExperience) ? Object.entries(rawExperience) : [];
    const valid =
      isObject(rawExperience) &&
      entries.every(([level, months]) => (TOURNAMENT_LEVELS as readonly string[]).includes(level) && (EXPERIENCE_MONTHS as readonly unknown[]).includes(months));
    if (!valid) errors.experience = "invalid";
    else experience = Object.fromEntries(TOURNAMENT_LEVELS.flatMap((level) => (rawExperience[level] ? [[level, rawExperience[level]]] : [])));
  }

  let tierList: TierList = {};
  if (sections.includes("tierList")) {
    const rawTiers = input.tierList ?? {};
    const entries = isObject(rawTiers) ? Object.entries(rawTiers) : [];
    const valid = isObject(rawTiers) && entries.every(([slug, tier]) => AGENT_SLUGS.includes(slug) && Number.isInteger(tier) && (tier as number) >= 0 && (tier as number) < TIER_COUNT);
    if (!valid) errors.tierList = "invalid";
    else if (entries.length === 0) errors.tierList = "tierEmpty";
    else tierList = Object.fromEntries(entries) as TierList;
  }

  const timezone = str(input.timezone);
  let availability: AvailabilitySlot[] = [];
  if (sections.includes("availability")) {
    if (!isValidTimezone(timezone)) errors.timezone = timezone ? "invalid" : "required";
    const checked = checkSlots(input.availability);
    if ("error" in checked) errors.availability = checked.error;
    else if (checked.slots.length === 0 && AVAILABILITY_REQUIRED[type]) errors.availability = "required";
    else availability = checked.slots;
  }

  // Rhythm: the most time given to the team, within the availability.
  let weeklyMinutes = 0;
  let activeDays = 0;
  if (sections.includes("availability")) {
    const total = availabilityTotals(availability);
    const optional = !AVAILABILITY_REQUIRED[type] && availability.length === 0;
    const { rhythmHours: hours, rhythmDays: days } = input;
    if (hours === null || hours === undefined) {
      if (!optional) errors.rhythmHours = "required";
    } else if (!Number.isInteger(hours) || (hours as number) < 1 || (hours as number) > RHYTHM_HOURS_MAX) errors.rhythmHours = "invalid";
    else if ((hours as number) * 60 > total.minutes) errors.rhythmHours = "rhythmAboveAvailability";
    else weeklyMinutes = (hours as number) * 60;
    if (days === null || days === undefined) {
      if (!optional) errors.rhythmDays = "required";
    } else if (!Number.isInteger(days) || (days as number) < 1 || (days as number) > 7) errors.rhythmDays = "invalid";
    else if ((days as number) > total.days) errors.rhythmDays = "rhythmAboveAvailability";
    else activeDays = days as number;
    // Both or none.
    if (weeklyMinutes > 0 && activeDays === 0 && !errors.rhythmDays) errors.rhythmDays = "required";
    if (activeDays > 0 && weeklyMinutes === 0 && !errors.rhythmHours) errors.rhythmHours = "required";
  }

  const { text: description, invalid: descriptionInvalid } = cleanText(input.description, { multiline: true });
  if (descriptionInvalid) errors.description = "invalidCharacters";
  else if (description.length > DESCRIPTION_MAX) errors.description = "tooLong";

  const discord = str(input.discord);
  const twitter = str(input.twitter).replace(/^@/, "");
  if (discord && !isDiscordId(discord)) errors.discord = "discordInvalid";
  let discordInvite: string | null = null;
  const inviteUrl = str(input.discordInvite);
  if (TEAM_TYPES.includes(type) && inviteUrl) {
    discordInvite = inviteUrl.length <= DISCORD_INVITE_MAX ? parseDiscordInvite(inviteUrl) : null;
    if (discordInvite === null) errors.discordInvite = "discordInviteInvalid";
  }
  if (twitter && !TWITTER_HANDLE.test(twitter)) errors.twitter = "twitterInvalid";
  const email = str(input.email).toLowerCase();
  if (email && (email.length > EMAIL_MAX || !EMAIL.test(email))) errors.email = "emailInvalid";
  if (typeof input.chatEnabled !== "boolean") errors.chatEnabled = "invalid";
  // The chat is a way to be reached: other contacts are then optional.
  if (!discord && !discordInvite && !twitter && !email && input.chatEnabled !== true) errors.contact = "contactRequired";

  let agent: PostContact["agent"];
  if (typeof input.agent !== "boolean") errors.agent = "invalid";
  else if (input.agent) {
    const { text: name, invalid: nameInvalid } = cleanText(input.agentName);
    const { text: agency, invalid: agencyInvalid } = cleanText(input.agentAgency);
    if (!name) errors.agentName = "required";
    else if (nameInvalid) errors.agentName = "invalidCharacters";
    else if (name.length > AGENT_NAME_MAX) errors.agentName = "tooLong";
    if (agencyInvalid) errors.agentAgency = "invalidCharacters";
    else if (agency.length > AGENCY_MAX) errors.agentAgency = "tooLong";
    agent = { name, agency: agency || null };
  }

  if (typeof input.notifyEmail !== "boolean" || typeof input.notifyDiscord !== "boolean") errors.notifyEmail = "invalid";

  const tweetBy = TWEET_BY.find((v) => v === input.tweetBy);
  if (!tweetBy) errors.tweetBy = input.tweetBy ? "invalid" : "required";

  if (Object.keys(errors).length > 0) return { ok: false, type, fieldErrors: errors };

  return {
    ok: true,
    post: {
      type,
      displayName,
      gcsTeamId,
      region: region!,
      country: country || null,
      languages: languages!,
      rosterSpot,
      playersWanted,
      subsWanted,
      roles,
      igl,
      staffRoles,
      compensation,
      lan,
      ageGroup,
      minorsAccepted,
      rankCurrent,
      rankPeak,
      rankMin,
      rankMax,
      trackerRiotId,
      experience,
      tierList,
      // Kept for types without availability so the post still has a valid timezone.
      timezone: isValidTimezone(timezone) ? timezone : "UTC",
      availability,
      weeklyMinutes,
      activeDays,
      description,
      contact: { ...(discord && { discord }), ...(discordInvite && { discordInvite }), ...(twitter && { twitter }), ...(email && { email }), ...(agent && { agent }) },
      notifyEmail: input.notifyEmail as boolean,
      notifyDiscord: input.notifyDiscord as boolean,
      chatEnabled: input.chatEnabled as boolean,
      tweetBy: tweetBy!,
    },
  };
}
