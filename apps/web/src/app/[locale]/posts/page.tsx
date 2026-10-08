/**
 * GC-Scouting - posts page
 *
 * Posts entry page, redirects to the first post type.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

import { redirect } from "@/i18n/navigation";

export default async function PostsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  redirect({ href: "/posts/lft", locale });
}
