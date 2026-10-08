/**
 * GC-Scouting - cron expiry-reminders route
 *
 * Cron endpoint that sends the post expiry reminders.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

import { NextResponse } from "next/server";
import { cronAuthorized } from "@/lib/cron";
import { sendExpiryReminders } from "@/lib/post-expiry";

// Hourly job (Worker cron trigger): expiry reminder of posts reaching day 7.

export async function POST(request: Request) {
  if (!(await cronAuthorized(request))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const result = await sendExpiryReminders();
  return NextResponse.json(result);
}
