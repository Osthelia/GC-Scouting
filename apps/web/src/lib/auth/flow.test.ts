/**
 * GC-Scouting - flow.test
 *
 * Tests for the login flow cookie.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import { decodeFlow, encodeFlow, safeNext, toLocale } from "./flow";
import { toBase64Url } from "./crypto";

test("safeNext keeps same origin paths", () => {
  for (const path of ["/fr", "/en/posts/lft?region=eu", "/es/messages/3#end"]) assert.equal(safeNext(path, "en"), path);
});

test("safeNext sends anything else to the home page", () => {
  for (const next of [null, undefined, "", "fr", "https://evil.example", "//evil.example", "/\\evil.example", "/api/auth/logout", "javascript:alert(1)"]) {
    assert.equal(safeNext(next, "fr"), "/fr");
  }
});

test("toLocale falls back to the default locale", () => {
  assert.equal(toLocale("es"), "es");
  for (const value of ["de", "", null, 1, ["fr"]]) assert.equal(toLocale(value), "en");
});

test("the login flow survives the cookie round trip", () => {
  const flow = { state: "s", verifier: "v", next: "/fr/me", locale: "fr" as const };
  assert.deepEqual(decodeFlow(encodeFlow(flow)), flow);
});

test("a tampered flow cookie is refused or made safe", () => {
  const encode = (value: unknown) => toBase64Url(new TextEncoder().encode(JSON.stringify(value)));
  for (const value of [undefined, "", "%%%", "bm90IGpzb24", encode({ state: "s" }), encode({ state: 1, verifier: "v", next: "/" }), encode(null)]) {
    assert.equal(decodeFlow(value), null, String(value));
  }
  assert.deepEqual(decodeFlow(encode({ state: "s", verifier: "v", next: "//evil.example", locale: "xx" })), { state: "s", verifier: "v", next: "/en", locale: "en" });
});
