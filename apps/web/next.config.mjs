/**
 * GC-Scouting - next.config
 *
 * Next.js configuration (next-intl plugin, headers, images).
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import createNextIntlPlugin from "next-intl/plugin";
import { securityHeaders } from "./security-headers.mjs";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..");

/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: ["localhost", "127.0.0.1"],
  transpilePackages: ["@scouting/db"],
  // Self contained server for the container image (node server.js).
  output: "standalone",
  // The workspace packages live above apps/web, the trace must include them.
  outputFileTracingRoot: root,
  // Build-time CDN host for /_next/static (a pull zone whose origin is the app). Unset = served by the app.
  assetPrefix: process.env.ASSET_PREFIX || undefined,
  async headers() {
    return [
      // Fonts and chunks fetched cross-origin from the CDN host need CORS.
      ...(process.env.ASSET_PREFIX
        ? [{ source: "/_next/static/:path*", headers: [{ key: "Access-Control-Allow-Origin", value: "*" }] }]
        : []),
      { source: "/:path*", headers: securityHeaders },
      // Token links must not leak through Referer. Later rules override earlier ones.
      { source: "/:locale/manage/:path*", headers: [{ key: "Referrer-Policy", value: "no-referrer" }] },
      { source: "/:locale/invite/:path*", headers: [{ key: "Referrer-Policy", value: "no-referrer" }] },
    ];
  },
};

export default withNextIntl(nextConfig);
