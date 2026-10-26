/**
 * GC-Scouting - report-form
 *
 * Server side validation of the report form.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

import { REPORT_MESSAGE_MAX, REPORT_MESSAGE_MIN, REPORT_REASONS, type ReportReason } from "@scouting/db/constants";
import { cleanText } from "@scouting/db/text-input";

// Report form shared by posts and chat messages.

export type ReportFieldErrors = { reason?: "required"; message?: "required" | "tooShort" | "tooLong" | "invalidCharacters" };

export function validateReport(raw: unknown): { ok: true; reason: ReportReason; message: string } | { ok: false; errors: ReportFieldErrors } {
  const input = (raw && typeof raw === "object" ? raw : {}) as { reason?: unknown; message?: unknown };
  const errors: ReportFieldErrors = {};
  const reason = REPORT_REASONS.find((r) => r === input.reason);
  if (!reason) errors.reason = "required";

  const { text: message, invalid } = cleanText(input.message, { multiline: true });
  if (invalid) errors.message = "invalidCharacters";
  else if (message.length > REPORT_MESSAGE_MAX) errors.message = "tooLong";
  else if (reason === "other" && !message) errors.message = "required";
  else if (message && message.length < REPORT_MESSAGE_MIN) errors.message = "tooShort";

  return reason && !Object.keys(errors).length ? { ok: true, reason, message } : { ok: false, errors };
}
