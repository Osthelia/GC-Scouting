/**
 * GC-Scouting - auth callback route
 *
 * OAuth callback: exchanges the code, syncs the account and opens the session.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

import { after, NextResponse, type NextRequest } from "next/server";
import { exchangeCode, fetchUserinfo, gcsOAuthConfig, GcsOAuthError } from "@/lib/auth/gcs-oauth";
import { syncAccount } from "@/lib/auth/account";
import { syncAuthorGcsSummaries } from "@/lib/gcs-summary";
import { authErrorUrl, decodeFlow, FLOW_COOKIE } from "@/lib/auth/flow";
import { appUrl } from "@/lib/app-url";
import { createSession, SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth/session";
import { routing } from "@/i18n/routing";
import { loggable } from "@scouting/db/log";

export async function GET(request: NextRequest) {
  const origin = appUrl(request.url);
  const params = request.nextUrl.searchParams;
  const flow = decodeFlow(request.cookies.get(FLOW_COOKIE)?.value);
  const locale = flow?.locale ?? routing.defaultLocale;

  const fail = (reason: string) => {
    const response = NextResponse.redirect(authErrorUrl(origin, locale, reason));
    response.cookies.delete({ name: FLOW_COOKIE, path: "/api/auth" });
    return response;
  };

  if (!flow || params.get("state") !== flow.state) return fail("state");
  if (params.get("error")) return fail(params.get("error") === "access_denied" ? "denied" : "provider");
  const code = params.get("code");
  if (!code) return fail("provider");

  const config = gcsOAuthConfig();
  if (!config) return fail("config");

  let userId: string;
  try {
    const tokens = await exchangeCode(config, { code, redirectUri: `${origin}/api/auth/callback`, codeVerifier: flow.verifier });
    const info = await fetchUserinfo(tokens.accessToken);
    const account = await syncAccount(info, tokens, locale);
    userId = account.userId;
    if (account.linked) after(() => syncAuthorGcsSummaries(userId));
  } catch (error) {
    console.error("[auth] callback failed:", error instanceof GcsOAuthError ? `${error.code} (${error.message})` : loggable(error));
    return fail("exchange");
  }

  const session = await createSession(userId, request.headers.get("user-agent"));
  const response = NextResponse.redirect(`${origin}${flow.next}`);
  response.cookies.set(SESSION_COOKIE, session.token, sessionCookieOptions(session.maxAge));
  response.cookies.delete({ name: FLOW_COOKIE, path: "/api/auth" });
  return response;
}
