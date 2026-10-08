/**
 * GC-Scouting - next.config
 *
 * Next.js configuration (next-intl plugin, headers, images).
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

import createNextIntlPlugin from "next-intl/plugin";
import { securityHeaders } from "./security-headers.mjs";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

// Only set by `cf-build`. DEPLOY_TARGET is a runtime var, the build must not reach Hyperdrive.
const isCloudflareBuild = process.env.OPENNEXT_BUILD_TARGET === "cloudflare";

/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: ["localhost", "127.0.0.1"],
  transpilePackages: ["@scouting/db"],
  // pg-cloudflare has a "workerd" export that only wrangler's bundler resolves.
  serverExternalPackages: isCloudflareBuild ? ["pg", "pg-cloudflare"] : [],
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // Token links must not leak through Referer. Later rules override earlier ones.
      { source: "/:locale/manage/:path*", headers: [{ key: "Referrer-Policy", value: "no-referrer" }] },
      { source: "/:locale/invite/:path*", headers: [{ key: "Referrer-Policy", value: "no-referrer" }] },
    ];
  },
};

export default withNextIntl(nextConfig);
