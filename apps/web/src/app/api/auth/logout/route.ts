/**
 * GC-Scouting - auth logout route
 *
 * Closes the session.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

import { NextResponse, type NextRequest } from "next/server";
import { safeNext, toLocale } from "@/lib/auth/flow";
import { appUrl } from "@/lib/app-url";
import { deleteSession, expiredCookie, PROFILE_COOKIE, SESSION_COOKIE } from "@/lib/auth/session";

export async function POST(request: NextRequest) {
  const origin = appUrl(request.url);
  // Cross site form posts are refused (the cookie is SameSite=Lax, this is a second guard).
  const from = request.headers.get("origin");
  if (from && from !== origin && from !== new URL(request.url).origin) return new NextResponse(null, { status: 403 });

  const form = await request.formData().catch(() => null);
  const locale = toLocale(form?.get("locale"));
  const nextValue = form?.get("next");
  const next = safeNext(typeof nextValue === "string" ? nextValue : null, locale);

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (token) await deleteSession(token);

  const response = NextResponse.redirect(`${origin}${next}`, 303);
  response.cookies.set(expiredCookie(SESSION_COOKIE));
  response.cookies.set(expiredCookie(PROFILE_COOKIE));
  return response;
}
