/**
 * GC-Scouting - flow
 *
 * Login flow state (PKCE verifier, redirect target) kept in a short lived cookie.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

import { routing, type AppLocale } from "@/i18n/routing";
import { fromBase64Url, toBase64Url } from "./crypto";

// Short lived state of a login attempt, kept in an httpOnly cookie between /login and /callback.

export const FLOW_COOKIE = "sc_oauth";
export const FLOW_TTL_SECONDS = 10 * 60;

export type LoginFlow = { state: string; verifier: string; next: string; locale: AppLocale };

export function encodeFlow(flow: LoginFlow): string {
  return toBase64Url(new TextEncoder().encode(JSON.stringify(flow)));
}

export function decodeFlow(value: string | undefined): LoginFlow | null {
  if (!value) return null;
  try {
    const flow = JSON.parse(new TextDecoder().decode(fromBase64Url(value))) as Partial<LoginFlow>;
    if (typeof flow.state !== "string" || typeof flow.verifier !== "string" || typeof flow.next !== "string") return null;
    return { state: flow.state, verifier: flow.verifier, next: safeNext(flow.next, toLocale(flow.locale)), locale: toLocale(flow.locale) };
  } catch {
    return null;
  }
}

export function toLocale(value: unknown): AppLocale {
  return routing.locales.includes(value as AppLocale) ? (value as AppLocale) : routing.defaultLocale;
}

/** Same origin path only, anything else falls back to the home page. */
export function safeNext(next: string | null | undefined, locale: AppLocale): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\") || next.startsWith("/api/")) return `/${locale}`;
  return next;
}

export function authErrorUrl(origin: string, locale: AppLocale, reason: string): string {
  return `${origin}/${locale}/auth/error?reason=${encodeURIComponent(reason)}`;
}
