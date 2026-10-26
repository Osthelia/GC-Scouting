/**
 * GC-Scouting - cron player-links route
 *
 * Cron endpoint that checks the pending player link requests.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

import { NextResponse } from "next/server";
import { cronAuthorized } from "@/lib/cron";
import { checkPendingPlayerLinks } from "@/lib/auth/player-links";

// Hourly job (cluster CronJob): approvals and refusals of pending GC Stats links.

export async function POST(request: Request) {
  if (!(await cronAuthorized(request))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const result = await checkPendingPlayerLinks();
  return NextResponse.json(result);
}
