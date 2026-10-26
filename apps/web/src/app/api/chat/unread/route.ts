/**
 * GC-Scouting - chat unread route
 *
 * Returns the unread conversations count (polled by the header).
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

import { NextResponse } from "next/server";
import { getActiveProfile } from "@/lib/auth/session";
import { parseId } from "@scouting/db";
import { listConversations, unreadCount } from "@/lib/chat/queries";

const NO_STORE = { "Cache-Control": "no-store" };

/** Longest list the messages page can grow to. */
const LIST_MAX = 1000;

/** Unread count of the header button, with the latest `list` conversations (menu open, messages page). */
export async function GET(request: Request) {
  const profile = await getActiveProfile();
  if (!profile) return NextResponse.json({ error: "auth" }, { status: 401, headers: NO_STORE });

  const list = Math.min(LIST_MAX, parseId(new URL(request.url).searchParams.get("list")) ?? 0);
  const [unread, page] = await Promise.all([unreadCount(profile.id), list ? listConversations(profile.id, list) : null]);
  return NextResponse.json({ unread, conversations: page?.conversations ?? null, hasMore: page?.hasMore ?? false }, { headers: NO_STORE });
}
