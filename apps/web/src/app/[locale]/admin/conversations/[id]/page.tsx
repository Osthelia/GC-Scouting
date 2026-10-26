/**
 * GC-Scouting - conversations id page
 *
 * Admin view of a conversation and its messages.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ArrowLeft } from "lucide-react";
import { requireStaff } from "@/lib/admin/access";
import { adminMetadata } from "@/lib/admin/metadata";
import { Link } from "@/i18n/navigation";
import { getAdminConversation } from "@/lib/admin/queries";
import { parseId } from "@scouting/db";
import { POST_TYPE_BY_KEY } from "@/lib/post-types";
import { AdminPageHeader, AdminUserCell } from "@/components/admin/admin-common";
import { AdminMessageCard } from "@/components/admin/admin-message-card";
import { Badge } from "@/components/admin/ui/badge";
import { Card, CardContent } from "@/components/admin/ui/card";
import { cn } from "@/lib/utils";

type Props = { params: Promise<{ locale: string; id: string }>; searchParams: Promise<{ before?: string }> };

export function generateMetadata({ params }: Props): Promise<Metadata> {
  return adminMetadata(params, "conversations");
}

export default async function AdminConversationPage({ params, searchParams }: Props) {
  const { locale, id } = await params;
  const before = parseId((await searchParams).before);
  setRequestLocale(locale);
  await requireStaff(locale, `/${locale}/admin/conversations/${encodeURIComponent(id)}`);
  const conversationId = parseId(id);
  const conversation = conversationId ? await getAdminConversation(conversationId, before) : null;
  if (!conversation) notFound();
  const t = await getTranslations("admin");
  const firstId = conversation.members[0]?.id;

  return (
    <div className="flex flex-col gap-6">
      <Link href="/admin/conversations" className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground active:opacity-70">
        <ArrowLeft className="size-4" />
        {t("conversations.back")}
      </Link>
      <AdminPageHeader title={t("conversations.detailTitle", { id: conversation.id })}>
        {conversation.post && (
          <Link href={`/posts/${conversation.post.type}/${conversation.post.id}`} className="text-sm text-primary hover:underline active:opacity-70">
            {t("conversations.fromPost", { code: POST_TYPE_BY_KEY[conversation.post.type].code, name: conversation.post.displayName })}
          </Link>
        )}
      </AdminPageHeader>

      <div className="flex flex-wrap gap-3">
        {conversation.members.map((m) => (
          <Card key={m.id} className="py-3">
            <CardContent className="flex items-center gap-2">
              <AdminUserCell user={m} sanctions={m.sanctions} />
              {m.role !== "user" && <Badge variant="outline">{t(`roles.${m.role}`)}</Badge>}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex flex-col gap-3">
        {(conversation.hasOlder || before) && (
          <div className="flex justify-center gap-4 text-sm">
            {conversation.hasOlder && conversation.messages[0] && (
              <Link href={`/admin/conversations/${conversation.id}?before=${conversation.messages[0].id}`} className="text-primary hover:underline active:opacity-70">
                {t("conversations.older")}
              </Link>
            )}
            {before && (
              <Link href={`/admin/conversations/${conversation.id}`} className="text-primary hover:underline active:opacity-70">
                {t("conversations.latest")}
              </Link>
            )}
          </div>
        )}
        {conversation.messages.length === 0 && <p className="text-sm text-muted-foreground">{t("conversations.noMessages")}</p>}
        {conversation.messages.map((message) => (
          <div key={message.id} className={cn("flex", message.senderId === firstId ? "justify-start" : "justify-end")}>
            <AdminMessageCard
              message={message}
              sender={conversation.members.find((m) => m.id === message.senderId)?.username ?? "?"}
              className="max-w-[min(90%,640px)]"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
