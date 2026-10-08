/**
 * GC-Scouting - i18n
 *
 * Bot translations (EN/FR/ES), locale detection and message lookup.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

import { Locale as DiscordLocale, type LocalizationMap } from "discord-api-types/v10";
import en from "../i18n/en.json";
import es from "../i18n/es.json";
import fr from "../i18n/fr.json";
// Domain labels (regions, roles, levels...) come from the site, a single source for both.
import webEn from "../../../web/src/messages/en.json";
import webEs from "../../../web/src/messages/es.json";
import webFr from "../../../web/src/messages/fr.json";

export const LOCALES = ["en", "fr", "es"] as const;
export type Locale = (typeof LOCALES)[number];

type Messages = { [key: string]: string | Messages };

const BOT: Record<Locale, Messages> = { en, fr, es };
const WEB: Record<Locale, Messages> = { en: webEn, fr: webFr, es: webEs };

export function isLocale(value: unknown): value is Locale {
  return (LOCALES as readonly unknown[]).includes(value);
}

/** Discord locale ("fr", "es-ES", "en-US") to one of ours, English otherwise. */
export function toLocale(discordLocale: string | null | undefined): Locale {
  const base = discordLocale?.split("-")[0];
  return isLocale(base) ? base : "en";
}

function lookup(messages: Messages, key: string): string | undefined {
  let node: string | Messages | undefined = messages;
  for (const part of key.split(".")) {
    if (typeof node !== "object") return undefined;
    node = node[part];
  }
  return typeof node === "string" ? node : undefined;
}

function format(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, name: string) => (name in vars ? String(vars[name]) : match));
}

/** Bot message, falls back to English then to the key. A `count` var picks `key_one` or `key_other` when they exist. */
export function t(locale: Locale, key: string, vars: Record<string, string | number> = {}): string {
  const plural = typeof vars.count === "number" ? `${key}_${vars.count === 1 ? "one" : "other"}` : null;
  const template =
    (plural && (lookup(BOT[locale], plural) ?? lookup(BOT.en, plural))) ?? lookup(BOT[locale], key) ?? lookup(BOT.en, key) ?? key;
  return format(template, vars);
}

export type LabelGroup = "regions" | "roles" | "staffRoles" | "levels" | "igl" | "rosterSpots" | "compensation" | "lan" | "ageGroups" | "minorsPolicy";

/** Label of a closed list value, as shown on the site. */
export function label(locale: Locale, group: LabelGroup, value: string): string {
  return lookup(WEB[locale], `${group}.${value}`) ?? value;
}

export function postTypeLabel(locale: Locale, type: string): string {
  return lookup(WEB[locale], `home.types.${type}.label`) ?? type.toUpperCase();
}

const DISCORD_LOCALES: Record<Exclude<Locale, "en">, DiscordLocale[]> = {
  fr: [DiscordLocale.French],
  es: [DiscordLocale.SpanishES, DiscordLocale.SpanishLATAM],
};

/** English text plus its translations, for command and option descriptions. */
export function localized(key: string): { description: string; description_localizations: LocalizationMap } {
  const description_localizations: LocalizationMap = {};
  for (const [locale, codes] of Object.entries(DISCORD_LOCALES) as [Exclude<Locale, "en">, DiscordLocale[]][]) {
    for (const code of codes) description_localizations[code] = t(locale, key);
  }
  return { description: t("en", key), description_localizations };
}
