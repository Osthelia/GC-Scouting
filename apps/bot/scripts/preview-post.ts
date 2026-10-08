/**
 * GC-Scouting - preview-post
 *
 * Prints the Discord message built for a sample post, to check the layout without sending it.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "@scouting/db/schema";
import type { Db } from "../src/core/context";
import { sendMessage } from "../src/core/discord";
import { isLocale } from "../src/core/i18n";
import type { Env } from "../src/env";
import { moderationMessage } from "../src/modules/moderation-message";
import { feedMessage } from "../src/modules/post-message";
import { loadPost, moderationRemoval } from "../src/modules/posts";
import { tweetDraft } from "../src/modules/tweet";

// Sends the feed card and the moderation card of a post to a channel, to check the rendering.
// Usage: npm run preview -- <postId> <channelId> [en|fr|es]. Reads .dev.vars and the DATABASE_URL of packages/db.

process.loadEnvFile(".dev.vars");
process.loadEnvFile("../../packages/db/.env");

const [postId, channelId, rawLocale = "fr"] = process.argv.slice(2);
if (!postId || !channelId || !isLocale(rawLocale)) {
  console.error("Usage: npm run preview -- <postId> <channelId> [en|fr|es]");
  process.exit(1);
}

const env = process.env as unknown as Env;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema }) as unknown as Db;

try {
  const post = await loadPost(db, Number(postId));
  if (!post) throw new Error(`Post ${postId} not found`);
  await sendMessage(env, channelId, feedMessage(post, rawLocale, env.APP_URL));
  await sendMessage(env, channelId, moderationMessage(post, await moderationRemoval(db, post), rawLocale, env.APP_URL, env.KASM_TWEETS_URL));
  console.log(`Post ${post.id} sent.\n\nTweet:\n${tweetDraft(post, env.APP_URL).text}`);
} finally {
  await pool.end();
}
