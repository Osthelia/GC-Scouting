/**
 * GC-Scouting - messages layout
 *
 * Messages layout with the conversation list.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

import { Suspense } from "react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getActiveProfile } from "@/lib/auth/session";
import { CONVERSATIONS_PAGE_SIZE, listConversations } from "@/lib/chat/queries";
import { LoginGate } from "@/components/auth/login-gate";
import { ConversationSidebar, ConversationSidebarSkeleton } from "@/components/chat/conversation-list";

export default async function MessagesLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const profile = await getActiveProfile();

  if (!profile) {
    const t = await getTranslations("chat.login");
    return (
      <div className="mx-auto max-w-[960px] px-4 py-8 sm:px-6 sm:py-10">
        <LoginGate title={t("title")} text={t("text")} cta={t("cta")} next={`/${locale}/messages`} />
      </div>
    );
  }

  return (
    <div className="mx-auto flex h-[calc(100dvh-62px)] max-w-[1400px] border-neutral-800 sm:h-[calc(100dvh-66px)] lg:border-x">
      <Suspense fallback={<ConversationSidebarSkeleton />}>
        <Conversations profileId={profile.id} />
      </Suspense>
      {children}
    </div>
  );
}

async function Conversations({ profileId }: { profileId: string }) {
  return <ConversationSidebar initial={await listConversations(profileId)} pageSize={CONVERSATIONS_PAGE_SIZE} />;
}
