/**
 * GC-Scouting - text-input
 *
 * Server side cleanup of free text.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

// Server side cleanup of free text: NFC, and no control, bidi or zero width characters
// (they break layouts in Discord and on share images, fake other names or hide words from the automod).

// The zero width joiner of emoji sequences (👩‍💻) and the tags of subdivision flags (🏴󠁧󠁢󠁳󠁣󠁴󠁿) are kept.
const EMOJI_JOINER = /(?<=\p{Extended_Pictographic}[\u{FE0F}\u{1F3FB}-\u{1F3FF}]?)‍(?=\p{Extended_Pictographic})/gu;
const FLAG_TAGS = /(?<=\u{1F3F4})[\u{E0020}-\u{E007F}]+/gu;
const FORMAT = /\p{Cf}/u;
const CONTROL = /\p{Cc}/u;
const CONTROL_BUT_NEWLINE = /(?!\n)\p{Cc}/u;

/** Trimmed NFC text, or `invalid` when it holds a forbidden character. `multiline` allows line breaks. */
export function cleanText(raw: unknown, { multiline = false } = {}): { text: string; invalid: boolean } {
  const text = typeof raw === "string" ? raw.replace(/\r\n/g, "\n").normalize("NFC").trim() : "";
  const visible = text.replace(EMOJI_JOINER, "").replace(FLAG_TAGS, "");
  const invalid = FORMAT.test(visible) || (multiline ? CONTROL_BUT_NEWLINE : CONTROL).test(visible);
  return { text, invalid };
}
