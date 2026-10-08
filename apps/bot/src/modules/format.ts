/**
 * GC-Scouting - format
 *
 * Text helpers for Discord messages (escaping, truncation, post codes).
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

import { RANK_KEYS, TOURNAMENT_LEVELS, VALORANT_AGENTS, type Experience, type PostType } from "@scouting/db";
import { t, type Locale } from "../core/i18n";

export { escapeMarkdown } from "@scouting/db/markdown";

export function truncate(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`;
}

export function postCode(type: PostType): string {
  return type.toUpperCase();
}

/** "gold_2" to "Gold 2", same labels in every language. */
export function rankLabel(index: number): string {
  const key = RANK_KEYS[index];
  if (!key) return "?";
  return key
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function rankRange(locale: Locale, min: number | null, max: number | null): string {
  return t(locale, "post.rankRange", { min: rankLabel(min ?? 0), max: rankLabel(max ?? RANK_KEYS.length - 1) });
}

export function duration(locale: Locale, months: number): string {
  return months >= 12 && months % 12 === 0 ? t(locale, "duration.years", { count: months / 12 }) : t(locale, "duration.months", { count: months });
}

/** Highest level first: "Main event (2 years), Playoffs (6 months)", `limit` levels at most. */
export function experienceText(
  locale: Locale,
  experience: Experience,
  label: (level: string) => string,
  { separator = ", ", limit = TOURNAMENT_LEVELS.length as number } = {},
): string | null {
  const parts = [...TOURNAMENT_LEVELS]
    .reverse()
    .filter((level) => (experience[level] ?? 0) > 0)
    .slice(0, limit)
    .map((level) => `${label(level)} (${duration(locale, experience[level]!)})`);
  return parts.length ? parts.join(separator) : null;
}

/** First letter of the tier and the division: "A2", "R" for Radiant. */
export function rankShort(index: number): string {
  const key = RANK_KEYS[index];
  if (!key) return "?";
  const [tier, division] = key.split("_");
  return tier!.charAt(0).toUpperCase() + (division ?? "");
}

export function agentName(slug: string): string {
  return VALORANT_AGENTS.find((a) => a.slug === slug)?.name ?? slug;
}

/** "FR" to 🇫🇷. */
export function flagEmoji(country: string | null): string {
  if (!country || !/^[A-Za-z]{2}$/.test(country)) return "";
  return String.fromCodePoint(...[...country.toUpperCase()].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}

export function languageName(locale: Locale, code: string): string {
  try {
    const name = new Intl.DisplayNames([locale], { type: "language" }).of(code);
    return name ? name.charAt(0).toUpperCase() + name.slice(1) : code.toUpperCase();
  } catch {
    return code.toUpperCase();
  }
}

export function hexColor(hex: string): number {
  return Number.parseInt(hex.replace("#", ""), 16);
}
