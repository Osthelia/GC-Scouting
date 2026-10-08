/**
 * GC-Scouting - countries
 *
 * Country codes grouped by Valorant region.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

import type { Region } from "@scouting/db/constants";

// ISO 3166 country codes grouped by Valorant region. Countries left out get no default region.
const COUNTRIES: Record<Region, string> = {
  eu: "AD AL AM AT AZ BA BE BG BY CH CY CZ DE DK EE ES FI FO FR GB GE GI GR HR HU IE IS IT KZ LI LT LU LV MC MD ME MK MT NL NO PL PT RO RS RU SE SI SK SM TR UA VA XK",
  na: "US CA",
  latam: "AR BO CL CO CR CU DO EC GT HN MX NI PA PE PR PY SV UY VE",
  br: "BR",
  apac: "BD BN HK ID IN KH LA LK MM MN MO MY NP PH PK SG TH TW VN",
  kr: "KR",
  jp: "JP",
  oce: "AU NZ",
  mena: "AE BH DZ EG IQ JO KW LB LY MA OM PS QA SA SY TN YE",
  cn: "CN",
};

const REGION_BY_COUNTRY = new Map(Object.entries(COUNTRIES).flatMap(([region, codes]) => codes.split(" ").map((code) => [code, region as Region])));

/** Countries offered in the post form. */
export const COUNTRY_CODES = [...REGION_BY_COUNTRY.keys()];

export function isCountryCode(value: string): boolean {
  return REGION_BY_COUNTRY.has(value);
}

export function regionFromCountry(country: string | null | undefined): Region | null {
  return country ? (REGION_BY_COUNTRY.get(country.toUpperCase()) ?? null) : null;
}
