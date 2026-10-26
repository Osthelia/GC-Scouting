/**
 * GC-Scouting - gcs-oauth
 *
 * GC Stats OAuth client: authorize URL, token exchange and userinfo.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

import { z } from "zod";
import { GCS_SANCTION_TYPES, type GcsSanction } from "@scouting/db";
import { GCS_URL } from "@/lib/gcs";

// OAuth2 client for GC Stats (authorization code + PKCE, confidential client).

export const GCS_OAUTH_SCOPES = ["profile", "email", "linked_accounts", "player", "teams", "link_player", "sanctions"] as const;

export class GcsOAuthError extends Error {
  constructor(
    public readonly code: string,
    message?: string,
  ) {
    super(message ?? code);
  }
}

/** A slow GC Stats must not hold the actions that check sanctions (post, chat). */
const GCS_TIMEOUT_MS = 8_000;

/** Server to server calls. */
export async function gcsFetch(path: string, init: RequestInit & { headers: Record<string, string> }): Promise<Response> {
  const headers = { ...init.headers, Accept: "application/json" };

  const res = await fetch(`${GCS_URL}${path}`, { signal: AbortSignal.timeout(GCS_TIMEOUT_MS), ...init, headers, cache: "no-store", redirect: "manual" });
  // The API never redirects: a redirect is a login wall in front of it.
  if (res.status >= 300 && res.status < 400) {
    const location = res.headers.get("location") ?? "";
    throw new GcsOAuthError(`redirect_${res.status}`, `${path} redirected to ${location}`);
  }
  return res;
}

export type GcsOAuthConfig = { clientId: string; clientSecret: string };

/** Null when the client is not configured, the login flow then fails with a clear error. */
export function gcsOAuthConfig(): GcsOAuthConfig | null {
  const clientId = process.env.GCS_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GCS_OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret || !process.env.TOKEN_ENCRYPTION_KEY) return null;
  return { clientId, clientSecret };
}

export function gcsAuthorizeUrl(
  config: GcsOAuthConfig,
  params: { locale: string; redirectUri: string; state: string; codeChallenge: string },
): string {
  const url = new URL(`${GCS_URL}/${params.locale}/oauth/authorize`);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", params.redirectUri);
  url.searchParams.set("scope", GCS_OAUTH_SCOPES.join(" "));
  url.searchParams.set("state", params.state);
  url.searchParams.set("code_challenge", params.codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  return url.toString();
}

const tokenResponseSchema = z.object({
  access_token: z.string().min(1),
  refresh_token: z.string().min(1).optional(),
  expires_in: z.number().int().positive(),
  scope: z.string().default(""),
});

export type GcsTokens = { accessToken: string; refreshToken: string | null; expiresAt: Date; scopes: string[] };

async function tokenRequest(config: GcsOAuthConfig, body: Record<string, string>): Promise<GcsTokens> {
  const res = await gcsFetch("/api/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ ...body, client_id: config.clientId, client_secret: config.clientSecret }),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new GcsOAuthError((json as { error?: string } | null)?.error ?? `http_${res.status}`);

  const parsed = tokenResponseSchema.safeParse(json);
  if (!parsed.success) throw new GcsOAuthError("invalid_token_response");
  return {
    accessToken: parsed.data.access_token,
    refreshToken: parsed.data.refresh_token ?? null,
    // A minute of margin so a token is never used right as it expires.
    expiresAt: new Date(Date.now() + (parsed.data.expires_in - 60) * 1000),
    scopes: parsed.data.scope.split(/\s+/).filter(Boolean),
  };
}

export function exchangeCode(config: GcsOAuthConfig, params: { code: string; redirectUri: string; codeVerifier: string }): Promise<GcsTokens> {
  return tokenRequest(config, {
    grant_type: "authorization_code",
    code: params.code,
    redirect_uri: params.redirectUri,
    code_verifier: params.codeVerifier,
  });
}

export function refreshTokens(config: GcsOAuthConfig, refreshToken: string): Promise<GcsTokens> {
  return tokenRequest(config, { grant_type: "refresh_token", refresh_token: refreshToken });
}

/** RFC 7009 revocation. A refresh token takes its access tokens down with it on GC Stats. */
export async function revokeToken(config: GcsOAuthConfig, token: string): Promise<void> {
  const res = await gcsFetch("/api/oauth/revoke", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ token, client_id: config.clientId, client_secret: config.clientSecret }),
  });
  if (!res.ok) throw new GcsOAuthError(`http_${res.status}`);
}

/** Whether a GC Stats account still exists. Null when GC Stats cannot answer, so nothing gets deleted on a doubt. */
export async function gcsAccountExists(config: GcsOAuthConfig, sub: string): Promise<boolean | null> {
  try {
    const res = await gcsFetch("/api/oauth/account-status", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ sub, client_id: config.clientId, client_secret: config.clientSecret }),
    });
    const json = (await res.json().catch(() => null)) as { exists?: unknown } | null;
    if (res.ok && typeof json?.exists === "boolean") return json.exists;
    console.error(`GC Stats account-status unusable (HTTP ${res.status})`);
    return null;
  } catch (error) {
    console.error("GC Stats account-status failed", error);
    return null;
  }
}

const userinfoSchema = z.object({
  sub: z.string().min(1),
  username: z.string().nullish(),
  image: z.string().nullish(),
  email: z.string().nullish(),
  emailVerified: z.unknown().optional(),
  linkedAccounts: z.array(z.object({ provider: z.string(), providerAccountId: z.string() })).optional(),
  player: z.object({ id: z.number().int().positive(), handle: z.string().nullish() }).nullish(),
  // Latest link request of the account (scope link_player), the only place a refusal shows up.
  playerLinkRequest: z.object({ changeRequestId: z.number().int(), personId: z.number().int(), status: z.string() }).nullish(),
  createdAt: z.string().datetime({ offset: true }).nullish(),
  // Scope sanctions. Unknown types (a new one on GC Stats) are dropped, notes are ignored.
  activeSanctions: z
    .array(z.object({ id: z.number().int(), type: z.string(), startsAt: z.string(), endsAt: z.string().nullable() }))
    .nullish()
    .transform((list) =>
      list?.filter((s): s is GcsSanction => (GCS_SANCTION_TYPES as readonly string[]).includes(s.type) && s.type !== "note"),
    ),
});

export type GcsUserinfo = z.infer<typeof userinfoSchema>;

export type LinkPlayerResult =
  | { status: "pending"; changeRequestId: number }
  | { status: "already_linked" }
  | { status: "error"; error: "invalid_token" | "insufficient_scope" | "not_found" | "taken" | "request_pending" | "slow_down" | "failed" };

/** Asks GC Stats staff to link the token's account to a player profile. */
export async function requestPlayerLink(accessToken: string, personId: number): Promise<LinkPlayerResult> {
  const res = await gcsFetch("/api/oauth/link-player", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ personId }),
  });
  const json = (await res.json().catch(() => null)) as { status?: string; changeRequestId?: number; error?: string } | null;

  if (res.ok) {
    if (json?.status === "already_linked") return { status: "already_linked" };
    if (json?.status === "pending" && Number.isSafeInteger(json.changeRequestId)) return { status: "pending", changeRequestId: json.changeRequestId! };
    return { status: "error", error: "failed" };
  }
  switch (json?.error) {
    case "invalid_token":
    case "insufficient_scope":
    case "not_found":
    case "request_pending":
    case "slow_down":
      return { status: "error", error: json.error };
    case "already_linked":
      return { status: "error", error: "taken" };
    default:
      return { status: "error", error: "failed" };
  }
}

export async function fetchUserinfo(accessToken: string): Promise<GcsUserinfo> {
  const res = await gcsFetch("/api/oauth/userinfo", { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) throw new GcsOAuthError(res.status === 401 ? "invalid_token" : `http_${res.status}`);
  const parsed = userinfoSchema.safeParse(await res.json().catch(() => null));
  if (!parsed.success) throw new GcsOAuthError("invalid_userinfo");
  return parsed.data;
}
