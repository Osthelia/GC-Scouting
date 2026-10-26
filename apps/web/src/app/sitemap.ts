/**
 * GC-Scouting - sitemap
 *
 * sitemap.xml, static pages, every post type list and every visible post, computed on each request.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

import type { MetadataRoute } from "next";
import { db } from "@scouting/db/client";
import { posts, visiblePost } from "@scouting/db";
import { routing } from "@/i18n/routing";
import { appUrl } from "@/lib/app-url";
import { POST_TYPES } from "@/lib/post-types";

type ChangeFrequency = MetadataRoute.Sitemap[number]["changeFrequency"];

const STATIC_PATHS: Array<{ path: string; priority: number; changeFrequency: ChangeFrequency }> = [
  { path: "", priority: 1, changeFrequency: "daily" },
  ...POST_TYPES.map((t) => ({ path: `/posts/${t.key}`, priority: 0.9, changeFrequency: "hourly" as const })),
  { path: "/tierlist", priority: 0.5, changeFrequency: "monthly" },
  { path: "/legal", priority: 0.2, changeFrequency: "yearly" },
  { path: "/privacy", priority: 0.2, changeFrequency: "yearly" },
];

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = appUrl();

  // Visible posts only, closed, deleted and expired ones drop out on their own.
  const postRows = await db
    .select({ id: posts.id, type: posts.type, updatedAt: posts.updatedAt, bumpedAt: posts.bumpedAt })
    .from(posts)
    .where(visiblePost())
    .orderBy(posts.id);

  return [
    ...STATIC_PATHS.map(({ path, priority, changeFrequency }) => ({ ...localizedEntry(base, path), priority, changeFrequency })),
    ...postRows.map((p) => ({
      ...localizedEntry(base, `/posts/${p.type}/${p.id}`),
      priority: 0.7,
      changeFrequency: "daily" as const,
      lastModified: p.updatedAt > p.bumpedAt ? p.updatedAt : p.bumpedAt,
    })),
  ];
}

/** One entry per path, `url` on the default locale plus `alternates.languages` for every locale (localePrefix is "always"). */
function localizedEntry(base: string, path: string): { url: string; alternates: { languages: Record<string, string> } } {
  const languages = Object.fromEntries(routing.locales.map((locale) => [locale, `${base}/${locale}${path}`]));
  return { url: `${base}/${routing.defaultLocale}${path}`, alternates: { languages } };
}
