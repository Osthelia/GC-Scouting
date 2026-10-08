/**
 * GC-Scouting - messages id loading
 *
 * Loading skeleton of a conversation.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

"use client";

import { ConversationLoading } from "@/components/chat/conversation-view";

export default function Loading() {
  return (
    <section className="flex min-w-0 flex-1 flex-col">
      <ConversationLoading />
    </section>
  );
}
