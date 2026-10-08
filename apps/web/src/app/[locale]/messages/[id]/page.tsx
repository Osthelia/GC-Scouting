/**
 * GC-Scouting - messages id page
 *
 * Conversation page with its messages and composer.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { eq } from "drizzle-orm";
import { posts } from "@scouting/db";
import type { AppLocale } from "@/i18n/routing";
import { getActiveProfile } from "@/lib/auth/session";
import { getConversation, switchableProfile } from "@/lib/chat/queries";
import { listPosts } from "@/lib/posts-query";
import { parseId } from "@scouting/db";
import { ConversationView } from "@/components/chat/conversation-view";
import { PeerPostsAside, PeerPostsToggle } from "@/components/chat/peer-posts";
import { SwitchProfilePrompt } from "@/components/chat/switch-profile-prompt";

type Props = { params: Promise<{ locale: string; id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as AppLocale, namespace: "chat" });
  return { title: t("title"), robots: { index: false } };
}

export default async function ConversationPage({ params }: Props) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const conversationId = parseId(id);
  const profile = await getActiveProfile();
  if (!conversationId || !profile) notFound();

  const conversation = await getConversation(conversationId, profile);
  if (!conversation) {
    // Alert links lead here whatever profile is active.
    const target = await switchableProfile(conversationId, profile.actorId);
    if (!target) notFound();
    return (
      <section className="flex min-w-0 flex-1 flex-col">
        <SwitchProfilePrompt ownerId={target.id === profile.actorId ? null : target.id} name={target.username} />
      </section>
    );
  }
  const peerPosts = await listPosts({ where: eq(posts.authorId, conversation.peer.id), limit: 10 });

  return (
    <>
      <section className="flex min-w-0 flex-1 flex-col">
        <ConversationView key={conversation.id} initial={conversation} headerExtra={<PeerPostsToggle name={conversation.peer.username} posts={peerPosts} />} />
      </section>
      <PeerPostsAside name={conversation.peer.username} posts={peerPosts} />
    </>
  );
}
