/**
 * GC-Scouting - account export route
 *
 * Downloads all the data stored for the signed in account.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { exportAccountData } from "@/lib/auth/account-data";

// Download of the logged in account's data (JSON).

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const data = await exportAccountData(user.id);
  if (!data) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const date = data.exportedAt.slice(0, 10);
  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="gc-scouting-data-${date}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
