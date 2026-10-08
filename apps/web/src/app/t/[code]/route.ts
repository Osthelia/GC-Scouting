/**
 * GC-Scouting - t code route
 *
 * Short post link, redirects to the post in the language of the visitor.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

import { type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { db } from "@scouting/db/client";
import { posts, sessions, users } from "@scouting/db";
import { postIdFromShortCode } from "@scouting/db/short-link";
import { routing, type AppLocale } from "@/i18n/routing";
import { SESSION_COOKIE } from "@/lib/auth/session";
import { sha256Hex } from "@/lib/auth/crypto";
import { appUrl } from "@/lib/app-url";

const isLocale = (value: unknown): value is AppLocale => routing.locales.includes(value as AppLocale);

/** Locale cookie first, then the account's locale. Null when the visitor has neither. */
async function visitorLocale(): Promise<AppLocale | null> {
  const store = await cookies();
  const cookieLocale = store.get("NEXT_LOCALE")?.value;
  if (isLocale(cookieLocale)) return cookieLocale;

  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const [row] = await db
    .select({ locale: users.locale, expiresAt: sessions.expiresAt })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(eq(sessions.id, await sha256Hex(token)))
    .limit(1);
  return row && row.expiresAt > new Date() && isLocale(row.locale) ? row.locale : null;
}

// Short post link: /t/<code> redirects to the post page in the visitor's locale.
export async function GET(request: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const postId = postIdFromShortCode(code);
  const locale = (await visitorLocale()) ?? routing.defaultLocale;
  const prefix = `/${locale}`;

  if (!postId) return Response.redirect(new URL(prefix, appUrl(request.url)), 302);

  const [post] = await db.select({ type: posts.type }).from(posts).where(eq(posts.id, postId)).limit(1);
  // An unknown id still lands on the post page, which shows the localized not found page.
  return Response.redirect(new URL(`${prefix}/posts/${post?.type ?? "lft"}/${postId}`, appUrl(request.url)), 302);
}
