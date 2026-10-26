/**
 * GC-Scouting - admin automod page
 *
 * Admin list of messages flagged by the automatic moderation.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { requireStaff } from "@/lib/admin/access";
import { adminMetadata } from "@/lib/admin/metadata";
import { Link } from "@/i18n/navigation";
import { ADMIN_PAGE_SIZE, listHeldMessages } from "@/lib/admin/queries";
import { AdminEmpty, AdminPageHeader, AdminPagination, AdminUserCell, pageParam, clampPage } from "@/components/admin/admin-common";
import { AdminMessageCard } from "@/components/admin/admin-message-card";

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<{ page?: string }> };

export function generateMetadata({ params }: Props): Promise<Metadata> {
  return adminMetadata(params, "automod");
}

export default async function AdminAutomodPage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireStaff(locale, `/${locale}/admin/automod`);
  const page = pageParam((await searchParams).page);
  const t = await getTranslations("admin.automod");
  const { rows, total } = await listHeldMessages(page);
  clampPage({ locale, pathname: "/admin/automod", page, total, pageSize: ADMIN_PAGE_SIZE, query: {} });

  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader title={t("title")} subtitle={t("subtitle")} />
      {rows.length === 0 ? (
        <AdminEmpty text={t("empty")} />
      ) : (
        <div className="flex flex-col gap-3">
          {rows.map((row) => (
            <div key={row.id} className="flex flex-col gap-1.5">
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <AdminUserCell user={row.sender} />
                <Link href={`/admin/conversations/${row.conversationId}`} className="text-xs font-medium text-primary hover:underline active:opacity-70">
                  {t("context")}
                </Link>
              </div>
              <AdminMessageCard message={{ ...row, status: "blocked" }} sender={row.sender.username} />
            </div>
          ))}
        </div>
      )}
      <AdminPagination pathname="/admin/automod" page={page} total={total} pageSize={ADMIN_PAGE_SIZE} query={{}} />
    </div>
  );
}
