/**
 * GC-Scouting - locale
 *
 * Locale resolution for the tweet queue pages.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

import { headers } from "next/headers";
import { routing, type AppLocale } from "@/i18n/routing";

/** Locale from Accept-Language, the page has no locale in its path and reads no cookie. */
export async function tweetsLocale(): Promise<AppLocale> {
  const accepted = ((await headers()).get("accept-language") ?? "")
    .split(",")
    .map((part) => {
      const [tag = "", ...params] = part.trim().split(";");
      const q = Number(params.find((p) => p.trim().startsWith("q="))?.trim().slice(2) ?? 1);
      return { base: tag.split("-")[0]!.toLowerCase(), q: Number.isFinite(q) ? q : 0 };
    })
    .sort((a, b) => b.q - a.q);
  return accepted.map((a) => a.base).find((base): base is AppLocale => routing.locales.includes(base as AppLocale)) ?? routing.defaultLocale;
}
