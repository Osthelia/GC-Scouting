/**
 * GC-Scouting - demo-post
 *
 * Sample post used for previews and the share image.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

import { RANK_KEYS } from "@scouting/db/constants";
import type { ShareImagePost } from "@scouting/db/share-image";
import type { PostView } from "./posts";

export type DemoPost = ShareImagePost &
  Pick<
    PostView,
    | "type"
    | "displayName"
    | "region"
    | "country"
    | "languages"
    | "profile"
    | "gcsSummary"
    | "roles"
    | "staffRoles"
    | "igl"
    | "rosterSpot"
    | "playersWanted"
    | "subsWanted"
    | "minorsAccepted"
    | "experience"
    | "rankCurrent"
    | "rankPeak"
    | "rankMin"
    | "rankMax"
    | "tierList"
    | "strongAgents"
    | "weeklyMinutes"
    | "activeDays"
    | "description"
    | "compensation"
    | "lan"
  >;

// Example post of the home page (hero, tierlist, Discord preview), copied from a real post.
export const DEMO_POST: DemoPost = {
  id: 0,
  type: "lft",
  displayName: "Lacy",
  region: "eu",
  country: "FR",
  languages: ["fr", "en"],
  profile: "verified",
  gcsSummary: { tournaments: 5, bestPlacement: null, teams: [], recentTournaments: [] },
  roles: ["initiator_reveal", "controller", "sentinel"],
  staffRoles: [],
  igl: ["co_igl"],
  rosterSpot: "player",
  playersWanted: null,
  subsWanted: null,
  minorsAccepted: null,
  experience: { cash_cup: 9 },
  rankCurrent: RANK_KEYS.indexOf("ascendant_1"),
  rankPeak: RANK_KEYS.indexOf("ascendant_2"),
  rankMin: null,
  rankMax: null,
  tierList: {
    viper: 0, omen: 0, astra: 0, cypher: 0, vyse: 0,
    brimstone: 1, sova: 1, fade: 1, skye: 1, breach: 1, killjoy: 1,
    harbor: 2, kayo: 2, gekko: 2, sage: 2, deadlock: 2, chamber: 2, tejo: 2, veto: 2, miks: 2, yoru: 2, phoenix: 2,
  },
  strongAgents: ["viper", "omen", "astra", "brimstone", "sova", "fade", "skye", "breach", "cypher", "killjoy", "vyse"],
  weeklyMinutes: 1500,
  activeDays: 6,
  description: "",
  compensation: null,
  lan: null,
};

const NO_PLAYER_FIELDS = {
  profile: "none",
  gcsSummary: null,
  igl: [],
  rankCurrent: null,
  rankPeak: null,
  tierList: null,
  strongAgents: [],
  description: "",
} as const;

/** Fictional team posts, the hero shows one of the three demos at random. */
export const DEMO_LFP: DemoPost = {
  ...NO_PLAYER_FIELDS,
  id: 0,
  type: "lfp",
  displayName: "Nightfall",
  region: "eu",
  country: "ES",
  languages: ["es", "en"],
  roles: ["controller", "initiator_flash"],
  staffRoles: [],
  igl: ["igl"],
  rosterSpot: "player",
  playersWanted: 1,
  subsWanted: 1,
  minorsAccepted: false,
  experience: { cash_cup: 18, playoffs: 6 },
  rankMin: RANK_KEYS.indexOf("diamond_3"),
  rankMax: RANK_KEYS.indexOf("immortal_2"),
  weeklyMinutes: 720,
  activeDays: 4,
  compensation: "free",
  lan: "lan",
};

export const DEMO_LFS: DemoPost = {
  ...NO_PLAYER_FIELDS,
  id: 0,
  type: "lfs",
  displayName: "Aurora Club",
  region: "eu",
  country: "FR",
  languages: ["fr", "en"],
  roles: [],
  staffRoles: ["coach", "analyst"],
  rosterSpot: null,
  playersWanted: null,
  subsWanted: null,
  minorsAccepted: true,
  experience: { cash_cup: 12, playoffs: 12, main_event: 6 },
  rankMin: null,
  rankMax: null,
  weeklyMinutes: 540,
  activeDays: 3,
  compensation: "paid",
  lan: "online",
};

export const HERO_DEMOS: readonly DemoPost[] = [DEMO_POST, DEMO_LFP, DEMO_LFS];
