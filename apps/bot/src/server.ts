/**
 * GC-Scouting - server
 *
 * Internal HTTP server: routes called by the site (BOT_INTERNAL_KEY) and the health endpoints.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { createHash, timingSafeEqual } from "node:crypto";
import { sql } from "drizzle-orm";
import { parseId } from "@scouting/db";
import { loggable } from "@scouting/db/log";
import type { BotContext } from "./core/context";
import { purgeMessages, refreshModeration, sendReport, syncPost } from "./modules/delivery";
import { markTweeted } from "./modules/moderation";
import { authorTweets, pendingTweets } from "./modules/tweets";

// Routes: /healthz, /readyz, /internal/* (called by the site with BOT_INTERNAL_KEY).

const INTERNAL_ROUTES: { pattern: RegExp; run(ctx: BotContext, id: number): Promise<void> }[] = [
  // Post published, renewed, edited, closed or deleted on the site.
  { pattern: /^\/internal\/posts\/(\d+)$/, run: (ctx, id) => syncPost(ctx, id, { refresh: true }) },
  { pattern: /^\/internal\/reports\/(\d+)$/, run: sendReport },
  // Moderated from the site admin: feeds follow, the post card and its reports are redrawn.
  {
    pattern: /^\/internal\/posts\/(\d+)\/moderated$/,
    run: async (ctx, id) => {
      await syncPost(ctx, id);
      await refreshModeration(ctx, id);
    },
  },
];

const TWEETED_ROUTE = /^\/internal\/posts\/(\d+)\/tweeted$/;
const AUTHOR_TWEET_ROUTE = /^\/internal\/posts\/(\d+)\/tweet$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const sha256 = (value: string) => createHash("sha256").update(value).digest();

function internalAuthorized(request: Request, key: string): boolean {
  const header = request.headers.get("authorization");
  if (!key || !header?.startsWith("Bearer ")) return false;
  // Same length hashes, compared in constant time.
  return timingSafeEqual(sha256(header.slice(7)), sha256(key));
}

/** Routes of the site tweets page, answered with their result. */
async function tweets(request: Request, ctx: BotContext, path: string): Promise<Response | null> {
  if (request.method === "GET" && path === "/internal/tweets") return Response.json(await pendingTweets(ctx));

  // Texts of a post tweeted by its author, one per language they can pick.
  const postId = parseId(path.match(AUTHOR_TWEET_ROUTE)?.[1]);
  if (request.method === "GET" && postId) {
    const tweets = await authorTweets(ctx, postId);
    return tweets ? Response.json({ ok: true, tweets }) : Response.json({ ok: false, error: "notFound" }, { status: 404 });
  }

  const id = parseId(path.match(TWEETED_ROUTE)?.[1]);
  if (request.method !== "POST" || !id) return null;
  const { actorUserId } = (await request.json().catch(() => ({}))) as { actorUserId?: unknown };
  if (typeof actorUserId !== "string" || !UUID.test(actorUserId)) return Response.json({ ok: false, error: "invalid" }, { status: 400 });
  const result = await markTweeted(ctx.db, id, { actorUserId });
  if (result !== "ok") return Response.json({ ok: false, error: result }, { status: result === "notFound" ? 404 : 409 });
  ctx.defer(() => refreshModeration(ctx, id));
  return Response.json({ ok: true });
}

async function internal(request: Request, ctx: BotContext, path: string): Promise<Response> {
  if (!internalAuthorized(request, ctx.env.BOT_INTERNAL_KEY)) return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const answered = await tweets(request, ctx, path);
  if (answered) return answered;

  if (request.method !== "POST") return Response.json({ ok: false, error: "not_found" }, { status: 404 });
  // Account deleted on the site: its messages are queued in discord_message_purges.
  if (path === "/internal/purges") {
    ctx.defer(() => purgeMessages(ctx));
    return Response.json({ ok: true }, { status: 202 });
  }
  for (const route of INTERNAL_ROUTES) {
    const id = parseId(path.match(route.pattern)?.[1]);
    if (!id) continue;
    // Answered right away, Discord calls run after the response.
    ctx.defer(() => route.run(ctx, id));
    return Response.json({ ok: true }, { status: 202 });
  }
  return Response.json({ ok: false, error: "not_found" }, { status: 404 });
}

export type Health = { discordReady(): boolean };

async function route(request: Request, ctx: BotContext, health: Health): Promise<Response> {
  const { pathname } = new URL(request.url);
  // Liveness: the process answers.
  if (pathname === "/healthz") return new Response("ok");
  // Readiness: the database answers and the gateway is connected.
  if (pathname === "/readyz") {
    try {
      await ctx.db.execute(sql`select 1`);
    } catch {
      return new Response("database unavailable", { status: 503 });
    }
    return health.discordReady() ? new Response("ok") : new Response("discord not connected", { status: 503 });
  }
  if (pathname.startsWith("/internal/")) return internal(request, ctx, pathname);
  return new Response("Not found", { status: 404 });
}

/** Node request to a standard Request, so the routes stay plain fetch handlers. */
async function toRequest(incoming: IncomingMessage): Promise<Request> {
  const chunks: Buffer[] = [];
  for await (const chunk of incoming) chunks.push(chunk as Buffer);
  const headers = new Headers();
  for (const [name, value] of Object.entries(incoming.headers)) if (value !== undefined) headers.set(name, Array.isArray(value) ? value.join(", ") : value);
  const hasBody = incoming.method !== "GET" && incoming.method !== "HEAD" && chunks.length > 0;
  return new Request(new URL(incoming.url ?? "/", "http://bot.internal"), { method: incoming.method, headers, body: hasBody ? Buffer.concat(chunks) : undefined });
}

async function send(outgoing: ServerResponse, response: Response): Promise<void> {
  outgoing.writeHead(response.status, Object.fromEntries(response.headers));
  outgoing.end(Buffer.from(await response.arrayBuffer()));
}

export function createInternalServer(ctx: BotContext, health: Health): Server {
  return createServer((incoming, outgoing) => {
    toRequest(incoming)
      .then((request) => route(request, ctx, health))
      .catch((error) => {
        console.error("[bot] request failed", loggable(error));
        return Response.json({ ok: false, error: "internal" }, { status: 500 });
      })
      .then((response) => send(outgoing, response))
      .catch((error) => {
        console.error("[bot] response failed", loggable(error));
        outgoing.destroy();
      });
  });
}
