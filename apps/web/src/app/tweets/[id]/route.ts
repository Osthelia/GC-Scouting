/**
 * GC-Scouting - tweets id route
 *
 * Marks a queued tweet as sent (called by the tweet queue).
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

import { parseId } from "@scouting/db";
import { verifyAccess } from "@/lib/auth/forward-auth";
import { markBotTweeted } from "@/lib/notify/bot";

// Marks a post as tweeted (or retweeted) from the tweets page. Behind Authentik, like the page, its identity headers are checked here too.

const STATUS = { ok: 200, notFound: 404, alreadyTweeted: 409, awaitingAuthor: 409, unavailable: 503 } as const;

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  // The Authentik cookie rides along cross site requests too: only the tweets page itself may post.
  // Sec-Fetch-Site is set by the browser and reliable behind proxies, where request.url may not be the public origin.
  const site = request.headers.get("sec-fetch-site");
  const from = request.headers.get("origin");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const sameOrigin = site ? site === "same-origin" : !from || (host !== null && URL.canParse(from) && new URL(from).host === host);
  if (!sameOrigin) return Response.json({ ok: false, error: "forbidden" }, { status: 403 });

  const identity = verifyAccess(request.headers);
  if (!identity) return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const postId = parseId(id);
  if (!postId) return Response.json({ ok: false, error: "invalid" }, { status: 400 });

  const result = await markBotTweeted(postId, identity.subject);
  return Response.json(result === "ok" ? { ok: true } : { ok: false, error: result }, { status: STATUS[result] });
}
