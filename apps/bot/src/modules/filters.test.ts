/**
 * GC-Scouting - filters.test
 *
 * Tests for the filter link parsing.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import { matchesFilters } from "@scouting/db/filters";
import { decodeFilterDraft, describeFilters, encodeFilterDraft, filtersFromLink, filtersLink } from "./filters";

const APP_URL = "https://scouting.gc-stats.app";

test("reads the type from the path and the filters from the query", () => {
  const result = filtersFromLink(`${APP_URL}/fr/posts/lft?regions=eu,na&rankMin=gold_1`, APP_URL);
  assert.ok(result.ok);
  assert.deepEqual(result.filters, { types: ["lft"], regions: ["eu", "na"], rankMin: 9 });
  assert.deepEqual(result.ignored, []);
});

test("reports dropped params", () => {
  const result = filtersFromLink(`${APP_URL}/en/posts/lfp?regions=eu,mars&utm_source=x`, APP_URL);
  assert.ok(result.ok);
  assert.deepEqual(result.filters.regions, ["eu"]);
  assert.deepEqual(result.ignored, ["utm_source"]);
});

test("rejects other sites and other pages", () => {
  assert.deepEqual(filtersFromLink("not a url", APP_URL), { ok: false, error: "invalidUrl" });
  assert.deepEqual(filtersFromLink("https://example.com/en/posts/lft", APP_URL), { ok: false, error: "wrongSite" });
  assert.deepEqual(filtersFromLink(`${APP_URL}/en/account`, APP_URL), { ok: false, error: "notPostsPage" });
  assert.deepEqual(filtersFromLink(`${APP_URL}/en/posts/xyz`, APP_URL), { ok: false, error: "notPostsPage" });
  assert.deepEqual(filtersFromLink(`${APP_URL}/en/posts/lft/12`, APP_URL), { ok: false, error: "notPostsPage" });
});

test("builds the site link back and describes the filters", () => {
  const filters = { types: ["lft" as const], regions: ["eu" as const] };
  assert.equal(filtersLink(APP_URL, "fr", filters), `${APP_URL}/fr/posts/lft?regions=eu`);
  assert.deepEqual(describeFilters("fr", filters), ["**Types** LFT", "**Régions** Europe"]);
  assert.deepEqual(describeFilters("en", {}), ["Every post"]);
});

test("matches the age of a LFT and the minors policy of team posts", () => {
  const base = {
    displayName: "x", region: "eu", languages: ["en"], roles: [], igl: [], rosterSpot: null, playersWanted: null, subsWanted: null, staffRoles: [],
    compensation: null, lan: null, rankCurrent: null, rankMin: null, rankMax: null, experience: {}, tournamentLevels: [], strongAgents: [], weeklyMinutes: 0, activeDays: 0, availabilityUtc: [],
  } as const;
  const lft = (ageGroup: "minor" | "adult" | null) => ({ ...base, type: "lft" as const, ageGroup, minorsAccepted: null });
  const lfp = (minorsAccepted: boolean | null) => ({ ...base, type: "lfp" as const, ageGroup: null, minorsAccepted });

  assert.ok(matchesFilters(lft("minor"), { ages: ["minor"] }));
  assert.ok(!matchesFilters(lft("adult"), { ages: ["minor"] }));
  assert.ok(!matchesFilters(lft(null), { ages: ["adult"] }));
  assert.ok(matchesFilters(lfp(true), { ages: ["minor"] }));
  assert.ok(!matchesFilters(lfp(false), { ages: ["minor"] }));
  assert.ok(!matchesFilters(lfp(null), { ages: ["minor"] }));
  assert.ok(matchesFilters(lfp(false), { ages: ["adult"] }));
  assert.deepEqual(filtersFromLink(`${APP_URL}/fr/posts/lfp?ages=minor,teen`, APP_URL), { ok: true, filters: { types: ["lfp"], ages: ["minor"] }, ignored: [] });
});

test("matches the deal and LAN of a post, posts made before them only without the filter", () => {
  const base = {
    displayName: "x", region: "eu", languages: ["en"], roles: [], igl: [], rosterSpot: "player", playersWanted: null, subsWanted: null, staffRoles: [],
    ageGroup: null, minorsAccepted: null, rankCurrent: null, rankMin: null, rankMax: null, experience: {}, tournamentLevels: [], strongAgents: [], weeklyMinutes: 0, activeDays: 0, availabilityUtc: [],
  } as const;
  const lft = (compensation: "paid" | "free" | null, lan: "lan" | "online" | null) => ({ ...base, type: "lft" as const, compensation, lan });

  assert.ok(matchesFilters(lft("paid", "lan"), { compensation: ["paid"], lan: ["lan"] }));
  assert.ok(!matchesFilters(lft("free", "lan"), { compensation: ["paid"] }));
  assert.ok(!matchesFilters(lft("paid", "online"), { lan: ["lan"] }));
  assert.ok(!matchesFilters(lft(null, null), { lan: ["lan", "online"] }));
  assert.ok(matchesFilters(lft(null, null), {}));
  assert.deepEqual(filtersFromLink(`${APP_URL}/en/posts/lft?lan=lan,offline`, APP_URL), { ok: true, filters: { types: ["lft"], lan: ["lan"] }, ignored: [] });
});

test("packs the editor draft in a short custom id part", () => {
  const filters = {
    types: ["lft" as const, "lfst" as const],
    regions: ["eu" as const, "cn" as const],
    languages: ["en" as const, "tl" as const],
    agents: ["jett", "sova"],
    rankMin: 0,
    rankMax: 24,
    minMonths: 120,
    minHours: 168,
    lan: ["lan" as const],
    minDays: 7,
  };
  const code = encodeFilterDraft(filters);
  assert.ok(code.length <= 30, code);
  assert.deepEqual(decodeFilterDraft(code), filters);
  assert.deepEqual(decodeFilterDraft(encodeFilterDraft({})), {});
  assert.equal(decodeFilterDraft("not-valid"), null);
});

test("keeps only schema values from a hostile link", () => {
  assert.deepEqual(filtersFromLink(`javascript://scouting.gc-stats.app/en/posts/lft`, APP_URL), { ok: false, error: "invalidUrl" });
  assert.deepEqual(filtersFromLink(`${APP_URL}/en/posts/lft?regions=${"eu,".repeat(1000)}`, APP_URL), { ok: false, error: "invalidUrl" });
  assert.deepEqual(filtersFromLink(`https://scouting.gc-stats.app@evil.com/en/posts/lft`, APP_URL), { ok: false, error: "wrongSite" });

  const injected = encodeURIComponent("eu'); drop table discord_channels;--");
  const result = filtersFromLink(`${APP_URL}/en/posts/lft?regions=${injected},na&agents=jett,<@everyone>&tz=x&days=mon&rankMin=gold_1'--`, APP_URL);
  assert.ok(result.ok);
  assert.deepEqual(result.filters, { types: ["lft"], regions: ["na"], agents: ["jett"] });
});
