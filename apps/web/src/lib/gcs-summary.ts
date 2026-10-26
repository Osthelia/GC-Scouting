/**
 * GC-Scouting - gcs-summary
 *
 * Builds the GC Stats summary (teams, results, tournaments) of a post.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

import { z } from "zod";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@scouting/db/client";
import { playerLinks, posts, GCS_PRONOUNS, GCS_SUMMARY_LIMIT, GCS_TEAM_ROLES, type GcsPlacement, type GcsSummary, type GcsTeamRole, type GcsTournamentEntry } from "@scouting/db";
import { gcsApi, gcsApiConfigured, logosSchema, logoUrl } from "./gcs-api";
import { loggable } from "@scouting/db/log";

// GC Stats snapshot of a post, built from the public API (v2, API key).

const MATCH_PAGE_SIZE = 50; // API maximum
const MAX_MATCH_PAGES = 4;
/** Size of `last_tournaments` on the player and team endpoints. */
const GCS_LAST_TOURNAMENTS = 10;

const achievementsSchema = z.object({
  items: z.array(z.object({ tournament_id: z.number().int(), placement: z.number().int(), placement_label: z.string().nullish() })).default([]),
});

const teamHistorySchema = z.object({
  team_id: z.number().int(),
  team_name: z.string().nullish(),
  current_name: z.string(),
  logos: logosSchema,
  role: z.string(),
  joined_at: z.string().nullish(),
  left_at: z.string().nullish(),
});

const tournamentEntrySchema = z.object({
  tournament: z.object({ id: z.number().int(), name: z.string(), start_date: z.string().nullish(), end_date: z.string().nullish() }),
  logos: logosSchema,
  placement: z.number().int().nullish(),
  placement_label: z.string().nullish(),
  wins: z.number().int().nullish(),
  losses: z.number().int().nullish(),
});

const playerSchema = z.object({
  achievements: achievementsSchema,
  current_teams: z.array(teamHistorySchema).default([]),
  past_teams: z.array(teamHistorySchema).default([]),
  last_tournaments: z.array(tournamentEntrySchema).default([]),
  pronouns: z.object({ id: z.number().int() }).nullish(),
});

const teamSchema = z.object({ achievements: achievementsSchema, last_tournaments: z.array(tournamentEntrySchema).default([]) });

const staffTournamentsSchema = z.object({ total: z.number().int(), data: z.array(tournamentEntrySchema) });

const matchesSchema = z.object({
  total_pages: z.number().int(),
  data: z.array(z.object({ tournament_id: z.number().int().nullable() })),
});

type Achievements = z.infer<typeof achievementsSchema>;
type TournamentEntry = z.infer<typeof tournamentEntrySchema>;
type Tournament = Omit<GcsTournamentEntry, "date"> & { date: string | null };

function toRole(role: string): GcsTeamRole {
  if (role === "substitute") return "sub";
  return (GCS_TEAM_ROLES as readonly string[]).includes(role) ? (role as GcsTeamRole) : "player";
}

/** Placement range from GC Stats: 5 with the label "5th-8th" (or "Top 8") gives [5, 8]. */
function toPlacement(placement: number | null | undefined, label: string | null | undefined): GcsPlacement | null {
  if (!placement) return null;
  const worst = Math.max(placement, ...(label?.match(/\d+/g) ?? []).map(Number));
  return [placement, worst];
}

function bestOf(placements: (GcsPlacement | null)[]): GcsPlacement | null {
  return placements.reduce<GcsPlacement | null>((best, p) => (p && (!best || p[0] < best[0] || (p[0] === best[0] && p[1] < best[1])) ? p : best), null);
}

function achievementPlacements(achievements: Achievements): GcsPlacement[] {
  return achievements.items.map((a) => toPlacement(a.placement, a.placement_label)).filter((p): p is GcsPlacement => p !== null);
}

function toTournament(entry: TournamentEntry): Tournament {
  return {
    id: entry.tournament.id,
    name: entry.tournament.name,
    logoUrl: logoUrl(entry.logos),
    date: entry.tournament.start_date ?? entry.tournament.end_date ?? null,
    placement: toPlacement(entry.placement, entry.placement_label),
    record: entry.wins != null && entry.losses != null ? { wins: entry.wins, losses: entry.losses } : null,
  };
}

const recent = (tournaments: Tournament[]) => tournaments.filter((t): t is GcsTournamentEntry => t.date !== null).slice(0, GCS_SUMMARY_LIMIT);

/** `last_tournaments` is capped: beyond that, distinct tournaments are counted from the matches. */
async function tournamentCount(base: string, listed: number): Promise<number> {
  if (listed < GCS_LAST_TOURNAMENTS) return listed;
  const ids = new Set<number>();
  for (let page = 1; page <= MAX_MATCH_PAGES; page++) {
    const res = await gcsApi(`${base}/matches?per_page=${MATCH_PAGE_SIZE}&page=${page}`, matchesSchema);
    for (const m of res.data) if (m.tournament_id !== null) ids.add(m.tournament_id);
    if (page >= res.total_pages) break;
  }
  return Math.max(ids.size, listed);
}

/** Players get their own tournaments, staff the ones their teams played while they were on staff. */
async function buildPersonSummary(personId: number, staff: boolean): Promise<GcsSummary> {
  const base = `/players/${personId}`;
  const [player, staffTournaments] = await Promise.all([
    gcsApi(base, playerSchema),
    staff ? gcsApi(`${base}/staff-tournaments?per_page=${MATCH_PAGE_SIZE}`, staffTournamentsSchema) : null,
  ]);

  const history = [
    ...player.current_teams,
    ...[...player.past_teams].sort((a, b) => (b.left_at ?? "").localeCompare(a.left_at ?? "")),
  ].slice(0, GCS_SUMMARY_LIMIT);

  const tournaments = (staffTournaments?.data ?? player.last_tournaments).map(toTournament);
  const total = staffTournaments ? staffTournaments.total : await tournamentCount(base, tournaments.length);

  return {
    tournaments: total,
    bestPlacement: bestOf([...tournaments.map((t) => t.placement), ...(staff ? [] : achievementPlacements(player.achievements))]),
    teams: history.map((t) => ({
      id: t.team_id,
      name: t.team_name ?? t.current_name,
      logoUrl: logoUrl(t.logos),
      role: toRole(t.role),
      since: t.joined_at ?? null,
      until: t.left_at ?? null,
    })),
    recentTournaments: recent(tournaments),
    pronoun: GCS_PRONOUNS[player.pronouns?.id ?? -1] ?? null,
  };
}

async function buildTeamSummary(teamId: number): Promise<GcsSummary> {
  const base = `/teams/${teamId}`;
  const team = await gcsApi(base, teamSchema);
  const tournaments = team.last_tournaments.map(toTournament);

  return {
    tournaments: await tournamentCount(base, tournaments.length),
    bestPlacement: bestOf([...tournaments.map((t) => t.placement), ...achievementPlacements(team.achievements)]),
    teams: [],
    recentTournaments: recent(tournaments),
  };
}

/** Teams the person is currently on (players and staff). */
export async function gcsCurrentTeamIds(personId: number): Promise<number[]> {
  const player = await gcsApi(`/players/${personId}`, playerSchema.pick({ current_teams: true }));
  return player.current_teams.map((t) => t.team_id);
}

export type GcsSummaryTarget = { personId: number; staff: boolean } | { teamId: number };

/** Snapshot of a GC Stats player, staff member or team. Null without an API key. */
export async function buildGcsSummary(target: GcsSummaryTarget): Promise<GcsSummary | null> {
  if (!gcsApiConfigured()) return null;
  return "personId" in target ? buildPersonSummary(target.personId, target.staff) : buildTeamSummary(target.teamId);
}

export type GcsSummarySyncResult = "ok" | "noProfile" | "notConfigured" | "failed";

/** Refreshes the snapshot of a post: the GC Stats team for team posts, the author's linked profile otherwise. Never throws. */
export async function syncPostGcsSummary(postId: number): Promise<GcsSummarySyncResult> {
  try {
    const [post] = await db.select({ authorId: posts.authorId, type: posts.type, gcsTeamId: posts.gcsTeamId }).from(posts).where(eq(posts.id, postId)).limit(1);
    if (!post) return "failed";

    let target: GcsSummaryTarget | null = post.gcsTeamId ? { teamId: post.gcsTeamId } : null;
    if (!target) {
      const [link] = await db
        .select({ gcsPersonId: playerLinks.gcsPersonId })
        .from(playerLinks)
        .where(and(eq(playerLinks.userId, post.authorId), inArray(playerLinks.status, ["pending", "approved"])))
        .limit(1);
      if (link) target = { personId: link.gcsPersonId, staff: post.type === "lfst" };
    }
    if (!target) return "noProfile";

    const summary = await buildGcsSummary(target);
    if (!summary) return "notConfigured";
    await db.update(posts).set({ gcsSummary: summary, gcsSummarySyncedAt: new Date() }).where(eq(posts.id, postId));
    return "ok";
  } catch (error) {
    console.error("GC Stats summary sync failed", postId, loggable(error));
    return "failed";
  }
}

/** Refreshes the player and staff posts of an author after their linked profile changed. Never throws. */
export async function syncAuthorGcsSummaries(userId: string): Promise<void> {
  try {
    const own = await db
      .select({ id: posts.id })
      .from(posts)
      .where(and(eq(posts.authorId, userId), inArray(posts.type, ["lft", "lfst"]), eq(posts.status, "active"), isNull(posts.deletedAt), isNull(posts.gcsTeamId)));
    for (const post of own) await syncPostGcsSummary(post.id);
  } catch (error) {
    console.error("GC Stats author summaries sync failed", userId, loggable(error));
  }
}
