/**
 * GC-Scouting - geo
 *
 * Visitor region detection from the request country.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

import { headers } from "next/headers";
import type { Region } from "@scouting/db/constants";
import { regionFromCountry } from "./countries";

export { regionFromCountry };

/** Region of the visitor, from the country Cloudflare adds to each request. */
export async function visitorRegion(): Promise<Region | null> {
  return regionFromCountry((await headers()).get("cf-ipcountry"));
}
