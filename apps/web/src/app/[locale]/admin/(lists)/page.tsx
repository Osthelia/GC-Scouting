/**
 * GC-Scouting - admin page
 *
 * Admin dashboard with the key counters.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { FileText, Flag, MessageSquareWarning, MessagesSquare, Send, ShieldAlert, ShieldCheck, Users } from "lucide-react";
import { requireStaff } from "@/lib/admin/access";
import { adminMetadata } from "@/lib/admin/metadata";
import { adminPending, adminStats } from "@/lib/admin/queries";
import { AdminPageHeader, AdminStatCard } from "@/components/admin/admin-common";

type Props = { params: Promise<{ locale: string }> };

export function generateMetadata({ params }: Props): Promise<Metadata> {
  return adminMetadata(params, "dashboard");
}

export default async function AdminDashboard({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireStaff(locale);
  const t = await getTranslations("admin.dashboard");
  const [pending, stats] = await Promise.all([adminPending(), adminStats()]);

  return (
    <div className="flex flex-col gap-8">
      <AdminPageHeader title={t("title")} subtitle={t("subtitle")} />

      <section className="flex flex-col gap-3">
        <h2 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">{t("todo")}</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <AdminStatCard label={t("held")} value={pending.held} icon={ShieldAlert} color={pending.held ? "amber" : "muted"} href="/admin/automod" />
          <AdminStatCard label={t("messageReports")} value={pending.messageReports} icon={MessageSquareWarning} color={pending.messageReports ? "destructive" : "muted"} href="/admin/message-reports" />
          <AdminStatCard label={t("postReports")} value={pending.postReports} icon={Flag} color={pending.postReports ? "destructive" : "muted"} href="/admin/reports" />
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">{t("activity")}</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <AdminStatCard label={t("activePosts")} value={stats.activePosts} icon={FileText} color="violet" href="/admin/posts?state=visible" />
          <AdminStatCard label={t("newPosts")} value={stats.newPosts} icon={FileText} color="sky" />
          <AdminStatCard label={t("activeConversations")} value={stats.activeConversations} icon={MessagesSquare} color="emerald" href="/admin/conversations" />
          <AdminStatCard label={t("messagesWeek")} value={stats.messagesWeek} icon={Send} color="sky" />
          <AdminStatCard label={t("users")} value={stats.users} icon={Users} color="violet" href="/admin/users" />
          <AdminStatCard label={t("staff")} value={stats.staff} icon={ShieldCheck} color="muted" href="/admin/users?role=staff" />
        </div>
      </section>
    </div>
  );
}
