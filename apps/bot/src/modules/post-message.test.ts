/**
 * GC-Scouting - post-message.test
 *
 * Tests for the post message layout.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import type { BotPost } from "./posts";
import { postContainer } from "./post-message";
import { escapeMarkdown } from "./format";

function post(overrides: Partial<BotPost>): BotPost {
  return {
    id: 7,
    type: "lft",
    displayName: "Nova",
    region: "eu",
    country: null,
    languages: ["en"],
    roles: [],
    igl: [],
    rosterSpot: null,
    staffRoles: [],
    rankCurrent: null,
    rankPeak: null,
    rankMin: null,
    rankMax: null,
    experience: {},
    tierList: null,
    strongAgents: [],
    compensation: null,
    lan: null,
    ageGroup: null,
    minorsAccepted: null,
    availability: [],
    timezone: "UTC",
    weeklyMinutes: 0,
    activeDays: 0,
    contact: {},
    description: "",
    publishedAt: new Date(0),
    bumpedAt: new Date(0),
    author: { username: "nova", discordId: null },
    ...overrides,
  } as BotPost;
}

/** Every text shown by a component tree. */
function texts(node: unknown): string[] {
  if (Array.isArray(node)) return node.flatMap(texts);
  if (!node || typeof node !== "object") return [];
  const { content, ...rest } = node as { content?: unknown };
  return [...(typeof content === "string" ? [content] : []), ...Object.values(rest).flatMap(texts)];
}

test("escapes Discord markdown in user text", () => {
  assert.equal(escapeMarkdown("[a](https://b)"), "\\[a\\](https://b)");
  assert.equal(escapeMarkdown("# x\n-# y\n- z\n1. w"), "\\# x\n\\-\\# y\n\\- z\n1\\. w");
  assert.equal(escapeMarkdown("<@&1> ||z||"), "\\<@&1\\> \\|\\|z\\|\\|");
  assert.equal(escapeMarkdown("Top 1. Rank 2 - 3"), "Top 1. Rank 2 - 3");
});

test("shows the description literally in the post container", () => {
  const description = "[a](https://b)\n# x\n-# y\n<@&1>\n||z||";
  const content = texts(postContainer(post({ description }), "en", "https://scouting.example")).join("\n");
  assert.ok(content.includes("> \\[a\\](https://b)"));
  assert.ok(content.includes("> \\# x"));
  assert.ok(content.includes("> \\-\\# y"));
  assert.ok(content.includes("> \\<@&1\\>"));
  assert.ok(content.includes("> \\|\\|z\\|\\|"));
  assert.ok(!/(^|[^\\])\[a\]/.test(content));
});
