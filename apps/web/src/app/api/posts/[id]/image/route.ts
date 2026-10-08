/**
 * GC-Scouting - id image route
 *
 * Share image of a post (OG, Twitter, Discord), cached in R2.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

import type { NextRequest } from "next/server";
import { and, eq, isNull, ne } from "drizzle-orm";
import { db } from "@scouting/db/client";
import { parseId, posts } from "@scouting/db";
import { shareImageVersion } from "@scouting/db/share-image";
import { getShareImage } from "@/lib/share-image";
import { loggable } from "@scouting/db/log";

// Share image of a post (?v=<version>). Closed and expired posts keep theirs, like their page.
// Stored images are deleted with the post (author deletion, account deletion), never from here.

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const postId = parseId(id);
  if (!postId) return new Response("Not found", { status: 404 });

  const [post] = await db
    .select({
      id: posts.id,
      type: posts.type,
      displayName: posts.displayName,
      region: posts.region,
      country: posts.country,
      rosterSpot: posts.rosterSpot,
      roles: posts.roles,
      igl: posts.igl,
      staffRoles: posts.staffRoles,
      rankCurrent: posts.rankCurrent,
      rankPeak: posts.rankPeak,
      rankMin: posts.rankMin,
      rankMax: posts.rankMax,
      tierList: posts.tierList,
    })
    .from(posts)
    .where(and(eq(posts.id, postId), isNull(posts.deletedAt), ne(posts.status, "removed")))
    .limit(1);
  if (!post) return new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });

  try {
    const png = await getShareImage(post, request.nextUrl.origin);
    // A versioned URL never changes, an outdated or missing version gets the current image for a short while.
    const current = request.nextUrl.searchParams.get("v") === shareImageVersion(post);
    return new Response(png, {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": current ? "public, max-age=31536000, immutable" : "public, max-age=300",
      },
    });
  } catch (error) {
    console.error("Share image failed", postId, loggable(error));
    return new Response("Image unavailable", { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
