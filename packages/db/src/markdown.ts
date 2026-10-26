/**
 * GC-Scouting - markdown
 *
 * Escapes text for Discord markdown.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

// Discord markdown: inline markers, mentions and emojis (`<`), masked links (`[`), quotes and headings.
const INLINE = /([\\*_~`|<>#[\]])/g;
// Line start list markers: "- ", "+ ", "1. ".
const BULLET = /^(\s*)([-+])/gm;
const NUMBERED = /^(\s*\d+)\.(?=\s)/gm;

/** Escapes text typed by users so Discord renders it as written. */
export function escapeMarkdown(text: string): string {
  return text.replace(INLINE, "\\$1").replace(BULLET, "$1\\$2").replace(NUMBERED, "$1\\.");
}
