/**
 * GC-Scouting - forward-auth
 *
 * Identity of a request let through by Authentik (Traefik ForwardAuth), for the tweets page.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

// The /tweets route of the Ingress runs the Authentik ForwardAuth middleware, which only lets authenticated users of the
// moderation group through and sets these headers from the outpost response (a value sent by the client is overwritten).
// Nothing is verified here: the app trusts the headers, so it must only be reachable through Traefik (NetworkPolicy).

const HEADERS = ["x-authentik-email", "x-authentik-username"] as const;

/** Email (or username) of the Authentik user. */
export type AccessIdentity = { subject: string };

/** Identity of a request let through by Authentik, null when the headers are missing. Open in dev, where there is no proxy. */
export function verifyAccess(headers: Headers): AccessIdentity | null {
  for (const name of HEADERS) {
    const value = headers.get(name)?.trim();
    if (value) return { subject: value };
  }
  return process.env.NODE_ENV === "production" ? null : { subject: "dev" };
}
