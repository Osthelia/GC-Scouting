/**
 * GC-Scouting - cf-access
 *
 * Verifies the Cloudflare Access token that protects staging.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";
import { loggable } from "@scouting/db/log";

// Pages behind Cloudflare Access: Access adds a signed JWT to every authenticated request,
// from its `CF_Authorization` cookie for browsers, or from the Service Token.

const HEADER = "cf-access-jwt-assertion";

let keys: { issuer: string; jwks: JWTVerifyGetKey } | null = null;

function issuer(): string | null {
  const team = process.env.CF_ACCESS_TEAM_DOMAIN?.trim().replace(/\/+$/, "");
  if (!team) return null;
  return team.startsWith("https://") ? team : `https://${team}`;
}

/** Email of the user, or client id of the Service Token. */
export type AccessIdentity = { subject: string };

/** Identity of a request let through by Access, null when the JWT is missing or invalid. Open in dev when Access is not configured. */
export async function verifyAccess(headers: Headers): Promise<AccessIdentity | null> {
  const iss = issuer();
  const audience = process.env.CF_ACCESS_AUD?.trim();
  if (!iss || !audience) return process.env.NODE_ENV === "production" ? null : { subject: "dev" };

  const token = headers.get(HEADER);
  if (!token) return null;
  if (keys?.issuer !== iss) keys = { issuer: iss, jwks: createRemoteJWKSet(new URL(`${iss}/cdn-cgi/access/certs`)) };

  try {
    const { payload } = await jwtVerify(token, keys.jwks, { issuer: iss, audience });
    const subject = typeof payload.email === "string" ? payload.email : typeof payload.common_name === "string" ? payload.common_name : payload.sub;
    return subject ? { subject } : null;
  } catch (error) {
    console.warn("[cf-access] JWT rejected", loggable(error));
    return null;
  }
}
