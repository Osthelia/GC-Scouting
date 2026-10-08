/**
 * GC-Scouting - home share-image route
 *
 * Share image of the home page.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

import type { NextRequest } from "next/server";
import { shareImageVersion } from "@scouting/db/share-image";
import { DEMO_POST } from "@/lib/demo-post";
import { getShareImage } from "@/lib/share-image";
import { loggable } from "@scouting/db/log";

// Share image of the home page example post (?v=<version>), rendered once per version and stored like the posts ones.

export async function GET(request: NextRequest) {
  const version = shareImageVersion(DEMO_POST);
  // Any other version is sent to the current one, so a made up `v` cannot force a render.
  if (request.nextUrl.searchParams.get("v") !== version) {
    const url = request.nextUrl.clone();
    url.search = `?v=${version}`;
    return Response.redirect(url, 302);
  }
  try {
    const png = await getShareImage(DEMO_POST, request.nextUrl.origin, "home/demo.png");
    return new Response(png, { headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=31536000, immutable" } });
  } catch (error) {
    console.error("Demo share image failed", loggable(error));
    return new Response("Image unavailable", { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
