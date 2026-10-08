/**
 * GC-Scouting - short-link
 *
 * Short post link codes.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

// Short post links (/t/<code>), the code is the post id in base 62. No locale: the site picks the visitor's.

const ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
const CODE_PATTERN = /^[0-9a-zA-Z]{1,9}$/;

export function postShortCode(id: number): string {
  let code = "";
  do {
    code = ALPHABET[id % 62] + code;
    id = Math.floor(id / 62);
  } while (id > 0);
  return code;
}

/** Post id of a code, null when the code is malformed. */
export function postIdFromShortCode(code: string): number | null {
  if (!CODE_PATTERN.test(code)) return null;
  let id = 0;
  for (const char of code) id = id * 62 + ALPHABET.indexOf(char);
  return id > 0 && Number.isSafeInteger(id) ? id : null;
}

export function postShortUrl(appUrl: string, id: number): string {
  return `${appUrl.replace(/\/$/, "")}/t/${postShortCode(id)}`;
}
