/**
 * GC-Scouting - cron gcs-accounts route
 *
 * Cron endpoint that deletes the accounts whose GC Stats account no longer exists.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

import { NextResponse } from "next/server";
import { cronAuthorized } from "@/lib/cron";
import { sweepDeletedGcsAccounts } from "@/lib/auth/account-data";

// Hourly job (Worker cron trigger): a batch of accounts per run, the least recently checked first.

export async function POST(request: Request) {
  if (!(await cronAuthorized(request))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const result = await sweepDeletedGcsAccounts();
  return NextResponse.json(result);
}
