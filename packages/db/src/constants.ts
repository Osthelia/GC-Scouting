/**
 * GC-Scouting - constants
 *
 * Value lists shared by the schema, the web app and the bot.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

// Value lists shared by the schema enums, the web app and the bot.

export const POST_TYPES = ["lft", "lfp", "lfs", "lfo", "lfst"] as const;
export type PostType = (typeof POST_TYPES)[number];

/** Fixed per type, independent from the site palette. Shared by the site and the bot. */
export const POST_TYPE_COLORS: Record<PostType, string> = {
  lft: "#4da3ff",
  lfp: "#3ddc84",
  lfs: "#b18cff",
  lfo: "#ffb547",
  lfst: "#ff7ab8",
};

/** Types limited to one active post per account. */
export const SINGLE_ACTIVE_POST_TYPES = ["lft", "lfst"] as const satisfies readonly PostType[];

/** Online posts an account can have at once for the other types. Each one is sent to every partner Discord server. */
export const ACTIVE_POSTS_MAX: Partial<Record<PostType, number>> = { lfp: 5, lfs: 5, lfo: 2 };

export const POST_STATUSES = ["active", "closed", "removed"] as const;

export const REGIONS = ["eu", "na", "latam", "br", "apac", "kr", "jp", "oce", "mena", "cn"] as const;
export type Region = (typeof REGIONS)[number];

// VCT region branding, same colors as GC Stats (Americas, EMEA, Pacific, China).
const AMERICAS = "#FF6B35";
const EMEA = "#C8E000";
const PACIFIC = "#00C8FF";
const CHINA = "#FF1744";

export const REGION_COLORS: Record<Region, string> = {
  eu: EMEA,
  mena: EMEA,
  na: AMERICAS,
  latam: AMERICAS,
  br: AMERICAS,
  apac: PACIFIC,
  kr: PACIFIC,
  jp: PACIFIC,
  oce: PACIFIC,
  cn: CHINA,
};

export const AGENT_ROLES = ["duelist", "initiator_reveal", "initiator_flash", "controller", "sentinel", "flex"] as const;
export type AgentRole = (typeof AGENT_ROLES)[number];

/** In game agent class (a post role is more precise, e.g. initiator is split in reveal and flash). */
export const AGENT_CLASSES = ["duelist", "initiator", "controller", "sentinel"] as const;
export type AgentClass = (typeof AGENT_CLASSES)[number];

// Miks' role is unconfirmed.
export const VALORANT_AGENTS: readonly { name: string; slug: string; role: AgentClass }[] = [
  { name: "Jett", slug: "jett", role: "duelist" },
  { name: "Phoenix", slug: "phoenix", role: "duelist" },
  { name: "Reyna", slug: "reyna", role: "duelist" },
  { name: "Raze", slug: "raze", role: "duelist" },
  { name: "Yoru", slug: "yoru", role: "duelist" },
  { name: "Neon", slug: "neon", role: "duelist" },
  { name: "Iso", slug: "iso", role: "duelist" },
  { name: "Waylay", slug: "waylay", role: "duelist" },
  { name: "Sova", slug: "sova", role: "initiator" },
  { name: "Breach", slug: "breach", role: "initiator" },
  { name: "Skye", slug: "skye", role: "initiator" },
  { name: "KAY/O", slug: "kayo", role: "initiator" },
  { name: "Fade", slug: "fade", role: "initiator" },
  { name: "Gekko", slug: "gekko", role: "initiator" },
  { name: "Tejo", slug: "tejo", role: "initiator" },
  { name: "Brimstone", slug: "brimstone", role: "controller" },
  { name: "Viper", slug: "viper", role: "controller" },
  { name: "Omen", slug: "omen", role: "controller" },
  { name: "Astra", slug: "astra", role: "controller" },
  { name: "Harbor", slug: "harbor", role: "controller" },
  { name: "Clove", slug: "clove", role: "controller" },
  { name: "Miks", slug: "miks", role: "controller" },
  { name: "Killjoy", slug: "killjoy", role: "sentinel" },
  { name: "Cypher", slug: "cypher", role: "sentinel" },
  { name: "Sage", slug: "sage", role: "sentinel" },
  { name: "Chamber", slug: "chamber", role: "sentinel" },
  { name: "Deadlock", slug: "deadlock", role: "sentinel" },
  { name: "Vyse", slug: "vyse", role: "sentinel" },
  { name: "Veto", slug: "veto", role: "sentinel" },
];

export const IGL_ROLES = ["igl", "co_igl"] as const;

/** Spot a LFT/LFP post is about: starter or substitute. */
export const ROSTER_SPOTS = ["player", "sub"] as const;
export type RosterSpot = (typeof ROSTER_SPOTS)[number];

/** Age declared on a LFT. LFP, LFS and LFST say instead whether they accept minors. */
export const AGE_GROUPS = ["minor", "adult"] as const;
export type AgeGroup = (typeof AGE_GROUPS)[number];

/** Who posts the tweet of a post: GC Scouting, or the author (GC Scouting then retweets it). */
export const TWEET_BY = ["site", "author"] as const;
export type TweetBy = (typeof TWEET_BY)[number];

/** Players and subs a LFP roster can look for at once. */
export const PLAYERS_WANTED_MAX = 5;
export const SUBS_WANTED_MAX = 5;

/** GC Stats roster roles, plus mental coach. */
export const STAFF_ROLES = ["coach", "assistant_coach", "performance_coach", "mental_coach", "analyst", "manager"] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

/** Paid or volunteer: what the author is looking for (LFT, LFST, LFO) or offers (LFP, LFS). */
export const COMPENSATIONS = ["paid", "free"] as const;
export type Compensation = (typeof COMPENSATIONS)[number];

/** Whether the author can travel to LAN events (LFT, LFST) or the team plans to (LFP, LFS). */
export const LAN_OPTIONS = ["lan", "online"] as const;
export type LanOption = (typeof LAN_OPTIONS)[number];

/** Ordered from lowest to highest. */
export const TOURNAMENT_LEVELS = ["cash_cup", "playoffs", "main_event"] as const;
export type TournamentLevel = (typeof TOURNAMENT_LEVELS)[number];

/** Durations offered for the experience at each tournament level, in months. */
export const EXPERIENCE_MONTHS = [3, 6, 9, 12, 24, 36, 48, 60, 84, 120] as const;

/** Declared rhythm bounds: hours per week and days per week given to the team. */
export const RHYTHM_HOURS_MAX = 60;

/** Weekly hours offered by the rhythm filter, 0 is no minimum. */
export const FILTER_HOUR_STEPS = [0, 5, 10, 15, 20] as const;

/** Days per week offered by the rhythm filter, 0 is no minimum. */
export const FILTER_DAY_STEPS = [0, 1, 2, 3, 4, 5, 6, 7] as const;

/** Agents a posts filter can require at once. */
export const FILTER_AGENTS_MAX = 5;

/** Ordered from lowest to highest. Every tier has 3 divisions except Radiant. */
export const RANK_TIERS = ["iron", "bronze", "silver", "gold", "platinum", "diamond", "ascendant", "immortal", "radiant"] as const;
export type RankTier = (typeof RANK_TIERS)[number];

type Division<T extends string> = T extends "radiant" ? T : `${T}_${1 | 2 | 3}`;
export type RankKey = Division<RankTier>;

/** Every rank with its division ("gold_2"), ranks are stored as their index. */
export const RANK_KEYS = RANK_TIERS.flatMap((tier) => (tier === "radiant" ? [tier] : [1, 2, 3].map((d) => `${tier}_${d}`))) as readonly RankKey[];

/** Roles of a GC Stats team membership, same keys as GC Stats. */
export const GCS_TEAM_ROLES = ["player", "player-igl", "sub", "coach", "assistant coach", "performance coach", "analyst", "manager"] as const;
export type GcsTeamRole = (typeof GCS_TEAM_ROLES)[number];

/** Pronouns of a GC Stats player, indexed by their GC Stats id (0, 1, 2). */
export const GCS_PRONOUNS = ["feminine", "masculine", "inclusive"] as const;
export type GcsPronoun = (typeof GCS_PRONOUNS)[number];

/** Entries kept in the GC Stats snapshot of a post. */
export const GCS_SUMMARY_LIMIT = 5;

export const TIER_COUNT = 3;
/** Tiers 0 and 1 count as "can play" for the agent filter. */
export const STRONG_TIER_MAX = 1;

export const POST_LIFETIME_DAYS = 10;
export const EXPIRY_NOTICE_DAY = 7;

/** Availability slots are stored in minutes, snapped to this step. */
export const AVAILABILITY_STEP_MINUTES = 30;
export const MINUTES_PER_WEEK = 7 * 24 * 60;

export const PLAYER_LINK_STATUSES = ["pending", "approved", "rejected", "withdrawn"] as const;

export const ACTION_TOKEN_ACTIONS = ["renew", "delete"] as const;

export const DISCORD_CHANNEL_KINDS = ["feed", "moderation"] as const;

export const MODERATION_ACTIONS = ["remove", "restore", "tweeted", "edit"] as const;

export const REPORT_REASONS = ["spam", "fake", "inappropriate", "harassment", "other"] as const;
export const REPORT_STATUSES = ["open", "handled", "dismissed"] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];
/** Report details: free text, required (at least the minimum) when the reason is "other". */
export const REPORT_MESSAGE_MIN = 10;
export const REPORT_MESSAGE_MAX = 1000;

/** Site roles. Staff moderates everything, admin also manages the roles. */
export const USER_ROLES = ["user", "staff", "admin"] as const;
export type UserRole = (typeof USER_ROLES)[number];

/** GC Stats sanction types. Mute, suspension and ban block messages and posts, a warning is shown in the chat. */
export const GCS_SANCTION_TYPES = ["note", "warning", "mute", "suspension", "ban"] as const;
export type GcsSanctionType = (typeof GCS_SANCTION_TYPES)[number];
export const BLOCKING_SANCTIONS: readonly GcsSanctionType[] = ["mute", "suspension", "ban"];

/** `blocked`: held by the automod, only its sender and the staff see it. `hidden`: removed by the staff. */
export const MESSAGE_STATUSES = ["visible", "blocked", "hidden"] as const;
export type MessageStatus = (typeof MESSAGE_STATUSES)[number];
export const CHAT_MESSAGE_MAX = 2000;

/** GC Stats accounts younger than this are flagged in the chat. */
export const RECENT_ACCOUNT_DAYS = 7;

/** ISO 639-1 codes offered in the post form and filters. */
export const LANGUAGES = ["en", "fr", "es", "pt", "de", "it", "nl", "pl", "tr", "ru", "uk", "ar", "sv", "da", "no", "fi", "cs", "ro", "hu", "el", "ja", "ko", "zh", "vi", "th", "id", "tl"] as const;
export type Language = (typeof LANGUAGES)[number];

/** Country whose flag stands for each language (ISO 3166 alpha 2, lowercase for flag-icons). */
export const LANGUAGE_FLAG: Record<Language, string> = {
  en: "gb",
  fr: "fr",
  es: "es",
  pt: "pt",
  de: "de",
  it: "it",
  nl: "nl",
  pl: "pl",
  tr: "tr",
  ru: "ru",
  uk: "ua",
  ar: "sa",
  sv: "se",
  da: "dk",
  no: "no",
  fi: "fi",
  cs: "cz",
  ro: "ro",
  hu: "hu",
  el: "gr",
  ja: "jp",
  ko: "kr",
  zh: "cn",
  vi: "vn",
  th: "th",
  id: "id",
  tl: "ph",
};

export function languageFlag(code: string): string | null {
  return LANGUAGE_FLAG[code as Language] ?? null;
}

export const POST_SORTS = ["recent", "rank", "experience", "availability"] as const;
export type PostSort = (typeof POST_SORTS)[number];
