/**
 * GC-Scouting - cron
 *
 * Authorization of the cron endpoints.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

import { sha256Hex } from "@/lib/auth/crypto";

/** Bearer `CRON_SECRET`, sent by the Worker cron trigger (`custom-worker.ts`). */
export async function cronAuthorized(request: Request): Promise<boolean> {
  const secret = process.env.CRON_SECRET;
  const header = request.headers.get("authorization");
  if (!secret || !header?.startsWith("Bearer ")) return false;
  // Hashes have a fixed length, the comparison leaks nothing about the secret.
  return (await sha256Hex(header.slice(7))) === (await sha256Hex(secret));
}
