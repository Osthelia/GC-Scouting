/**
 * GC-Scouting - crypto.test
 *
 * Tests for the crypto helpers.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import { fromBase64Url, pkceChallenge, randomToken, sha256Hex, toBase64Url } from "./crypto";

// The key is read once, on first use: set before any call.
process.env.TOKEN_ENCRYPTION_KEY = toBase64Url(crypto.getRandomValues(new Uint8Array(32)));
const { decryptSecret, encryptSecret } = await import("./crypto");

test("base64url round trips any bytes", () => {
  const bytes = crypto.getRandomValues(new Uint8Array(257));
  assert.deepEqual(fromBase64Url(toBase64Url(bytes)), bytes);
  assert.match(toBase64Url(bytes), /^[A-Za-z0-9_-]+$/);
});

test("random tokens are 256 bits, url safe and unique", () => {
  const tokens = new Set(Array.from({ length: 100 }, () => randomToken()));
  assert.equal(tokens.size, 100);
  for (const token of tokens) assert.match(token, /^[A-Za-z0-9_-]{43}$/);
});

test("hashes match the known vectors", async () => {
  assert.equal(await sha256Hex("abc"), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  // RFC 7636, appendix B.
  assert.equal(await pkceChallenge("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"), "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");
});

test("secrets round trip, with a new IV each time", async () => {
  const first = await encryptSecret("refresh-token");
  const second = await encryptSecret("refresh-token");
  assert.notEqual(first, second);
  assert.match(first, /^v1\.[A-Za-z0-9_-]{16}\.[A-Za-z0-9_-]+$/);
  assert.equal(await decryptSecret(first), "refresh-token");
  assert.equal(await decryptSecret(await encryptSecret("")), "");
});

test("a tampered or unknown secret is refused", async () => {
  const stored = await encryptSecret("refresh-token");
  const [version, iv, cipher] = stored.split(".") as [string, string, string];
  const flipped = toBase64Url(fromBase64Url(cipher).map((b, i) => (i === 0 ? b ^ 1 : b)));
  await assert.rejects(decryptSecret(`${version}.${iv}.${flipped}`));
  await assert.rejects(decryptSecret(`v2.${iv}.${cipher}`), /Unknown secret format/);
  await assert.rejects(decryptSecret("plain"), /Unknown secret format/);
});
