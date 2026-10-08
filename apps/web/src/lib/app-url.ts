/**
 * GC-Scouting - app-url
 *
 * Base URL of the site and locale parsing.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

import { routing, type AppLocale } from "@/i18n/routing";

/**
 * Public origin of the site, for redirects and links sent outside of it (emails, Discord, OG tags).
 * `APP_URL` is required in production, `Host` is never trusted there. In dev, falls back to the request URL.
 */
export function appUrl(requestUrl?: string): string {
  const configured = process.env.APP_URL?.replace(/\/+$/, "");
  if (configured) return configured;
  if (process.env.NODE_ENV === "production") throw new Error("APP_URL is not configured");
  return requestUrl ? new URL(requestUrl).origin : "http://localhost:3001";
}

/** Stored account locale, the default one when it is no longer offered. */
export function localeOf(value: string): AppLocale {
  return (routing.locales as readonly string[]).includes(value) ? (value as AppLocale) : routing.defaultLocale;
}
