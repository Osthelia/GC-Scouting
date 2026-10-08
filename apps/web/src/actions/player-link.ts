/**
 * GC-Scouting - player-link
 *
 * Server actions to search and link a GC Stats player or team to the account.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

"use server";

import { after } from "next/server";
import { z } from "zod";
import { db } from "@scouting/db/client";
import { playerLinks } from "@scouting/db";
import { getActiveProfile, getCurrentUser } from "@/lib/auth/session";
import { getGcsAccessToken } from "@/lib/auth/account";
import { requestPlayerLink } from "@/lib/auth/gcs-oauth";
import { GcsApiError, gcsApi, gcsApiConfigured, gcsAssetUrl, gcsCountryCode, logosSchema, logoUrl } from "@/lib/gcs-api";
import { syncAuthorGcsSummaries } from "@/lib/gcs-summary";
import { GCS_SEARCH_MAX, GCS_SEARCH_MIN } from "@/lib/gcs";
import { loggable } from "@scouting/db/log";

// Profile link assistant: GC Stats lookups (API key kept on the server) and the link request.

const SEARCH_LIMIT = 8;

export type GcsPlayerHit = { id: number; handle: string; subtitle: string | null; countryCode: string | null; logoUrl: string | null; claimed: boolean };
export type GcsTournamentHit = { id: number; name: string; subtitle: string | null; logoUrl: string | null };
export type GcsEntrant = { id: number; name: string; logoUrl: string | null; roster: { id: number; handle: string }[] };

export type LookupError = "auth" | "invalid" | "notConfigured" | "notFound" | "failed";
export type LookupResult<T> = { ok: true; data: T } | { ok: false; error: LookupError };

const searchItemSchema = z.object({
  id: z.number().int(),
  title: z.string(),
  subtitle: z.string().nullish(),
  country_code: z.string().nullish(),
  logo_url: z.string().nullish(),
});
const searchSchema = z.object({
  player: z.array(searchItemSchema.extend({ is_claimed: z.boolean().default(false) })).default([]),
  tournament: z.array(searchItemSchema).default([]),
});

const tournamentSchema = z.object({
  entrants: z
    .array(
      z.object({
        entrant_id: z.number().int(),
        display_name: z.string(),
        logos: logosSchema,
        roster: z.array(z.object({ person_id: z.number().int(), handle: z.string() })).default([]),
      }),
    )
    .default([]),
});

const isId = (v: unknown): v is number => Number.isSafeInteger(v) && (v as number) > 0;

async function lookup<T>(run: () => Promise<T>): Promise<LookupResult<T>> {
  if (!(await getCurrentUser())) return { ok: false, error: "auth" };
  if (!gcsApiConfigured()) return { ok: false, error: "notConfigured" };
  try {
    return { ok: true, data: await run() };
  } catch (error) {
    if (error instanceof GcsApiError && error.status === 404) return { ok: false, error: "notFound" };
    console.error("GC Stats lookup failed", loggable(error));
    return { ok: false, error: "failed" };
  }
}

function parseQuery(raw: unknown): string | null {
  const query = typeof raw === "string" ? raw.trim() : "";
  return query.length >= GCS_SEARCH_MIN && query.length <= GCS_SEARCH_MAX ? query : null;
}

const search = (query: string) => gcsApi(`/search?q=${encodeURIComponent(query)}&limit=${SEARCH_LIMIT}`, searchSchema);

export async function searchGcsPlayers(rawQuery: unknown): Promise<LookupResult<GcsPlayerHit[]>> {
  const query = parseQuery(rawQuery);
  if (!query) return { ok: false, error: "invalid" };
  return lookup(async () =>
    (await search(query)).player.map((p) => ({ id: p.id, handle: p.title, subtitle: p.subtitle ?? null, countryCode: gcsCountryCode(p.country_code), logoUrl: gcsAssetUrl(p.logo_url), claimed: p.is_claimed })),
  );
}

export async function searchGcsTournaments(rawQuery: unknown): Promise<LookupResult<GcsTournamentHit[]>> {
  const query = parseQuery(rawQuery);
  if (!query) return { ok: false, error: "invalid" };
  return lookup(async () => (await search(query)).tournament.map((t) => ({ id: t.id, name: t.title, subtitle: t.subtitle ?? null, logoUrl: gcsAssetUrl(t.logo_url) })));
}

/** Teams of a tournament with the roster they played it with. */
export async function getGcsTournamentEntrants(rawId: unknown): Promise<LookupResult<GcsEntrant[]>> {
  if (!isId(rawId)) return { ok: false, error: "invalid" };
  return lookup(async () => {
    const tournament = await gcsApi(`/tournaments/${rawId}`, tournamentSchema);
    return tournament.entrants
      .map((e) => ({ id: e.entrant_id, name: e.display_name, logoUrl: logoUrl(e.logos), roster: e.roster.map((p) => ({ id: p.person_id, handle: p.handle })) }))
      .sort((a, b) => a.name.localeCompare(b.name));
  });
}

export type LinkPlayerError = "auth" | "delegated" | "invalid" | "linkExists" | "reauth" | "notFound" | "taken" | "requestPending" | "rateLimited" | "failed";

/** Sends the link request to GC Stats and records it, the account's posts show "not verified" until staff approves. */
export async function linkGcsPlayer(rawPersonId: unknown): Promise<{ ok: true; status: "pending" | "approved" } | { ok: false; error: LinkPlayerError }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "auth" };
  // Only the owner can claim a GC Stats profile, it acts on their GC Stats account.
  if ((await getActiveProfile())?.delegated) return { ok: false, error: "delegated" };
  if (!isId(rawPersonId)) return { ok: false, error: "invalid" };
  if (user.profile) return { ok: false, error: "linkExists" };

  let result;
  try {
    const token = await getGcsAccessToken(user.id);
    if (!token) return { ok: false, error: "reauth" };
    result = await requestPlayerLink(token, rawPersonId);
  } catch (error) {
    console.error("linkGcsPlayer failed", loggable(error));
    return { ok: false, error: "failed" };
  }

  if (result.status === "error") {
    const errors = {
      invalid_token: "reauth",
      insufficient_scope: "reauth",
      not_found: "notFound",
      taken: "taken",
      request_pending: "requestPending",
      slow_down: "rateLimited",
      failed: "failed",
    } as const satisfies Record<typeof result.error, LinkPlayerError>;
    return { ok: false, error: errors[result.error] };
  }

  const approved = result.status === "already_linked";
  try {
    await db.insert(playerLinks).values({
      userId: user.id,
      gcsPersonId: rawPersonId,
      gcsChangeRequestId: result.status === "pending" ? result.changeRequestId : null,
      status: approved ? "approved" : "pending",
      resolvedAt: approved ? new Date() : null,
    });
  } catch (error) {
    // Partial unique index: another tab linked a profile meanwhile.
    console.error("linkGcsPlayer insert failed", loggable(error));
    return { ok: false, error: "linkExists" };
  }

  // Player posts already online get the history of the new profile.
  after(() => syncAuthorGcsSummaries(user.id));

  return { ok: true, status: approved ? "approved" : "pending" };
}
