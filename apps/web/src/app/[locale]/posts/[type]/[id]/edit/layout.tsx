/**
 * GC-Scouting - id edit layout
 *
 * Layout of the post edit page, restricted to the author.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

import { notFound } from "next/navigation";
import { parseId } from "@scouting/db";
import { getActiveProfile } from "@/lib/auth/session";
import { getStaffUser } from "@/lib/admin/access";
import { isPostAuthor } from "@/lib/posts-query";

// Same rule as the page, checked above its `loading.tsx` so the 404 status is kept. Signed out visitors get the login gate of the page.
export default async function EditPostLayout({ children, params }: { children: React.ReactNode; params: Promise<{ id: string }> }) {
  const postId = parseId((await params).id);
  const user = await getActiveProfile();
  if (postId && user) {
    const [isAuthor, staff] = await Promise.all([isPostAuthor(postId, user.id), getStaffUser()]);
    if (!isAuthor && !staff) notFound();
  }
  return children;
}
