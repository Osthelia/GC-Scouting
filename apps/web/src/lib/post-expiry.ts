/**
 * GC-Scouting - post-expiry
 *
 * Post lifetime: expiry reminders, renew and delete action tokens.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

import { and, asc, eq, gt, isNotNull, isNull, lte, or } from "drizzle-orm";
import { createTranslator } from "next-intl";
import { db } from "@scouting/db/client";
import { actionTokens, posts, users, DAY_MS, EXPIRY_NOTICE_DAY, POST_LIFETIME_DAYS } from "@scouting/db";
import { deriveAvailability } from "@scouting/db/derived";
import { escapeMarkdown } from "@scouting/db/markdown";
import { appUrl, localeOf } from "@/lib/app-url";
import { randomToken, sha256Hex } from "@/lib/auth/crypto";
import type { Tx } from "@/lib/auth/account";
import { lockRateLimit } from "@/lib/rate-limit";
import { activePostsFull } from "@/lib/post-limits";
import { POST_TYPE_BY_KEY } from "@/lib/post-types";
import { renderEmail, sendEmail } from "@/lib/notify/email";
import { isTransientDiscordError, sendDiscordDm } from "@/lib/notify/discord";
import { loggable } from "@scouting/db/log";

// Posts live 10 days. On day 7 the author gets one reminder per cycle (email and/or Discord DM)
// with single use renew/delete links that work without a session.

/** The reminder window: renewal opens with it, so a post can't be bumped every day. */
export const RENEW_WINDOW_MS = (POST_LIFETIME_DAYS - EXPIRY_NOTICE_DAY) * DAY_MS;
const ACTION_TOKEN_TTL_MS = 14 * DAY_MS;
const ACCENT_COLOR = 0x9b7bff;

export type ActionTokenAction = "renew" | "delete";

export function canRenew(expiresAt: Date, now = new Date()): boolean {
  return expiresAt.getTime() - now.getTime() <= RENEW_WINDOW_MS;
}

/** Unused links of a post stop working once one of its actions ran. */
function revokeActionTokens(tx: Tx, postId: number, now: Date) {
  return tx
    .update(actionTokens)
    .set({ usedAt: now })
    .where(and(eq(actionTokens.postId, postId), isNull(actionTokens.usedAt)));
}

/**
 * Ten more days from now, back on top of the list, next reminder rearmed. Null when the post is not active anymore,
 * `limitReached` when renewing an expired post would go past the online posts allowed for its type.
 */
export async function renewPost(tx: Tx, postId: number, now = new Date()): Promise<Date | "limitReached" | null> {
  const [post] = await tx
    .select({ authorId: posts.authorId, type: posts.type, availability: posts.availability, timezone: posts.timezone })
    .from(posts)
    .where(and(eq(posts.id, postId), eq(posts.status, "active"), isNull(posts.deletedAt)))
    .for("update")
    .limit(1);
  if (!post) return null;
  await lockRateLimit(tx, "posts", post.authorId);
  if (await activePostsFull(tx, post.authorId, post.type, postId)) return "limitReached";

  const expiresAt = new Date(now.getTime() + POST_LIFETIME_DAYS * DAY_MS);
  await tx
    .update(posts)
    .set({
      expiresAt,
      bumpedAt: now,
      expiryNoticeSentAt: null,
      // UTC offsets may have changed since the last write (DST).
      ...deriveAvailability(post.availability, post.timezone, now),
    })
    .where(eq(posts.id, postId));
  await revokeActionTokens(tx, postId, now);
  return expiresAt;
}

async function removePost(tx: Tx, postId: number, now: Date): Promise<boolean> {
  const [row] = await tx
    .update(posts)
    .set({ status: "removed", deletedAt: now })
    .where(and(eq(posts.id, postId), eq(posts.status, "active"), isNull(posts.deletedAt)))
    .returning({ id: posts.id });
  if (!row) return false;
  await revokeActionTokens(tx, postId, now);
  return true;
}

export type ActionTokenInfo = {
  action: ActionTokenAction;
  post: { id: number; type: (typeof posts.$inferSelect)["type"]; displayName: string; expiresAt: Date };
};

export type ActionTokenError = "invalid" | "used" | "expired" | "unavailable" | "limitReached";

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

/** Reads a link without using it: the page asks for a click first (mail scanners open every link). */
export async function readActionToken(token: string): Promise<{ ok: true; info: ActionTokenInfo } | { ok: false; error: ActionTokenError }> {
  if (!TOKEN_PATTERN.test(token)) return { ok: false, error: "invalid" };
  const [row] = await db
    .select({
      action: actionTokens.action,
      usedAt: actionTokens.usedAt,
      tokenExpiresAt: actionTokens.expiresAt,
      postId: posts.id,
      type: posts.type,
      displayName: posts.displayName,
      status: posts.status,
      deletedAt: posts.deletedAt,
      expiresAt: posts.expiresAt,
    })
    .from(actionTokens)
    .innerJoin(posts, eq(posts.id, actionTokens.postId))
    .where(eq(actionTokens.tokenHash, await sha256Hex(token)))
    .limit(1);

  if (!row) return { ok: false, error: "invalid" };
  if (row.usedAt) return { ok: false, error: "used" };
  if (row.tokenExpiresAt <= new Date()) return { ok: false, error: "expired" };
  if (row.status !== "active" || row.deletedAt) return { ok: false, error: "unavailable" };
  return { ok: true, info: { action: row.action, post: { id: row.postId, type: row.type, displayName: row.displayName, expiresAt: row.expiresAt } } };
}

export type ConsumeActionTokenResult =
  | { ok: true; action: "renew"; postId: number; expiresAt: Date }
  | { ok: true; action: "delete"; postId: number }
  | { ok: false; error: ActionTokenError };

export async function consumeActionToken(token: string): Promise<ConsumeActionTokenResult> {
  const read = await readActionToken(token);
  if (!read.ok) return read;
  const { action, post } = read.info;
  const now = new Date();

  return db.transaction(async (tx): Promise<ConsumeActionTokenResult> => {
    // Claimed first, two clicks at once run the action a single time.
    const [claimed] = await tx
      .update(actionTokens)
      .set({ usedAt: now })
      .where(and(eq(actionTokens.tokenHash, await sha256Hex(token)), isNull(actionTokens.usedAt), gt(actionTokens.expiresAt, now)))
      .returning({ id: actionTokens.id });
    if (!claimed) return { ok: false, error: "used" };

    if (action === "renew") {
      const expiresAt = await renewPost(tx, post.id, now);
      if (expiresAt === "limitReached") {
        // The link stays usable once another post of this type is closed.
        await tx.update(actionTokens).set({ usedAt: null }).where(eq(actionTokens.id, claimed.id));
        return { ok: false, error: "limitReached" };
      }
      return expiresAt ? { ok: true, action, postId: post.id, expiresAt } : { ok: false, error: "unavailable" };
    }
    return (await removePost(tx, post.id, now)) ? { ok: true, action, postId: post.id } : { ok: false, error: "unavailable" };
  });
}

type DuePost = {
  id: number;
  type: (typeof posts.$inferSelect)["type"];
  displayName: string;
  expiresAt: Date;
  timezone: string;
  email: string | null;
  discordId: string | null;
  locale: string;
};

async function renderReminder(post: DuePost, links: { renew: string; delete: string; view: string }) {
  const locale = localeOf(post.locale);
  const messages = (await import(`../messages/${locale}.json`)).default;
  const t = createTranslator({ locale, messages, namespace: "expiry.reminder" });
  const date = new Intl.DateTimeFormat(locale, { dateStyle: "long", timeStyle: "short", timeZone: post.timezone }).format(post.expiresAt);
  const left = Math.max(1, Math.ceil((post.expiresAt.getTime() - Date.now()) / DAY_MS));
  const vars = { code: POST_TYPE_BY_KEY[post.type].code, name: post.displayName, date, left, days: POST_LIFETIME_DAYS };
  const dmVars = { ...vars, name: escapeMarkdown(post.displayName) };

  const title = t("title", vars);
  const paragraphs = [t("body", vars), t("renewHint", vars), t("deleteHint")];
  const email = {
    subject: t("subject", vars),
    ...renderEmail({
      locale,
      title,
      paragraphs,
      buttons: [
        { label: t("renew"), url: links.renew, primary: true },
        { label: t("delete"), url: links.delete },
        { label: t("view"), url: links.view },
      ],
      footer: t("footer"),
    }),
  };
  const discord = {
    accentColor: ACCENT_COLOR,
    blocks: [
      { kind: "text" as const, content: `**${t("title", dmVars)}**\n${[t("body", dmVars), t("renewHint", dmVars), t("deleteHint")].join("\n")}` },
      { kind: "separator" as const, divider: true },
      {
        kind: "buttons" as const,
        buttons: [
          { label: t("renew"), url: links.renew },
          { label: t("delete"), url: links.delete },
          { label: t("view"), url: links.view },
        ],
      },
      { kind: "text" as const, content: `-# ${t("footer")}` },
    ],
  };
  return { email, discord };
}

type ReminderOutcome = "sent" | "retry" | "failed" | "skipped";

/** Gives the post back to the next run, its links never went out. */
async function releaseReminder(postId: number, tokenIds: number[]) {
  await db.transaction(async (tx) => {
    for (const id of tokenIds) await tx.delete(actionTokens).where(eq(actionTokens.id, id));
    await tx.update(posts).set({ expiryNoticeSentAt: null }).where(eq(posts.id, postId));
  });
}

async function remind(post: DuePost, now: Date): Promise<ReminderOutcome> {
  // Claimed before sending: a second run never sends twice.
  const [claimed] = await db
    .update(posts)
    .set({ expiryNoticeSentAt: now })
    .where(and(eq(posts.id, post.id), isNull(posts.expiryNoticeSentAt)))
    .returning({ id: posts.id });
  if (!claimed) return "skipped";

  const tokenIds: number[] = [];
  try {
    const outcome = await deliverReminder(post, now, tokenIds);
    if (outcome === "retry") await releaseReminder(post.id, tokenIds);
    return outcome;
  } catch (error) {
    await releaseReminder(post.id, tokenIds).catch((releaseError) => {
      console.error(`Expiry reminder of post ${post.id} not released, it will not be sent this cycle`, loggable(releaseError));
    });
    throw error;
  }
}

async function deliverReminder(post: DuePost, now: Date, tokenIds: number[]): Promise<"sent" | "retry" | "failed"> {
  const tokens = { renew: randomToken(), delete: randomToken() };
  const expiresAt = new Date(now.getTime() + ACTION_TOKEN_TTL_MS);
  const inserted = await db
    .insert(actionTokens)
    .values([
      { postId: post.id, action: "renew", tokenHash: await sha256Hex(tokens.renew), expiresAt },
      { postId: post.id, action: "delete", tokenHash: await sha256Hex(tokens.delete), expiresAt },
    ])
    .returning({ id: actionTokens.id });
  tokenIds.push(...inserted.map((row) => row.id));

  const locale = localeOf(post.locale);
  const base = `${appUrl()}/${locale}`;
  const { email, discord } = await renderReminder(post, {
    renew: `${base}/manage/${tokens.renew}`,
    delete: `${base}/manage/${tokens.delete}`,
    view: `${base}/posts/${post.type}/${post.id}`,
  });

  let delivered = false;
  let transient = false;
  if (post.email) {
    const result = await sendEmail({ to: post.email, ...email });
    delivered ||= result.ok;
    transient ||= !result.ok && result.error !== "rejected";
  }
  if (post.discordId) {
    const result = await sendDiscordDm(post.discordId, discord);
    delivered ||= result.ok;
    transient ||= !result.ok && isTransientDiscordError(result.error);
  }
  if (delivered) return "sent";
  // Nothing went out: retried next run if a channel may work later (outage, rate limit, missing config).
  return transient ? "retry" : "failed";
}

/** Sends the reminder of every post that entered its last days, for authors with at least one channel on. */
export async function sendExpiryReminders(limit = 100): Promise<{ due: number; sent: number; retry: number; failed: number; skipped: number }> {
  const now = new Date();
  const due: DuePost[] = await db
    .select({
      id: posts.id,
      type: posts.type,
      displayName: posts.displayName,
      expiresAt: posts.expiresAt,
      timezone: posts.timezone,
      email: users.email,
      discordId: users.discordId,
      notifyEmail: users.notifyEmail,
      notifyDiscord: users.notifyDiscord,
      locale: users.locale,
    })
    .from(posts)
    .innerJoin(users, eq(users.id, posts.authorId))
    .where(
      and(
        eq(posts.status, "active"),
        isNull(posts.deletedAt),
        isNull(posts.expiryNoticeSentAt),
        gt(posts.expiresAt, now),
        lte(posts.expiresAt, new Date(now.getTime() + RENEW_WINDOW_MS)),
        or(and(eq(users.notifyEmail, true), isNotNull(users.email)), and(eq(users.notifyDiscord, true), isNotNull(users.discordId))),
      ),
    )
    .orderBy(asc(posts.expiresAt))
    .limit(limit)
    .then((rows) =>
      rows.map(({ notifyEmail, notifyDiscord, email, discordId, ...row }) => ({
        ...row,
        email: notifyEmail ? email : null,
        discordId: notifyDiscord ? discordId : null,
      })),
    );

  const result = { due: due.length, sent: 0, retry: 0, failed: 0, skipped: 0 };
  for (const post of due) {
    try {
      result[await remind(post, now)]++;
    } catch (error) {
      result.failed++;
      console.error(`Expiry reminder failed for post ${post.id}`, loggable(error));
    }
  }
  return result;
}
