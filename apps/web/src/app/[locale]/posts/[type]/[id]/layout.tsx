/**
 * GC-Scouting - type id layout
 *
 * Layout shared by the pages of a post.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

import { notFound } from "next/navigation";
import { parseId } from "@scouting/db";
import { getPost } from "@/lib/posts-query";

// Checked above the `loading.tsx` boundaries so a missing post answers with a 404 status.
export default async function PostLayout({ children, params }: { children: React.ReactNode; params: Promise<{ id: string }> }) {
  const postId = parseId((await params).id);
  if (!postId || !(await getPost(postId))) notFound();
  return children;
}
