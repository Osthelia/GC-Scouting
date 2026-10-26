/**
 * GC-Scouting - robots
 *
 * robots.txt, search engines allowed on the public pages, AI crawlers and scrapers refused.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

import type { MetadataRoute } from "next";
import { appUrl } from "@/lib/app-url";

// AI training / AI assistant crawlers.
const AI_BOTS = [
  "GPTBot",
  "ChatGPT-User",
  "OAI-SearchBot",
  "ClaudeBot",
  "Claude-User",
  "Claude-SearchBot",
  "anthropic-ai",
  "Google-Extended",
  "GoogleOther",
  "Applebot-Extended",
  "CCBot",
  "PerplexityBot",
  "Perplexity-User",
  "Bytespider",
  "meta-externalagent",
  "meta-externalfetcher",
  "FacebookBot",
  "Amazonbot",
  "cohere-ai",
  "cohere-training-data-crawler",
  "Diffbot",
  "YouBot",
  "AI2Bot",
  "Ai2Bot-Dolma",
  "DuckAssistBot",
  "MistralAI-User",
  "PanguBot",
  "Timpibot",
  "omgili",
  "omgilibot",
  "ImagesiftBot",
  "Kangaroo Bot",
  "img2dataset",
  "webzio-extended",
];

// SEO tools and generic scrapers.
const SCRAPER_BOTS = [
  "AhrefsBot",
  "SemrushBot",
  "MJ12bot",
  "DotBot",
  "BLEXBot",
  "DataForSeoBot",
  "SeekportBot",
  "PetalBot",
  "magpie-crawler",
  "Scrapy",
  "python-requests",
  "Go-http-client",
  "curl",
  "Wget",
];

// Private or non-indexable areas, under every locale prefix. `/t/` short links redirect to the post pages.
const PRIVATE_PATHS = [
  "/api/",
  "/t/",
  "/*/admin",
  "/*/account",
  "/*/me",
  "/*/messages",
  "/*/auth/",
  "/*/invite/",
  "/*/manage/",
  "/*/posts/new",
  "/*/posts/*/*/edit",
];

// `APP_URL` is only known at runtime.
export const dynamic = "force-dynamic";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: [...AI_BOTS, ...SCRAPER_BOTS], disallow: "/" },
      { userAgent: "*", allow: "/", disallow: PRIVATE_PATHS },
    ],
    sitemap: `${appUrl()}/sitemap.xml`,
  };
}
