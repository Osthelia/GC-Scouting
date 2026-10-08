/**
 * GC-Scouting - admin conversations page
 *
 * Admin list of conversations.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

import type { Metadata } from "next";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { requireStaff } from "@/lib/admin/access";
import { adminMetadata } from "@/lib/admin/metadata";
import { Link } from "@/i18n/navigation";
import { ADMIN_PAGE_SIZE, listAdminConversations } from "@/lib/admin/queries";
import { AdminEmpty, AdminPageHeader, AdminPagination, AdminUserCell, pageParam, clampPage } from "@/components/admin/admin-common";
import { AdminFilterBar } from "@/components/admin/admin-actions";
import { Badge } from "@/components/admin/ui/badge";
import { Card } from "@/components/admin/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/admin/ui/table";

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<{ q?: string; page?: string }> };

export function generateMetadata({ params }: Props): Promise<Metadata> {
  return adminMetadata(params, "conversations");
}

export default async function AdminConversationsPage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireStaff(locale, `/${locale}/admin/conversations`);
  const sp = await searchParams;
  const t = await getTranslations("admin.conversations");
  const format = await getFormatter();
  const q = (sp.q ?? "").trim().slice(0, 100);
  const page = pageParam(sp.page);
  const { rows, total } = await listAdminConversations({ q, page });
  clampPage({ locale, pathname: "/admin/conversations", page, total, pageSize: ADMIN_PAGE_SIZE, query: { q } });

  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader title={t("title")} subtitle={t("subtitle")} />
      <AdminFilterBar search={q} searchPlaceholder={t("search")} />
      {rows.length === 0 ? (
        <AdminEmpty text={t("empty")} />
      ) : (
        <Card className="py-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("members")}</TableHead>
                <TableHead className="text-right">{t("messages")}</TableHead>
                <TableHead>{t("flags")}</TableHead>
                <TableHead>{t("lastMessage")}</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      {row.members.map((m) => (
                        <AdminUserCell key={m.id} user={m} />
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{row.messages}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {row.held > 0 && <Badge className="bg-amber-400/15 text-amber-400">{t("held", { count: row.held })}</Badge>}
                      {row.reportsOpen > 0 && <Badge variant="destructive">{t("reports", { count: row.reportsOpen })}</Badge>}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{format.relativeTime(row.lastMessageAt)}</TableCell>
                  <TableCell className="text-right">
                    <Link href={`/admin/conversations/${row.id}`} className="text-sm font-medium text-primary hover:underline active:opacity-70">
                      {t("open")}
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
      <AdminPagination pathname="/admin/conversations" page={page} total={total} pageSize={ADMIN_PAGE_SIZE} query={{ q }} />
    </div>
  );
}
