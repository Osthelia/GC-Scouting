/**
 * GC-Scouting - auth login route
 *
 * Starts the GC Stats OAuth login flow.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

import { NextResponse, type NextRequest } from "next/server";
import { gcsAuthorizeUrl, gcsOAuthConfig } from "@/lib/auth/gcs-oauth";
import { pkceChallenge, randomToken } from "@/lib/auth/crypto";
import { authErrorUrl, encodeFlow, FLOW_COOKIE, FLOW_TTL_SECONDS, safeNext, toLocale } from "@/lib/auth/flow";
import { appUrl } from "@/lib/app-url";
import { sessionCookieOptions } from "@/lib/auth/session";

export async function GET(request: NextRequest) {
  const locale = toLocale(request.nextUrl.searchParams.get("locale"));
  const origin = appUrl(request.url);
  const config = gcsOAuthConfig();
  if (!config) return NextResponse.redirect(authErrorUrl(origin, locale, "config"));

  const state = randomToken();
  const verifier = randomToken(48);
  const next = safeNext(request.nextUrl.searchParams.get("next"), locale);

  const response = NextResponse.redirect(
    gcsAuthorizeUrl(config, { locale, redirectUri: `${origin}/api/auth/callback`, state, codeChallenge: await pkceChallenge(verifier) }),
  );
  response.cookies.set(FLOW_COOKIE, encodeFlow({ state, verifier, next, locale }), { ...sessionCookieOptions(FLOW_TTL_SECONDS), path: "/api/auth" });
  return response;
}
