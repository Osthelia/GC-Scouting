/**
 * GC-Scouting - cron sessions route
 *
 * Cron endpoint that purges expired sessions.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

import { NextResponse } from "next/server";
import { cronAuthorized } from "@/lib/cron";
import { purgeExpiredSessions } from "@/lib/auth/session";

// Hourly job (cluster CronJob): deletes expired sessions.

export async function POST(request: Request) {
  if (!(await cronAuthorized(request))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const result = await purgeExpiredSessions();
  return NextResponse.json(result);
}
