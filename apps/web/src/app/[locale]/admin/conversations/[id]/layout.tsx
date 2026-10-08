/**
 * GC-Scouting - conversations id layout
 *
 * Layout of the admin conversation page, checks the staff role.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

import { notFound } from "next/navigation";
import { parseId } from "@scouting/db";
import { requireStaff } from "@/lib/admin/access";
import { adminConversationExists } from "@/lib/admin/queries";

// Checked above the `loading.tsx` boundary so a missing conversation answers with a 404 status.
export default async function AdminConversationLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  await requireStaff(locale, `/${locale}/admin/conversations/${encodeURIComponent(id)}`);
  const conversationId = parseId(id);
  if (!conversationId || !(await adminConversationExists(conversationId))) notFound();
  return children;
}
