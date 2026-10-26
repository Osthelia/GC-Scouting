/**
 * GC-Scouting - post-form.test
 *
 * Tests for the post form validation.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import { DESCRIPTION_MAX, DISPLAY_NAME_MAX, LANGUAGES_MAX, validatePostForm } from "./post-form";

// Server side validation of the post form, fed with what a crafted request could send.

const SLOTS = [
  { day: 0, start: 1200, end: 1380 },
  { day: 2, start: 1200, end: 1380 },
];

function lft(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    type: "lft",
    displayName: "Nyxie",
    region: "eu",
    country: "fr",
    languages: ["fr", "en"],
    rosterSpot: "player",
    roles: ["controller"],
    igl: [],
    compensation: "free",
    lan: "online",
    ageGroup: "",
    rankCurrent: 15,
    rankPeak: 17,
    trackerUrl: "",
    experience: { cash_cup: 12 },
    tierList: { omen: 0, viper: 1 },
    timezone: "Europe/Paris",
    availability: SLOTS,
    rhythmHours: 4,
    rhythmDays: 2,
    description: "Controller main.\nLooking for a team.",
    discord: "123456789012345678",
    discordInvite: "",
    twitter: "",
    email: "",
    agent: false,
    agentName: "",
    agentAgency: "",
    notifyEmail: false,
    notifyDiscord: true,
    chatEnabled: true,
    tweetBy: "site",
    ...overrides,
  };
}

function errors(raw: unknown) {
  const result = validatePostForm(raw);
  assert.equal(result.ok, false, "expected the form to be refused");
  return result.ok ? {} : result.fieldErrors;
}

test("a complete LFT post is accepted and normalized", () => {
  const result = validatePostForm(lft({ discord: " 123456789012345678 ", twitter: "@nyx_ie", email: "Nyx@Example.com" }));
  assert.ok(result.ok);
  assert.equal(result.post.country, "FR");
  assert.equal(result.post.weeklyMinutes, 240);
  assert.equal(result.post.activeDays, 2);
  assert.deepEqual(result.post.contact, { discord: "123456789012345678", twitter: "nyx_ie", email: "nyx@example.com" });
});

test("anything but an object, or an unknown type, is refused", () => {
  for (const raw of [null, undefined, "lft", 42, [], [lft()]]) assert.equal(validatePostForm(raw).ok, false);
  assert.deepEqual(errors(lft({ type: "lfx" })), { displayName: "invalid" });
  assert.deepEqual(errors(lft({ type: ["lft"] })), { displayName: "invalid" });
});

test("fields of other types are dropped", () => {
  const result = validatePostForm(
    lft({ type: "lfo", rosterSpot: "sub", roles: ["duelist"], tierList: { jett: 0 }, lan: "lan", minorsAccepted: true, rankCurrent: 3, trackerUrl: "x", playersWanted: 3 }),
  );
  assert.ok(result.ok);
  const { rosterSpot, roles, tierList, lan, minorsAccepted, rankCurrent, trackerRiotId, playersWanted } = result.post;
  assert.deepEqual({ rosterSpot, roles, tierList, lan, minorsAccepted, rankCurrent, trackerRiotId, playersWanted }, {
    rosterSpot: null,
    roles: [],
    tierList: {},
    lan: null,
    minorsAccepted: null,
    rankCurrent: null,
    trackerRiotId: null,
    playersWanted: null,
  });
});

test("values outside the lists are refused", () => {
  assert.equal(errors(lft({ region: "mars" })).region, "invalid");
  assert.equal(errors(lft({ region: "" })).region, "required");
  assert.equal(errors(lft({ country: "ZZ" })).country, "invalid");
  assert.equal(errors(lft({ languages: ["fr", "klingon"] })).languages, "invalid");
  assert.equal(errors(lft({ languages: [] })).languages, "required");
  assert.equal(errors(lft({ languages: ["en", "fr", "es", "de", "it", "pt"].slice(0, LANGUAGES_MAX + 1) })).languages, "tooMany");
  assert.equal(errors(lft({ roles: ["support"] })).roles, "invalid");
  assert.equal(errors(lft({ compensation: "maybe" })).compensation, "invalid");
  assert.equal(errors(lft({ tweetBy: "bot" })).tweetBy, "invalid");
  assert.equal(errors(lft({ experience: { worlds: 12 } })).experience, "invalid");
  assert.equal(errors(lft({ experience: { cash_cup: 7 } })).experience, "invalid");
});

test("hostile shapes are refused without throwing", () => {
  assert.equal(errors(lft({ languages: Array(10_000).fill("fr") })).languages, "invalid");
  assert.equal(errors(lft({ roles: "controller" })).roles, "invalid");
  assert.equal(errors(lft({ tierList: JSON.parse('{"__proto__": 0}') })).tierList, "invalid");
  assert.equal(errors(lft({ tierList: { omen: 3 } })).tierList, "invalid");
  assert.equal(errors(lft({ tierList: { omen: 0.5 } })).tierList, "invalid");
  assert.equal(errors(lft({ tierList: {} })).tierList, "tierEmpty");
  assert.equal(errors(lft({ rankCurrent: "15" })).rankCurrent, "invalid");
  assert.equal(errors(lft({ rankCurrent: 999 })).rankCurrent, "invalid");
  assert.equal(errors(lft({ chatEnabled: "true" })).chatEnabled, "invalid");
  assert.equal(errors(lft({ agent: 1 })).agent, "invalid");
  assert.equal(errors(lft({ notifyEmail: "yes" })).notifyEmail, "invalid");
  assert.equal(errors(lft({ availability: Array(200).fill(SLOTS[0]) })).availability, "slotInvalid");
});

test("free text is bounded and cleaned", () => {
  assert.equal(errors(lft({ displayName: "   " })).displayName, "required");
  assert.equal(errors(lft({ displayName: "x".repeat(DISPLAY_NAME_MAX + 1) })).displayName, "tooLong");
  assert.equal(errors(lft({ displayName: "Ny‮xie" })).displayName, "invalidCharacters");
  assert.equal(errors(lft({ description: "x".repeat(DESCRIPTION_MAX + 1) })).description, "tooLong");
  assert.equal(errors(lft({ description: "hi​dden" })).description, "invalidCharacters");
  assert.equal(errors(lft({ agent: true, agentName: "" })).agentName, "required");
});

test("contacts only take plain values", () => {
  assert.equal(errors(lft({ email: "a@b.co?subject=hi" })).email, "emailInvalid");
  assert.equal(errors(lft({ email: '"a"@b.co' })).email, "emailInvalid");
  assert.equal(errors(lft({ email: "a@b.co&x" })).email, "emailInvalid");
  assert.equal(errors(lft({ discord: "nyxie" })).discord, "discordInvalid", "a username is not an ID");
  assert.equal(errors(lft({ discord: "1234" })).discord, "discordInvalid");
  assert.equal(errors(lft({ twitter: "nyx xie" })).twitter, "twitterInvalid");
  assert.equal(errors(lft({ discord: "", chatEnabled: false })).contact, "contactRequired");
  assert.ok(validatePostForm(lft({ discord: "" })).ok, "the chat alone is a way to be reached");
});

test("teams can add a Discord invite, only its code is kept", () => {
  const lfp = (overrides: Record<string, unknown>) => ({ ...lft({ type: "lfp", displayName: "Team", rankCurrent: null, rankPeak: null, tierList: {}, rosterSpot: "player", playersWanted: 1, subsWanted: 0, minorsAccepted: true }), ...overrides });
  for (const url of ["https://discord.gg/AbC-12", "discord.com/invite/AbC-12", "https://www.discord.com/invite/AbC-12/"]) {
    const result = validatePostForm(lfp({ discordInvite: url }));
    assert.ok(result.ok, url);
    assert.equal(result.post.contact.discordInvite, "AbC-12");
  }
  for (const url of ["https://discord.gg/", "https://evil.gg/AbC", "https://discord.com/users/123", "https://discord.gg/AbC/extra", "https://discord.gg/a"]) {
    assert.equal(errors(lfp({ discordInvite: url })).discordInvite, "discordInviteInvalid", url);
  }
  const player = validatePostForm(lft({ discordInvite: "https://discord.gg/AbC" }));
  assert.ok(player.ok);
  assert.equal(player.post.contact.discordInvite, undefined, "players have no server invite");
});

test("business rules are enforced", () => {
  assert.equal(errors(lft({ rankPeak: 10 })).rankPeak, "peakBelowCurrent");
  assert.equal(errors(lft({ rhythmHours: 20 })).rhythmHours, "rhythmAboveAvailability");
  assert.equal(errors(lft({ rhythmDays: 3 })).rhythmDays, "rhythmAboveAvailability");
  assert.equal(errors(lft({ rhythmDays: null })).rhythmDays, "required");
  assert.equal(errors(lft({ availability: [] })).availability, "required");
  assert.equal(errors(lft({ availability: [SLOTS[0], { day: 0, start: 1290, end: 1410 }] })).availability, "slotOverlap");
  assert.equal(errors(lft({ availability: [{ day: 7, start: 0, end: 60 }] })).availability, "slotInvalid");
  assert.equal(errors(lft({ availability: [{ day: 0, start: 60, end: 60 }] })).availability, "slotInvalid");
  assert.equal(errors(lft({ timezone: "Mars/Olympus" })).timezone, "invalid");
  assert.equal(errors(lft({ type: "lfp", playersWanted: 0, subsWanted: 0, minorsAccepted: true })).playersWanted, "wantedEmpty");
  assert.equal(errors(lft({ type: "lfp", playersWanted: 1, subsWanted: 0, minorsAccepted: true, rankMin: 10, rankMax: 5 })).rankMax, "rangeOrder");
});

test("an LFO post may skip the availability", () => {
  const result = validatePostForm(lft({ type: "lfo", availability: [], rhythmHours: null, rhythmDays: null }));
  assert.ok(result.ok);
  assert.equal(result.post.weeklyMinutes, 0);
});
