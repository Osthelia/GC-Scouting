/**
 * GC-Scouting - messages id layout
 *
 * Layout of a conversation page.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

import { notFound } from "next/navigation";
import { parseId } from "@scouting/db";
import { getActiveProfile } from "@/lib/auth/session";
import { conversationPeerId, switchableProfile } from "@/lib/chat/queries";

// Checked above the `loading.tsx` boundary so an unreachable conversation answers with a 404 status.
export default async function ConversationLayout({ children, params }: { children: React.ReactNode; params: Promise<{ id: string }> }) {
  const conversationId = parseId((await params).id);
  const profile = await getActiveProfile();
  if (!conversationId) notFound();
  // Signed out visitors get the login gate of the parent layout.
  if (profile && !(await conversationPeerId(conversationId, profile.id)) && !(await switchableProfile(conversationId, profile.actorId))) notFound();
  return children;
}
