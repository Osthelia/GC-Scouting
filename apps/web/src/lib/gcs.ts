/**
 * GC-Scouting - gcs
 *
 * GC Stats URLs and search limits.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

// Overridable to point at a local GC Stats in dev.
// Trailing slashes stripped: "//api/..." gets a 308 from GC Stats.
export const GCS_URL = (process.env.NEXT_PUBLIC_GCS_URL || "https://gc-stats.app").replace(/\/+$/, "");

/** Query length accepted by the GC Stats search. */
export const GCS_SEARCH_MIN = 2;
export const GCS_SEARCH_MAX = 50;

/** Same cosmetic slug as GC Stats URLs, only the id is read there. */
function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "x"
  );
}

export function gcsPlayerUrl(locale: string, id: number, name: string): string {
  return `${GCS_URL}/${locale}/player/${id}/${slugify(name)}`;
}

export function gcsTeamUrl(locale: string, id: number, name: string): string {
  return `${GCS_URL}/${locale}/team/${id}/${slugify(name)}`;
}

export function gcsTournamentUrl(locale: string, id: number, name: string): string {
  return `${GCS_URL}/${locale}/tournaments/${id}/${slugify(name)}`;
}

/** "2024-01-15" to "01/2024", the month/year format of GC Stats listings. */
export function monthYear(date: string | null): string | null {
  const [y, m] = date?.split("-") ?? [];
  return y && m ? `${m}/${y}` : null;
}

/** Team id of a GC Stats team link ("https://gc-stats.app/fr/team/123/name"), null if it is not one. */
export function parseGcsTeamUrl(value: string): number | null {
  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
  } catch {
    return null;
  }
  const hosts = [new URL(GCS_URL).hostname, "gc-stats.app"];
  const known = hosts.some((h) => url.hostname === h || url.hostname.endsWith(`.${h}`));
  const match = url.pathname.match(/^\/(?:[a-z]{2}\/)?team\/(\d{1,15})(?:\/|$)/);
  return known && match ? Number(match[1]) : null;
}
