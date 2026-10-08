/**
 * GC-Scouting - tweet.test
 *
 * Tests for the tweet text builder.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import type { BotPost } from "./posts";
import { parseTweetUrl } from "@scouting/db/twitter";
import { TWEET_MAX, tweetDraft, tweetLength, tweetLocale, tweetLocales } from "./tweet";

const APP_URL = "https://scouting.gc-stats.app";

function post(overrides: Partial<BotPost>): BotPost {
  return {
    id: 42,
    type: "lfp",
    displayName: "Nova",
    region: "eu",
    languages: ["fr", "en"],
    roles: ["duelist", "initiator_reveal"],
    igl: ["igl"],
    rosterSpot: "player",
    playersWanted: 2,
    subsWanted: 1,
    staffRoles: [],
    compensation: null,
    lan: null,
    rankCurrent: null,
    rankPeak: null,
    rankMin: 18,
    rankMax: 19,
    experience: {},
    weeklyMinutes: 600,
    activeDays: 4,
    contact: { twitter: "nova_gc" },
    description: "",
    author: { username: "nova", discordId: null },
    ...overrides,
  } as BotPost;
}

test("counts links, flags and accents like Twitter", () => {
  assert.equal(tweetLength("abc"), 3);
  assert.equal(tweetLength("é"), 1);
  assert.equal(tweetLength("🇫🇷🇬🇧"), 4);
  assert.equal(tweetLength("go https://example.com/a/very/long/path"), 3 + 23);
});

test("LFP: flags in the title, name and handle, wanted counts, bullets and link", () => {
  const { text, tooLong } = tweetDraft(post({}), APP_URL);
  const lines = text.split("\n");
  assert.equal(lines[0], "LFP GC EMEA 🇫🇷🇬🇧");
  assert.equal(lines[1], "Nova (@nova_gc)");
  assert.equal(lines[2], "Looking for 2 players & 1 sub");
  assert.ok(lines.slice(4, -2).every((l) => l.startsWith("- ")));
  assert.match(lines.at(-1)!, /^To contact & get more information -> https:\/\//);
  assert.equal(tooLong, false);
});

test("uses the name when the contact reaches an agent", () => {
  const { text } = tweetDraft(post({ contact: { twitter: "agent", agent: { name: "Bob", agency: null } } }), APP_URL);
  assert.equal(text.split("\n")[1], "Nova");
});

test("shortens the link phrase, then flags a tweet still too long", () => {
  const long = (n: number) => post({ type: "lfs", staffRoles: Array(n).fill("assistant_coach") });
  let n = 1;
  while (!tweetDraft(long(n), APP_URL).text.includes("More info ->")) n++;
  assert.ok(tweetDraft(long(n), APP_URL).length <= TWEET_MAX);

  const draft = tweetDraft(long(40), APP_URL);
  assert.ok(draft.tooLong);
  assert.ok(draft.length > TWEET_MAX);
  assert.match(draft.text, /More info ->/);
});

test("leaves the author out of a tweet posted from their own account", () => {
  const { text } = tweetDraft(post({ contact: { twitter: "nova_gc" } }), APP_URL, { byAuthor: true });
  assert.ok(!text.includes("@nova_gc"));
  assert.ok(!text.includes("Nova\n"));
  assert.ok(text.startsWith("LFP GC EMEA"));
});

test("reads the status id of x.com and twitter.com links", () => {
  assert.equal(parseTweetUrl("https://x.com/nova_gc/status/1843000000000000000"), "1843000000000000000");
  assert.equal(parseTweetUrl("twitter.com/nova_gc/status/123?s=20&t=abc"), "123");
  assert.equal(parseTweetUrl("https://mobile.twitter.com/i/web/status/456/"), "456");
  assert.equal(parseTweetUrl("https://x.com/nova_gc"), null);
  assert.equal(parseTweetUrl("https://evil.com/x.com/a/status/1"), null);
});

test("tweets in English when spoken, in the only language otherwise, English when we do not write it", () => {
  assert.equal(tweetLocale(post({ languages: ["fr", "en"] })), "en");
  assert.equal(tweetLocale(post({ languages: ["fr"] })), "fr");
  assert.equal(tweetLocale(post({ languages: ["de"] })), "en");
  assert.equal(tweetLocale(post({ languages: ["fr", "es"] })), "en");
  assert.equal(tweetLocale(post({ languages: [] })), "en");
  assert.match(tweetDraft(post({ languages: ["fr"] }), APP_URL).text, /Recherche 2 joueur·ses/);
});

test("lets the author pick English or one of their languages when they speak several but not English", () => {
  assert.deepEqual(tweetLocales(post({ languages: ["fr", "es"] })), ["en", "fr", "es"]);
  assert.deepEqual(tweetLocales(post({ languages: ["fr", "de"] })), ["en", "fr"]);
  assert.deepEqual(tweetLocales(post({ languages: ["de", "it"] })), ["en"]);
  assert.deepEqual(tweetLocales(post({ languages: ["fr", "en"] })), ["en"]);
  assert.deepEqual(tweetLocales(post({ languages: ["es"] })), ["es"]);
});

test("LFS and LFST: staff roles, two highest experiences in short, rhythm", () => {
  const experience = { cash_cup: 6, playoffs: 18, main_event: 24 };
  for (const type of ["lfs", "lfst"] as const) {
    const lines = tweetDraft(post({ type, staffRoles: ["coach", "assistant_coach"], experience }), APP_URL).text.split("\n");
    assert.equal(lines[1], "Nova (@nova_gc)");
    assert.deepEqual(lines.slice(3, 6), ["- Coach/Assistant coach", "- Main event (2 years), OQ Playoffs (18 months)", "- 10 h/week over 4 days"]);
  }
});

test("LFP: experience before the rhythm", () => {
  const lines = tweetDraft(post({ experience: { cash_cup: 12 } }), APP_URL).text.split("\n");
  assert.deepEqual(lines.slice(-4, -2), ["- Open Qualifiers (1 year)", "- 10 h/week over 4 days"]);
});

test("writes Open Qualifiers, OQ only once the short link phrase is not enough", () => {
  const long = (n: number) => post({ type: "lfs", staffRoles: Array(n).fill("assistant_coach"), experience: { cash_cup: 6 } });
  let n = 1;
  while (tweetDraft(long(n), APP_URL).text.includes("Open Qualifiers")) {
    assert.ok(!tweetDraft(long(n), APP_URL).tooLong);
    n++;
  }
  const draft = tweetDraft(long(n), APP_URL);
  assert.match(draft.text, /- OQ \(6 months\)/);
  assert.match(draft.text, /More info ->/);
});

test("no mention, hashtag or link taken from the post", () => {
  const named = tweetDraft(post({ displayName: "@x #promo scam.example" }), APP_URL).text;
  assert.ok(!/[@#][a-z]/i.test(named.replace("@nova_gc", "")));
  assert.ok(named.includes("x promo scam․example (@nova_gc)"));

  const description = "Rejoins nous sur https://scam.example @marque. Then more.";
  const lfo = tweetDraft(post({ type: "lfo", description }), APP_URL).text;
  assert.equal(lfo.split("\n")[1], "Rejoins nous sur marque.");
  assert.ok(!lfo.includes("scam"));
});

test("LFO: no name, first sentence of the description, experience and rhythm", () => {
  const description = "Structured org with staff! We pay salaries.\nMore below.";
  const lines = tweetDraft(post({ type: "lfo", description, experience: { cash_cup: 6 } }), APP_URL).text.split("\n");
  assert.deepEqual(lines.slice(0, 6), ["LFO GC EMEA 🇫🇷🇬🇧", "Structured org with staff!", "", "- Open Qualifiers (6 months)", "- 10 h/week over 4 days", ""]);
  assert.equal(tweetDraft(post({ type: "lfo" }), APP_URL).text.split("\n")[1], "");
});
