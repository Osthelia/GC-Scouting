/**
 * GC-Scouting - proxy
 *
 * Request proxy: locale routing and request guards.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

import createMiddleware from "next-intl/middleware";
import type { NextRequest } from "next/server";
import { securityHeaders } from "../security-headers.mjs";
import { routing } from "./i18n/routing";

const intl = createMiddleware(routing);

export default function proxy(request: NextRequest) {
  const response = intl(request);
  // Redirects issued here must carry the security headers too.
  if (response.status >= 300 && response.status < 400) {
    for (const { key, value } of securityHeaders) response.headers.set(key, value);
  }
  return response;
}

export const config = {
  matcher: ["/((?!api|_next|t/|tweets(?:/|$)|.*\..*).*)"],
};
