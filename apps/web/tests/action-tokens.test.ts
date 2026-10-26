/**
 * GC-Scouting - action-tokens.test
 *
 * Integration tests for the renew and delete action tokens.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { eq } from "drizzle-orm";
import { closeTestDatabase, useTestDatabase } from "./test-db";

// Renew and delete links of the expiry reminder: single use, even when clicked twice at once.

await useTestDatabase();
const { db } = await import("@scouting/db/client");
const { actionTokens, posts, users, DAY_MS } = await import("@scouting/db");
const { randomToken, sha256Hex } = await import("@/lib/auth/crypto");
const { consumeActionToken } = await import("@/lib/post-expiry");

let authorId: string;

before(async () => {
  const [user] = await db.insert(users).values({ gcsUserId: "gcs-test", username: "tester" }).returning({ id: users.id });
  authorId = user!.id;
});

after(closeTestDatabase);

async function createPost(overrides: Partial<typeof posts.$inferInsert> = {}): Promise<number> {
  const [post] = await db
    .insert(posts)
    .values({ authorId, type: "lfs", displayName: "Nova", region: "eu", languages: ["en"], timezone: "UTC", expiresAt: new Date(Date.now() + 2 * DAY_MS), ...overrides })
    .returning({ id: posts.id });
  return post!.id;
}

async function createToken(postId: number, action: "renew" | "delete", expiresAt = new Date(Date.now() + DAY_MS)): Promise<string> {
  const token = randomToken();
  await db.insert(actionTokens).values({ postId, action, tokenHash: await sha256Hex(token), expiresAt });
  return token;
}

async function postRow(id: number) {
  const [row] = await db.select().from(posts).where(eq(posts.id, id));
  return row!;
}

test("a renew link pushes the expiry back once", async () => {
  const postId = await createPost();
  const token = await createToken(postId, "renew");
  const result = await consumeActionToken(token);
  assert.ok(result.ok && result.action === "renew");
  assert.ok((await postRow(postId)).expiresAt.getTime() > Date.now() + 9 * DAY_MS);
  assert.deepEqual(await consumeActionToken(token), { ok: false, error: "used" });
});

test("two clicks at once run the action a single time", async () => {
  const postId = await createPost();
  const token = await createToken(postId, "renew");
  const results = await Promise.all(Array.from({ length: 5 }, () => consumeActionToken(token)));
  assert.equal(results.filter((r) => r.ok).length, 1);
  assert.ok(results.every((r) => r.ok || r.error === "used"));
});

test("a delete link removes the post and revokes its other links", async () => {
  const postId = await createPost();
  const renew = await createToken(postId, "renew");
  const remove = await createToken(postId, "delete");
  assert.deepEqual(await consumeActionToken(remove), { ok: true, action: "delete", postId });
  const row = await postRow(postId);
  assert.equal(row.status, "removed");
  assert.ok(row.deletedAt);
  assert.deepEqual(await consumeActionToken(renew), { ok: false, error: "used" });
});

test("expired, malformed and unknown links do nothing", async () => {
  const postId = await createPost();
  const expiresAt = (await postRow(postId)).expiresAt;
  assert.deepEqual(await consumeActionToken(await createToken(postId, "renew", new Date(Date.now() - 1000))), { ok: false, error: "expired" });
  assert.deepEqual(await consumeActionToken("short"), { ok: false, error: "invalid" });
  assert.deepEqual(await consumeActionToken("x".repeat(43)), { ok: false, error: "invalid" });
  assert.deepEqual((await postRow(postId)).expiresAt, expiresAt);
});

test("a link of a post closed in the meantime is unavailable", async () => {
  const postId = await createPost({ status: "closed" });
  assert.deepEqual(await consumeActionToken(await createToken(postId, "renew")), { ok: false, error: "unavailable" });
});

test("renewing past the online posts limit keeps the link usable", async () => {
  const expired = await createPost({ expiresAt: new Date(Date.now() - DAY_MS) });
  const token = await createToken(expired, "renew");
  // The earlier tests left this author with online LFS posts: fill up to the limit of 5.
  const online = await db.select({ id: posts.id }).from(posts).where(eq(posts.status, "active"));
  const others = await Promise.all(Array.from({ length: Math.max(0, 6 - online.length) }, () => createPost()));

  assert.deepEqual(await consumeActionToken(token), { ok: false, error: "limitReached" });
  await db.update(posts).set({ status: "closed" }).where(eq(posts.id, others[0] ?? online.find((p) => p.id !== expired)!.id));
  assert.ok((await consumeActionToken(token)).ok);
});
