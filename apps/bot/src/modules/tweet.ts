/**
 * GC-Scouting - tweet
 *
 * Builds the suggested tweet text of a post.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

import { languageFlag, postShortUrl, TOURNAMENT_LEVELS, type PostType, type Region, type TournamentLevel } from "@scouting/db";
import { isLocale, label, t, type Locale } from "../core/i18n";
import { flagEmoji, postCode, rankLabel, rankShort, truncate } from "./format";
import type { BotPost } from "./posts";

/** Game Changers circuits, MENA plays in EMEA. */
const GC_REGIONS: Record<Region, string> = {
  eu: "EMEA",
  mena: "EMEA",
  na: "NA",
  latam: "LATAM",
  br: "BR",
  apac: "APAC",
  kr: "KR",
  jp: "JP",
  oce: "OCE",
  cn: "CN",
};

type Levels = Record<TournamentLevel, string>;

const LEVELS: Levels = { main_event: "Main event", playoffs: "OQ Playoffs", cash_cup: "Open Qualifiers" };
const LEVELS_SHORT: Levels = { ...LEVELS, cash_cup: "OQ" };

export const TWEET_MAX = 280;
/** Every link counts as this many characters, whatever its length. */
const TWEET_URL_LENGTH = 23;
/** Tried in order until the tweet fits: the link phrase is shortened first, then "Open Qualifiers". */
const VARIANTS = [
  { phrase: "tweet.contact", levels: LEVELS },
  { phrase: "tweet.contactShort", levels: LEVELS },
  { phrase: "tweet.contactShort", levels: LEVELS_SHORT },
] as const;

/** Longest first sentence of the description kept in a tweet. */
const SENTENCE_MAX = 140;

/** "2 years", "6 months": whole years when it falls right. */
function shortDuration(locale: Locale, months: number): string {
  return months >= 12 && months % 12 === 0 ? t(locale, "tweet.years", { count: months / 12 }) : t(locale, "tweet.months", { count: months });
}

/** Two highest levels played: "Main event (2 years), Open Qualifiers (6 months)". */
function experience(locale: Locale, post: BotPost, levels: Levels): string | null {
  const parts = [...TOURNAMENT_LEVELS]
    .reverse()
    .filter((level) => (post.experience[level] ?? 0) > 0)
    .slice(0, 2)
    .map((level) => `${levels[level]} (${shortDuration(locale, post.experience[level]!)})`);
  return parts.length ? parts.join(", ") : null;
}

/**
 * Text typed by the author, made safe for the official account: links are removed, mentions, hashtags
 * and cashtags lose their sign, and a bare domain gets a dot leader ("site․com") so it is not linked.
 */
function neutralize(text: string): string {
  return text
    .replace(/(?:https?:\/\/|www\.)\S+/gi, "")
    .replace(/[@#$＠＃](?=[\p{L}\p{N}_])/gu, "")
    .replace(/(?<=[\p{L}\p{N}-])\.(?=[a-z]{2,}\b)/giu, "․")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/** First sentence of the description, on its first line. */
function firstSentence(post: BotPost): string | null {
  const line = neutralize(post.description.trim().split(/\r?\n/)[0]!);
  const sentence = line.match(/^.+?[.!?](?=\s|$)/)?.[0] ?? line;
  return sentence ? truncate(sentence, SENTENCE_MAX) : null;
}

/** "Ascendant 1 (Peak I2)", the peak only when higher than the current rank. */
function playerRank(locale: Locale, post: BotPost): string | null {
  if (post.rankCurrent === null) return null;
  const peak = post.rankPeak !== null && post.rankPeak > post.rankCurrent ? ` (${t(locale, "tweet.peak", { rank: rankShort(post.rankPeak) })})` : "";
  return rankLabel(post.rankCurrent) + peak;
}

function wantedRank(locale: Locale, post: BotPost): string | null {
  if (post.rankMin === null && post.rankMax === null) return null;
  if (post.rankMin !== null && post.rankMax !== null) return t(locale, "tweet.rankRange", { min: rankShort(post.rankMin), max: rankShort(post.rankMax) });
  return post.rankMin !== null ? t(locale, "tweet.rankFrom", { rank: rankShort(post.rankMin) }) : t(locale, "tweet.rankUpTo", { rank: rankShort(post.rankMax!) });
}

function rhythm(locale: Locale, post: BotPost): string | null {
  if (post.weeklyMinutes === 0) return null;
  return t(locale, "tweet.rhythm", { hours: Math.round((post.weeklyMinutes / 60) * 10) / 10, count: post.activeDays });
}

/** "Looking for 2 players & 1 sub". */
function wanted(locale: Locale, post: BotPost): string | null {
  const players = post.playersWanted ?? 0;
  const subs = post.subsWanted ?? 0;
  const parts = [players > 0 && t(locale, "tweet.players", { count: players }), subs > 0 && t(locale, "tweet.subs", { count: subs })].filter((p): p is string => !!p);
  return parts.length ? t(locale, "tweet.lookingFor", { wanted: parts.join(" & ") }) : null;
}

/** Player or team name, with its Twitter handle unless the contact reaches an agent. */
function author(post: BotPost): string {
  const name = neutralize(post.displayName);
  return post.contact.twitter && !post.contact.agent ? `${name} (@${post.contact.twitter})` : name;
}

const slashed = (values: string[]) => (values.length ? values.join("/") : null);

/** Bullet lines, per post type. */
function details(locale: Locale, post: BotPost, levels: Levels): (string | null)[] {
  const sub = post.rosterSpot === "sub" ? t(locale, "tweet.sub") : null;
  const roles = slashed([...post.roles.map((r) => label(locale, "roles", r)), ...post.igl.map((r) => label(locale, "igl", r))]);
  const staff = slashed(post.staffRoles.map((r) => label(locale, "staffRoles", r)));
  const xp = experience(locale, post, levels);

  const byType: Record<PostType, (string | null)[]> = {
    lft: [sub, playerRank(locale, post), roles, xp],
    lfp: [wantedRank(locale, post), roles, xp, rhythm(locale, post)],
    lfs: [staff, xp, rhythm(locale, post)],
    lfo: [xp, rhythm(locale, post)],
    lfst: [staff, xp, rhythm(locale, post)],
  };
  return byType[post.type];
}

/** Characters counted by Twitter: links count 23, emojis and most non latin characters count 2. */
export function tweetLength(text: string): number {
  let length = 0;
  const withoutUrls = text.replace(/https?:\/\/\S+/g, () => {
    length += TWEET_URL_LENGTH;
    return "";
  });
  for (const { segment } of new Intl.Segmenter().segment(withoutUrls)) {
    if (/\p{Extended_Pictographic}|\p{Regional_Indicator}/u.test(segment)) {
      length += 2;
      continue;
    }
    for (const char of segment) {
      const code = char.codePointAt(0)!;
      const light = code <= 0x10ff || (code >= 0x2000 && code <= 0x200d) || (code >= 0x2010 && code <= 0x201f) || (code >= 0x2032 && code <= 0x2037);
      length += light ? 1 : 2;
    }
  }
  return length;
}

export type TweetDraft = { text: string; length: number; tooLong: boolean };

/** Language of the tweet: the only language spoken when we write it, English otherwise. */
export function tweetLocale(post: BotPost): Locale {
  const [only, ...others] = post.languages;
  return !others.length && isLocale(only) ? only : "en";
}

/** Languages the author may tweet in: English or one of theirs, when they speak several but not English. */
export function tweetLocales(post: BotPost): Locale[] {
  if (post.languages.length < 2 || post.languages.includes("en")) return [tweetLocale(post)];
  return ["en", ...post.languages.filter(isLocale)];
}

/**
 * "LFT GC EMEA 🇫🇷🇬🇧", the author, the details as bullets, then the link. Shortened to fit, see `VARIANTS`.
 * LFO: no name, the first sentence of the description instead.
 * `byAuthor`: tweeted from the author's own account, without their name.
 */
export function tweetDraft(post: BotPost, appUrl: string, { byAuthor = false, locale = tweetLocale(post) }: { byAuthor?: boolean; locale?: Locale } = {}): TweetDraft {
  const flags = [...new Set(post.languages.map((code) => flagEmoji(languageFlag(code))))].join("");
  const lfo = post.type === "lfo";
  const head = [
    `${postCode(post.type)} GC ${GC_REGIONS[post.region]} ${flags}`.trim(),
    byAuthor || lfo ? null : author(post),
    post.type === "lfp" ? wanted(locale, post) : null,
    lfo ? firstSentence(post) : null,
  ];
  const url = postShortUrl(appUrl, post.id);

  let draft: TweetDraft | null = null;
  for (const { phrase, levels } of VARIANTS) {
    const body = details(locale, post, levels)
      .filter((line): line is string => !!line)
      .map((line) => `- ${line}`);
    const text = [...head.filter((line): line is string => !!line), ...(body.length ? ["", ...body] : []), "", `${t(locale, phrase)} ${url}`].join("\n");
    const length = tweetLength(text);
    draft = { text, length, tooLong: length > TWEET_MAX };
    if (!draft.tooLong) break;
  }
  return draft!;
}
