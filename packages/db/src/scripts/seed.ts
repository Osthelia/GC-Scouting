/**
 * GC-Scouting - seed
 *
 * Fills the development database with sample data.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import {
  AGENT_CLASSES,
  EXPERIENCE_MONTHS,
  POST_LIFETIME_DAYS,
  RANK_KEYS,
  STAFF_ROLES,
  TOURNAMENT_LEVELS,
  VALORANT_AGENTS,
  type AgentClass,
  type AgentRole,
  type StaffRole,
  type Language,
  type PostType,
  type RankKey,
  type Region,
  GCS_PRONOUNS,
  GCS_SUMMARY_LIMIT,
  type GcsTeamRole,
} from "../constants";
import { availabilityTotals, deriveAvailability, experienceLevels, strongAgents, type AvailabilitySlot, type Experience, type TierList } from "../derived";
import * as schema from "../schema";
import type { GcsPlacement, GcsSummary, GcsTeamEntry, GcsTournamentEntry } from "../schema";
import { databaseUrl } from "./env";

// Fictional data for local development. Wipes every table first.

const url = new URL(databaseUrl());
if (!["localhost", "127.0.0.1"].includes(url.hostname) && !process.argv.includes("--force")) {
  throw new Error(`Refusing to seed ${url.hostname}, pass --force to seed a remote database`);
}

const pool = new Pool({ connectionString: url.toString() });
const db = drizzle(pool, { schema });

// Deterministic random, same data on every run.
let state = 20260929;
function random(): number {
  state = (state + 0x6d2b79f5) | 0;
  let t = Math.imul(state ^ (state >>> 15), 1 | state);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const int = (min: number, max: number) => min + Math.floor(random() * (max - min + 1));
const pick = <T>(list: readonly T[]): T => list[Math.floor(random() * list.length)]!;
const chance = (p: number) => random() < p;
function sample<T>(list: readonly T[], count: number): T[] {
  const copy = [...list];
  const out: T[] = [];
  while (out.length < count && copy.length) out.push(copy.splice(Math.floor(random() * copy.length), 1)[0]!);
  return out;
}

const rank = (key: RankKey) => RANK_KEYS.indexOf(key);
const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const now = Date.now();

const REGION_SETUP: Record<Region, { timezones: string[]; countries: string[]; languages: Language[] }> = {
  eu: { timezones: ["Europe/Paris", "Europe/Berlin", "Europe/London", "Europe/Madrid", "Europe/Warsaw"], countries: ["FR", "DE", "GB", "ES", "PL", "BE", "NL", "IT", "SE"], languages: ["en", "fr", "de", "es", "pl", "it", "nl", "sv"] },
  na: { timezones: ["America/New_York", "America/Chicago", "America/Los_Angeles", "America/Toronto"], countries: ["US", "CA"], languages: ["en", "es", "fr"] },
  latam: { timezones: ["America/Mexico_City", "America/Bogota", "America/Argentina/Buenos_Aires", "America/Santiago"], countries: ["MX", "CO", "AR", "CL", "PE"], languages: ["es", "en"] },
  br: { timezones: ["America/Sao_Paulo"], countries: ["BR"], languages: ["pt", "en"] },
  apac: { timezones: ["Asia/Singapore", "Asia/Manila", "Asia/Jakarta", "Asia/Bangkok"], countries: ["SG", "PH", "ID", "TH", "VN"], languages: ["en", "tl", "id", "th", "vi"] },
  kr: { timezones: ["Asia/Seoul"], countries: ["KR"], languages: ["ko", "en"] },
  jp: { timezones: ["Asia/Tokyo"], countries: ["JP"], languages: ["ja", "en"] },
  oce: { timezones: ["Australia/Sydney", "Pacific/Auckland"], countries: ["AU", "NZ"], languages: ["en"] },
  mena: { timezones: ["Asia/Dubai", "Africa/Cairo", "Asia/Riyadh"], countries: ["AE", "EG", "SA", "MA"], languages: ["ar", "en", "fr"] },
  cn: { timezones: ["Asia/Shanghai"], countries: ["CN"], languages: ["zh"] },
};

// Weighted towards the regions where the scene is the most active.
const REGION_WEIGHTS: Region[] = ["eu", "eu", "eu", "eu", "na", "na", "na", "latam", "latam", "br", "br", "apac", "kr", "jp", "oce", "mena", "cn"];

const PLAYER_NAMES = [
  "Nyxie", "kaelo", "Ren", "Solenn", "Bia", "hana", "Vesper", "Lux", "Maëlys", "juno", "Sakura", "Tamsin", "Kiri", "Aya", "Mireille",
  "Pixel", "Zora", "noa", "Iris", "Lyra", "Faye", "Emberly", "Sol", "Kyra", "Wren", "Yumi", "Nova", "Riven", "Elo", "Camille",
  "Oriane", "Blue", "Mika", "Talia", "Seren", "Nami", "Rhea", "Selin", "Ivy", "Luz",
];
const TEAM_NAMES = [
  "Mistral Esports", "Aurora Five", "Nébuleuse", "Kitsune GG", "Orchid", "Lumen", "Valkyries", "Halcyon", "Nightbloom", "Polaris",
  "Crimson Veil", "Moonrise", "Solstice", "Echo Queens", "Zenith", "Tempest", "Starlight Academy", "Hydra Gaming",
];
const STAFF_NAMES = ["Coach Mira", "Élodie", "Sasha", "Dr. Vex", "Maren", "Ines", "Kestrel", "Oona"];

const DESCRIPTIONS: Record<PostType, string[]> = {
  lft: [
    "Looking for a serious roster aiming for Game Changers qualifiers. I review my VODs every week and I am used to structured practice.",
    "Former Open Qualifiers regular, looking for a team with a clear schedule and a coach. Chill but competitive, good comms.",
    "I mostly play the anchor role and I like calling mid round. Open to trials, can scrim from next week.",
    "Recherche une équipe motivée pour la prochaine saison. Dispo le soir en semaine, bonne communication, aucun souci pour jouer sub au début.",
    "Buscando equipo competitivo para torneos GC. Tengo experiencia en playoffs y juego con micrófono todos los días.",
    "Main controller, comfortable on every map in the pool. Looking for a long term project rather than a one off tournament.",
  ],
  lfp: [
    "We are a four player roster looking for our fifth. Practice four evenings a week, scrims and VOD review with our coach.",
    "Nouvelle équipe qui vise les qualifs GC. On cherche une joueuse motivée, régulière, qui accepte les retours.",
    "Looking for a sub who can join officials when needed. Friendly environment, we play to improve and to win.",
    "Roster stable depuis un an, on remplace une joueuse qui arrête. Trial sur 2 semaines avec scrims.",
  ],
  lfs: [
    "Our roster needs someone to structure practice and lead VOD reviews. Paid position depending on results.",
    "On cherche un·e coach pour préparer les prochains tournois : anti strat, compos, suivi individuel.",
    "Looking for an analyst to scout opponents before officials. Remote, a few hours a week.",
  ],
  lfo: [
    "Full roster with a coach, looking for an organization for visibility and support. Results available on GC Stats.",
    "Roster complet, cinq joueuses et un coach, on cherche une structure pour la saison prochaine.",
    "We have played together for two seasons and want an org that can help with travel for LAN events.",
  ],
  lfst: [
    "Experienced coach, available for a roster aiming for GC main events. I focus on structure, protocols and mental.",
    "Analyste depuis trois saisons, je propose du scouting adverse et des rapports après chaque match.",
    "Manager available: scheduling, scrim planning, tournament registrations and sponsor relations.",
  ],
};

// Agents per class, used to build a believable tierlist.
const AGENTS_BY_CLASS = Object.fromEntries(AGENT_CLASSES.map((c) => [c, VALORANT_AGENTS.filter((a) => a.role === c).map((a) => a.slug)])) as Record<AgentClass, string[]>;

const roleClass = (role: Exclude<AgentRole, "flex">): AgentClass => (role === "initiator_reveal" || role === "initiator_flash" ? "initiator" : role);

function makeTierList(roles: AgentRole[]): TierList {
  const main = roles.includes("flex") ? [...AGENT_CLASSES] : [...new Set(roles.filter((r) => r !== "flex").map(roleClass))];
  const mainPool = main.flatMap((c) => AGENTS_BY_CLASS[c]);
  const tiers: TierList = {};
  const unranked = () => VALORANT_AGENTS.map((a) => a.slug).filter((s) => tiers[s] === undefined);
  for (const slug of sample(mainPool, int(2, 4))) tiers[slug] = 0;
  for (const slug of sample(unranked().filter((s) => mainPool.includes(s)), int(1, 3))) tiers[slug] = 1;
  for (const slug of sample(unranked(), int(3, 6))) tiers[slug] = 2;
  return tiers;
}

function makeAvailability(): AvailabilitySlot[] {
  const days = sample([0, 1, 2, 3, 4, 5, 6], int(2, 6)).sort();
  const start = pick([17, 18, 19, 20, 20, 21]) * 60 + pick([0, 0, 30]);
  const end = Math.min(1440, start + pick([2, 3, 3, 4]) * 60);
  const slots = days.map((day) => ({ day, start, end }));
  // Some also play on weekend afternoons.
  if (chance(0.35)) for (const day of [5, 6]) slots.push({ day, start: 14 * 60, end: 17 * 60 + (chance(0.5) ? 30 : 0) });
  return slots;
}

/** Longer at lower levels: nobody reaches a main event before playing Open Qualifiers. */
function makeExperience(type: PostType): Experience {
  if (type === "lfp") return {};
  const reached = type === "lfst" ? int(1, 3) : int(0, 3);
  const experience: Experience = {};
  let months = 0;
  for (const level of TOURNAMENT_LEVELS.slice(0, reached).reverse()) {
    months = Math.max(months, pick(EXPERIENCE_MONTHS.slice(0, 7)));
    experience[level] = months;
  }
  return experience;
}

/** Declared rhythm, at most the time the slots cover. */
function makeRhythm(slots: AvailabilitySlot[]): { weeklyMinutes: number; activeDays: number } {
  const total = availabilityTotals(slots);
  if (total.minutes === 0) return { weeklyMinutes: 0, activeDays: 0 };
  const hours = Math.max(1, Math.floor((total.minutes / 60) * pick([0.5, 0.75, 1])));
  return { weeklyMinutes: hours * 60, activeDays: Math.max(1, total.days - int(0, 2)) };
}

const STAFF_TEAM_ROLE: Record<StaffRole, GcsTeamRole> = {
  coach: "coach",
  assistant_coach: "assistant coach",
  performance_coach: "performance coach",
  mental_coach: "coach",
  analyst: "analyst",
  manager: "manager",
};

function makeRankSpan(): { rankMin: number; rankMax: number } {
  const min = int(rank("gold_1"), rank("immortal_3"));
  return { rankMin: min, rankMax: Math.min(rank("radiant"), min + int(0, 6)) };
}

type Profile = "verified" | "pending" | "none";

type PostSeed = {
  type: PostType;
  name: string;
  region: Region;
  profile?: Profile;
  hoursAgo: number;
  /** Renewed posts were published before their last bump. */
  publishedDaysBefore?: number;
  status?: "active" | "closed" | "removed";
  /** Moves `expires_at` in the past. */
  expired?: boolean;
  roles?: AgentRole[];
  igl?: ("igl" | "co_igl")[];
  staffRoles?: StaffRole[];
};

function buildPost(seed: PostSeed, authorId: string) {
  const setup = REGION_SETUP[seed.region];
  const timezone = pick(setup.timezones);
  const primary = seed.region === "eu" ? pick(["en", "fr", "fr", "de", "es"] as Language[]) : setup.languages[0]!;
  const languages = [...new Set<Language>([primary, ...(chance(0.8) ? ["en" as Language] : []), ...(chance(0.2) ? [pick(setup.languages)] : [])])];
  const roles = seed.roles ?? [];
  const isPlayer = seed.type === "lft";
  const current = isPlayer ? int(rank("gold_1"), rank("radiant")) : null;
  const span = seed.type === "lfp" ? makeRankSpan() : null;
  const playersWanted = seed.type === "lfp" ? int(0, 2) : null;
  const subsWanted = playersWanted === null ? null : playersWanted === 0 ? 1 : int(0, 1);
  const tierList = isPlayer ? makeTierList(roles.length ? roles : ["flex"]) : null;
  const slots = makeAvailability();

  const bumpedAt = new Date(now - seed.hoursAgo * HOUR - (seed.expired ? POST_LIFETIME_DAYS * DAY : 0));
  const publishedAt = new Date(bumpedAt.getTime() - (seed.publishedDaysBefore ?? 0) * DAY);
  const experience = makeExperience(seed.type);
  const profile = seed.profile ?? "none";
  const handle = seed.name.toLowerCase().normalize("NFD").replace(/[^a-z0-9]/g, "");

  return {
    authorId,
    type: seed.type,
    status: seed.status ?? "active",
    displayName: seed.name,
    gcsTeamId: (seed.type === "lfp" || seed.type === "lfo") && chance(0.6) ? int(100, 900) : null,
    region: seed.region,
    country: chance(0.7) ? pick(setup.countries) : null,
    languages,
    roles,
    igl: seed.igl ?? [],
    rosterSpot: seed.type === "lft" ? (chance(0.2) ? ("sub" as const) : ("player" as const)) : playersWanted === null ? null : playersWanted > 0 ? ("player" as const) : ("sub" as const),
    playersWanted,
    subsWanted,
    staffRoles: seed.staffRoles ?? [],
    compensation: pick(["paid", "free"] as const),
    lan: seed.type === "lfo" ? null : pick(["lan", "online"] as const),
    // Derived from the name, not the RNG, so the rest of the seed stays the same.
    ageGroup: seed.type === "lft" ? ([null, "adult", "adult", "minor"] as const)[seed.name.length % 4]! : null,
    minorsAccepted: ["lfp", "lfs", "lfst"].includes(seed.type) ? seed.name.length % 3 !== 0 : null,
    rankCurrent: current,
    rankPeak: current === null ? null : Math.min(rank("radiant"), current + int(0, 3)),
    rankMin: span?.rankMin ?? null,
    rankMax: span?.rankMax ?? null,
    experience,
    tournamentLevels: experienceLevels(experience),
    tierList,
    strongAgents: tierList ? strongAgents(tierList) : [],
    timezone,
    availability: slots,
    ...deriveAvailability(slots, timezone, bumpedAt),
    ...makeRhythm(slots),
    description: pick(DESCRIPTIONS[seed.type]),
    contact: { discord: String(100000000000000000n + BigInt(Math.floor(Math.random() * 1e15))), ...(chance(0.6) ? { twitter: `${handle}_vlr` } : {}), ...(chance(0.25) ? { email: `${handle}@example.com` } : {}) },
    gcsSummary: profile === "none" ? null : makeGcsSummary(seed, bumpedAt),
    gcsSummarySyncedAt: profile === "none" ? null : bumpedAt,
    publishedAt,
    bumpedAt,
    expiresAt: new Date(bumpedAt.getTime() + POST_LIFETIME_DAYS * DAY),
    closedAt: seed.status === "closed" ? new Date(now - 2 * HOUR) : null,
    deletedAt: seed.status === "removed" ? new Date(now - HOUR) : null,
  };
}

const REGION_EVENT_PREFIX: Record<Region, string> = {
  eu: "EMEA", na: "North America", latam: "LATAM", br: "Brazil", apac: "Pacific", kr: "Korea", jp: "Japan", oce: "Oceania", mena: "MENA", cn: "China",
};
const EVENTS = ["Game Changers Series 1", "Game Changers Series 2", "Game Changers Championship Qualifier", "Open Cup", "Open Qualifiers", "Kickoff", "Spring Showdown", "Winter Clash"];
const PLACEMENTS: GcsPlacement[] = [[1, 1], [2, 2], [3, 4], [5, 8], [5, 8], [9, 16], [9, 16], [17, 32]];

const isoDate = (time: number) => new Date(time).toISOString().slice(0, 10);

/** Latest teams and tournaments first, as GC Stats would return them. */
function makeGcsSummary(seed: PostSeed, at: Date): GcsSummary {
  const isTeam = seed.type === "lfp" || seed.type === "lfs" || seed.type === "lfo";

  const teams: GcsTeamEntry[] = [];
  if (!isTeam) {
    let end = at.getTime() - int(0, 60) * DAY;
    const current = chance(0.2);
    for (const [i, name] of sample(TEAM_NAMES.filter((n) => n !== seed.name), int(1, GCS_SUMMARY_LIMIT)).entries()) {
      const start = end - int(90, 400) * DAY;
      const role: GcsTeamRole =
        seed.type === "lfst" ? STAFF_TEAM_ROLE[seed.staffRoles?.[0] ?? "coach"] : seed.igl?.includes("igl") && chance(0.6) ? "player-igl" : chance(0.15) ? "sub" : "player";
      teams.push({ id: int(100, 900), name, logoUrl: null, role, since: chance(0.9) ? isoDate(start) : null, until: i === 0 && current ? null : isoDate(end) });
      end = start - int(0, 45) * DAY;
    }
  }

  const prefix = REGION_EVENT_PREFIX[seed.region];
  let date = at.getTime() - int(5, 40) * DAY;
  const recentTournaments: GcsTournamentEntry[] = [];
  for (let i = 0; i < int(1, GCS_SUMMARY_LIMIT); i++) {
    const year = new Date(date).getUTCFullYear();
    recentTournaments.push({ id: int(1000, 9000), name: `${prefix} ${pick(EVENTS)} ${year}`, logoUrl: null, date: isoDate(date), placement: chance(0.9) ? pick(PLACEMENTS) : null, record: { wins: int(0, 6), losses: int(0, 4) } });
    date -= int(20, 120) * DAY;
  }

  const placements = recentTournaments.flatMap((t) => (t.placement ? [t.placement] : []));
  return {
    tournaments: recentTournaments.length + (recentTournaments.length === GCS_SUMMARY_LIMIT ? int(0, 20) : 0),
    bestPlacement: placements.sort((a, b) => a[0] - b[0])[0] ?? null,
    teams,
    recentTournaments,
    pronoun: isTeam ? null : pick(GCS_PRONOUNS),
  };
}

// Hand written posts, used by the home page and easy to find while testing.
const FEATURED: PostSeed[] = [
  { type: "lft", name: "Nyxie", region: "eu", profile: "verified", hoursAgo: 2, roles: ["controller", "sentinel"], igl: ["igl"] },
  { type: "lfp", name: "Mistral Esports", region: "eu", profile: "verified", hoursAgo: 5, roles: ["duelist"] },
  { type: "lft", name: "kaelo", region: "na", profile: "pending", hoursAgo: 9, roles: ["initiator_reveal"] },
  { type: "lfs", name: "Aurora Five", region: "eu", profile: "verified", hoursAgo: 22, staffRoles: ["coach", "analyst"] },
  { type: "lfo", name: "Nébuleuse", region: "eu", hoursAgo: 30 },
  { type: "lft", name: "Ren", region: "latam", profile: "verified", hoursAgo: 41, roles: ["duelist"], publishedDaysBefore: 9 },
  { type: "lfst", name: "Coach Mira", region: "eu", profile: "verified", hoursAgo: 12, staffRoles: ["coach"] },
  { type: "lft", name: "Solenn", region: "eu", hoursAgo: 55, roles: ["flex"], igl: ["igl", "co_igl"] },
  { type: "lfp", name: "Kitsune GG", region: "apac", profile: "pending", hoursAgo: 70, roles: ["controller", "initiator_flash"] },
  { type: "lft", name: "Bia", region: "br", profile: "verified", hoursAgo: 90, roles: ["sentinel"] },
  { type: "lfp", name: "Orchid", region: "na", hoursAgo: 120, roles: ["sentinel", "duelist"], igl: ["igl"] },
  { type: "lft", name: "hana", region: "kr", hoursAgo: 150, roles: ["initiator_reveal", "controller"] },
  // Not visible on /posts, but their page still opens (closed, expired) or 404s (removed).
  { type: "lft", name: "Vesper", region: "eu", profile: "verified", hoursAgo: 30, expired: true, roles: ["duelist"] },
  { type: "lfp", name: "Halcyon", region: "eu", hoursAgo: 60, status: "closed", roles: ["initiator_flash"] },
  { type: "lft", name: "Pixel", region: "na", hoursAgo: 20, status: "removed", roles: ["sentinel"] },
];

function generated(): PostSeed[] {
  const used = new Set(FEATURED.map((p) => p.name));
  const next = (pool: string[]) => pool.find((n) => !used.has(n) && used.add(n));
  const posts: PostSeed[] = [];
  const profile = (): Profile => pick(["verified", "verified", "pending", "none", "none"]);
  const playerRoles = (): AgentRole[] => (chance(0.15) ? ["flex"] : sample(["duelist", "initiator_reveal", "initiator_flash", "controller", "sentinel"], int(1, 2)));

  for (let i = 0; i < 26; i++) {
    const name = next(PLAYER_NAMES);
    if (!name) break;
    posts.push({ type: "lft", name, region: pick(REGION_WEIGHTS), profile: profile(), hoursAgo: int(1, 230), roles: playerRoles(), igl: chance(0.2) ? [pick(["igl", "co_igl"] as const)] : [] });
  }
  for (let i = 0; i < 14; i++) {
    const name = next(TEAM_NAMES) ?? `Roster ${i + 1}`;
    const type = pick(["lfp", "lfp", "lfp", "lfs", "lfo"] as const);
    posts.push({
      type,
      name,
      region: pick(REGION_WEIGHTS),
      profile: profile(),
      hoursAgo: int(1, 230),
      roles: type === "lfp" ? playerRoles() : [],
      igl: type === "lfp" && chance(0.25) ? ["igl"] : [],
      staffRoles: type === "lfs" ? sample(STAFF_ROLES, int(1, 2)) : [],
      publishedDaysBefore: chance(0.2) ? int(3, 20) : 0,
    });
  }
  for (let i = 0; i < 5; i++) {
    const name = next(STAFF_NAMES);
    if (!name) break;
    posts.push({ type: "lfst", name, region: pick(REGION_WEIGHTS), profile: profile(), hoursAgo: int(1, 230), staffRoles: sample(STAFF_ROLES, int(1, 2)) });
  }
  return posts;
}

async function main() {
  const seeds = [...FEATURED, ...generated()];

  await db.execute(sql`truncate table
    ${schema.moderationActions}, ${schema.reports}, ${schema.discordDeliveries}, ${schema.discordChannels},
    ${schema.actionTokens}, ${schema.posts}, ${schema.playerLinks}, ${schema.sessions}, ${schema.oauthTokens}, ${schema.users}
    restart identity cascade`);

  // One account per post, except teams which may reuse their account for several posts.
  const accounts = new Map<string, { id: string; profile: Profile }>();
  for (const [i, seed] of seeds.entries()) {
    if (accounts.has(seed.name)) continue;
    const handle = seed.name.toLowerCase().normalize("NFD").replace(/[^a-z0-9]/g, "");
    const [user] = await db
      .insert(schema.users)
      .values({
        gcsUserId: `seed:${i + 1}`,
        username: seed.name.slice(0, 32),
        email: `${handle}@example.test`,
        ...(chance(0.7) ? { discordId: String(100000000000000000n + BigInt(i)), notifyDiscord: chance(0.4) } : {}),
        notifyEmail: chance(0.7),
        notifyPromptedAt: new Date(now - int(1, 60) * DAY),
        locale: pick(["en", "fr", "es"]),
        lastLoginAt: new Date(now - int(0, 5) * DAY),
      })
      .returning({ id: schema.users.id });
    accounts.set(seed.name, { id: user!.id, profile: seed.profile ?? "none" });
  }

  const links = [...accounts.values()]
    .filter((a) => a.profile !== "none")
    .map((a) => ({
      userId: a.id,
      gcsPersonId: int(1000, 9000),
      gcsChangeRequestId: a.profile === "pending" ? int(10000, 90000) : null,
      status: a.profile === "verified" ? ("approved" as const) : ("pending" as const),
      resolvedAt: a.profile === "verified" ? new Date(now - int(5, 90) * DAY) : null,
    }));
  if (links.length) await db.insert(schema.playerLinks).values(links);

  const inserted = await db
    .insert(schema.posts)
    .values(seeds.map((seed) => buildPost(seed, accounts.get(seed.name)!.id)))
    .returning({ id: schema.posts.id, displayName: schema.posts.displayName });

  const [feed] = await db
    .insert(schema.discordChannels)
    .values([
      { guildId: "900000000000000001", channelId: "900000000000000101", kind: "feed", filters: { types: ["lft"], regions: ["eu"] }, createdByDiscordId: "900000000000000900" },
      { guildId: "900000000000000001", channelId: "900000000000000102", kind: "moderation", moderatorRoleId: "900000000000000500", createdByDiscordId: "900000000000000900" },
    ])
    .returning({ id: schema.discordChannels.id });
  await db.insert(schema.discordDeliveries).values(inserted.slice(0, 5).map((p, i) => ({ postId: p.id, channelConfigId: feed!.id, messageId: String(910000000000000000n + BigInt(i)) })));

  const reported = inserted.find((p) => p.displayName === "Pixel")!;
  const [report] = await db
    .insert(schema.reports)
    .values({ postId: reported.id, reporterDiscordId: "900000000000000777", reason: "fake", message: "This rank does not match the tracker.", status: "handled", handledByDiscordId: "900000000000000900", handledAt: new Date(now - HOUR) })
    .returning({ id: schema.reports.id });
  await db.insert(schema.moderationActions).values({ postId: reported.id, reportId: report!.id, action: "remove", discordUserId: "900000000000000900", reason: "Fake rank" });

  console.log(`Seeded ${accounts.size} users, ${links.length} player links, ${inserted.length} posts`);
}

try {
  await main();
} finally {
  await pool.end();
}
