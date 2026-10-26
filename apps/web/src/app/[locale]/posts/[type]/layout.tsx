/**
 * GC-Scouting - posts type layout
 *
 * Layout shared by the pages of a post type.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

import { notFound } from "next/navigation";
import { isPostType } from "@/lib/post-types";

// Checked above the `loading.tsx` boundaries so an unknown type answers with a 404 status.
export default async function PostTypeLayout({ children, params }: { children: React.ReactNode; params: Promise<{ type: string }> }) {
  if (!isPostType((await params).type)) notFound();
  return children;
}
