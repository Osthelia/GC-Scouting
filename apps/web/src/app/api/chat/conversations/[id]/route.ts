/**
 * GC-Scouting - conversations id route
 *
 * Returns the messages of a conversation (polled by the chat).
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

import { NextResponse } from "next/server";
import { getActiveProfile } from "@/lib/auth/session";
import { getConversation, olderMessages } from "@/lib/chat/queries";
import { parseId } from "@scouting/db";

const NO_STORE = { "Cache-Control": "no-store" };

/** Latest messages of a conversation, polled by the open conversation. `?before=<message id>` loads older ones. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = parseId((await params).id);
  const profile = await getActiveProfile();
  if (!profile) return NextResponse.json({ error: "auth" }, { status: 401, headers: NO_STORE });

  const rawBefore = new URL(request.url).searchParams.get("before");
  if (rawBefore !== null) {
    const before = parseId(rawBefore);
    const page = id && before ? await olderMessages(id, profile.id, before) : null;
    if (!page) return NextResponse.json({ error: "notFound" }, { status: 404, headers: NO_STORE });
    return NextResponse.json(page, { headers: NO_STORE });
  }
  const conversation = id ? await getConversation(id, profile) : null;
  if (!conversation) return NextResponse.json({ error: "notFound" }, { status: 404, headers: NO_STORE });
  return NextResponse.json(conversation, { headers: NO_STORE });
}
