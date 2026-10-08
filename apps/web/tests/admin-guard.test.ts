/**
 * GC-Scouting - admin-guard.test
 *
 * Checks that the admin area stays closed to forged requests.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

import assert from "node:assert/strict";
import { test } from "node:test";

// Runs against a live server (`npm run dev` or `npm run preview`).
const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";

// Router state that claims the admin layout is already rendered, so Next skips it and only renders the page.
const FORGED_TREE = encodeURIComponent(JSON.stringify(["", { children: [["locale", "en", "d", null], { children: ["admin", { children: ["__PAGE__", {}] }] }] }]));

async function forgedRscRequest(path: string): Promise<string> {
  const res = await fetch(`${BASE_URL}${path}`, { headers: { RSC: "1", "Next-Router-State-Tree": FORGED_TREE }, redirect: "follow" });
  return res.text();
}

for (const page of ["users", "conversations", "conversations/1", "reports", "message-reports", "automod", "posts", "access", "users/1"]) {
  test(`a forged RSC request on /admin/${page} without a session gets no data`, async () => {
    const body = await forgedRscRequest(`/en/admin/${page}`);
    assert.match(body, /NEXT_REDIRECT;replace;\/api\/auth\/login/);
    assert.doesNotMatch(body, /"gcsUserId"|"href":"(\/en)?\/admin\/(users|conversations)\/[^"]+"/);
  });
}
