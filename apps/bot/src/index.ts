/**
 * GC-Scouting - . index
 *
 * Bot worker entry point: Discord interaction endpoint, signature check and internal routes called by the site.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

import { verifyKey } from "discord-interactions";
import type { APIInteraction } from "discord-api-types/v10";
import { parseId } from "@scouting/db";
import type { Env } from "./env";
import { createContext, type BotContext } from "./core/context";
import { handleInteraction } from "./core/router";
import { catchUp, purgeMessages, refreshModeration, sendReport, syncPost } from "./modules/delivery";
import { markTweeted } from "./modules/moderation";
import { authorTweets, pendingTweets } from "./modules/tweets";

// HTTP interactions only: no gateway connection, so no intent at all.
// Routes: POST /interactions (signed by Discord), /internal/* (called by the site with BOT_INTERNAL_KEY).

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

async function sha256(value: string): Promise<ArrayBuffer> {
  return crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
}

async function internalAuthorized(request: Request, env: Env): Promise<boolean> {
  const header = request.headers.get("authorization");
  if (!env.BOT_INTERNAL_KEY || !header?.startsWith("Bearer ")) return false;
  // Same length hashes, compared in constant time.
  return crypto.subtle.timingSafeEqual(await sha256(header.slice(7)), await sha256(env.BOT_INTERNAL_KEY));
}

async function interactions(request: Request, env: Env, execution: ExecutionContext): Promise<Response> {
  const signature = request.headers.get("x-signature-ed25519");
  const timestamp = request.headers.get("x-signature-timestamp");
  const body = await request.text();
  if (!signature || !timestamp || !(await verifyKey(body, signature, timestamp, env.DISCORD_PUBLIC_KEY))) {
    return new Response("Invalid signature", { status: 401 });
  }

  const { ctx, finish } = createContext(env, execution);
  try {
    return Response.json(await handleInteraction(JSON.parse(body) as APIInteraction, ctx));
  } finally {
    finish();
  }
}

const TWEETED_ROUTE = /^\/internal\/posts\/(\d+)\/tweeted$/;
const AUTHOR_TWEET_ROUTE = /^\/internal\/posts\/(\d+)\/tweet$/;

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
  const { accessSubject } = (await request.json().catch(() => ({}))) as { accessSubject?: unknown };
  if (typeof accessSubject !== "string" || !accessSubject.trim() || accessSubject.length > 320) {
    return Response.json({ ok: false, error: "invalid" }, { status: 400 });
  }
  const result = await markTweeted(ctx.db, id, { accessSubject: accessSubject.trim() });
  if (result !== "ok") return Response.json({ ok: false, error: result }, { status: result === "notFound" ? 404 : 409 });
  ctx.defer(() => refreshModeration(ctx, id));
  return Response.json({ ok: true });
}

async function internal(request: Request, env: Env, execution: ExecutionContext, path: string): Promise<Response> {
  if (!(await internalAuthorized(request, env))) return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const { ctx, finish } = createContext(env, execution);
  try {
    const answered = await tweets(request, ctx, path);
    if (answered) return answered;
  } finally {
    finish();
  }

  if (request.method !== "POST") return Response.json({ ok: false, error: "not_found" }, { status: 404 });
  // Account deleted on the site: its messages are queued in discord_message_purges.
  if (path === "/internal/purges") {
    const { ctx, finish } = createContext(env, execution);
    ctx.defer(() => purgeMessages(ctx));
    finish();
    return Response.json({ ok: true }, { status: 202 });
  }
  for (const route of INTERNAL_ROUTES) {
    const id = parseId(path.match(route.pattern)?.[1]);
    if (!id) continue;
    const { ctx, finish } = createContext(env, execution);
    // Answered right away, Discord calls run after the response.
    ctx.defer(() => route.run(ctx, id));
    finish();
    return Response.json({ ok: true }, { status: 202 });
  }
  return Response.json({ ok: false, error: "not_found" }, { status: 404 });
}

export default {
  async fetch(request, env, execution) {
    const { pathname } = new URL(request.url);
    if (request.method === "POST" && pathname === "/interactions") return interactions(request, env, execution);
    if (pathname.startsWith("/internal/")) return internal(request, env, execution, pathname);
    return new Response("Not found", { status: 404 });
  },

  async scheduled(_controller, env, execution) {
    const { ctx, finish } = createContext(env, execution);
    ctx.defer(() => catchUp(ctx));
    finish();
  },
} satisfies ExportedHandler<Env>;
