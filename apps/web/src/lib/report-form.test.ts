/**
 * GC-Scouting - report-form.test
 *
 * Tests for the report form validation.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import { REPORT_MESSAGE_MAX, REPORT_MESSAGE_MIN } from "@scouting/db/constants";
import { validateReport } from "./report-form";

test("a known reason, with or without a message, is accepted", () => {
  assert.deepEqual(validateReport({ reason: "spam" }), { ok: true, reason: "spam", message: "" });
  assert.deepEqual(validateReport({ reason: "fake", message: "  This team does not exist.  " }), { ok: true, reason: "fake", message: "This team does not exist." });
});

test("the reason must come from the list", () => {
  for (const raw of [null, "spam", [], {}, { reason: "SPAM" }, { reason: ["spam"] }]) {
    assert.deepEqual(validateReport(raw), { ok: false, errors: { reason: "required" } });
  }
});

test("the message is bounded and cleaned", () => {
  const errors = (raw: unknown) => {
    const result = validateReport(raw);
    return result.ok ? null : result.errors.message;
  };
  assert.equal(errors({ reason: "other" }), "required");
  assert.equal(errors({ reason: "spam", message: "x".repeat(REPORT_MESSAGE_MIN - 1) }), "tooShort");
  assert.equal(errors({ reason: "spam", message: "x".repeat(REPORT_MESSAGE_MAX + 1) }), "tooLong");
  assert.equal(errors({ reason: "spam", message: "Look at \u202Ethis post" }), "invalidCharacters");
  // Not a string: read as no message.
  assert.equal(errors({ reason: "spam", message: 42 }), null);
});
