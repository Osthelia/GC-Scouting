/**
 * GC-Scouting - readyz route
 *
 * Readiness probe: the database answers, otherwise the pod receives no traffic.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

import { sql } from "drizzle-orm";
import { db } from "@scouting/db/client";
import { loggable } from "@scouting/db/log";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await db.execute(sql`select 1`);
    return new Response("ok", { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[readyz] database unavailable", loggable(error));
    return new Response("database unavailable", { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
