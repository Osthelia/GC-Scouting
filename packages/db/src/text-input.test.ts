/**
 * GC-Scouting - text-input.test
 *
 * Tests for the text cleanup.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import { cleanText } from "./text-input";

test("text is trimmed and normalized", () => {
  assert.deepEqual(cleanText("  Cafe\u0301  "), { text: "Café", invalid: false });
  assert.deepEqual(cleanText("a\r\nb", { multiline: true }), { text: "a\nb", invalid: false });
});

test("anything but a string becomes empty", () => {
  for (const raw of [undefined, null, 42, ["a"], { a: 1 }]) assert.deepEqual(cleanText(raw), { text: "", invalid: false });
});

test("bidi, zero width and control characters are refused", () => {
  for (const raw of ["a\u202Eb", "a\u200Bb", "a\u2066b", "a\uFEFFb", "a\u0000b", "a\u0007b", "a\tb"]) {
    assert.equal(cleanText(raw).invalid, true, JSON.stringify(raw));
  }
});

test("line breaks are allowed in multiline text only", () => {
  assert.equal(cleanText("a\nb").invalid, true);
  assert.equal(cleanText("a\nb", { multiline: true }).invalid, false);
  assert.equal(cleanText("a\u0000\nb", { multiline: true }).invalid, true);
});

test("emoji sequences and subdivision flags are kept", () => {
  for (const raw of ["👩‍💻", "👨🏽‍🚀", "🏳️‍🌈", "🏴󠁧󠁢󠁳󠁣󠁴󠁿"]) assert.deepEqual(cleanText(raw), { text: raw, invalid: false });
  // A joiner between letters is not part of an emoji.
  assert.equal(cleanText("a\u200Db").invalid, true);
});
