/**
 * GC-Scouting - admin users page
 *
 * Admin list of users.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

import type { Metadata } from "next";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { USER_ROLES } from "@scouting/db/constants";
import { requireStaff } from "@/lib/admin/access";
import { adminMetadata } from "@/lib/admin/metadata";
import { ADMIN_PAGE_SIZE, listAdminUsers } from "@/lib/admin/queries";
import { AdminEmpty, AdminPageHeader, AdminPagination, AdminUserCell, pageParam, clampPage } from "@/components/admin/admin-common";
import { AdminFilterBar } from "@/components/admin/admin-actions";
import { RecentAccountBadge } from "@/components/admin/recent-account-badge";
import { Badge } from "@/components/admin/ui/badge";
import { Card } from "@/components/admin/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/admin/ui/table";

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<{ q?: string; role?: string; page?: string }> };

export function generateMetadata({ params }: Props): Promise<Metadata> {
  return adminMetadata(params, "users");
}

export default async function AdminUsersPage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireStaff(locale, `/${locale}/admin/users`);
  const sp = await searchParams;
  const q = (sp.q ?? "").trim().slice(0, 100);
  const role = USER_ROLES.find((r) => r === sp.role) ?? "";
  const page = pageParam(sp.page);
  const t = await getTranslations("admin");
  const format = await getFormatter();
  const { rows, total } = await listAdminUsers({ q, role, page });
  clampPage({ locale, pathname: "/admin/users", page, total, pageSize: ADMIN_PAGE_SIZE, query: { q, role } });

  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader title={t("users.title")} subtitle={t("users.subtitle")} />
      <AdminFilterBar
        search={q}
        searchPlaceholder={t("users.search")}
        filters={[{ name: "role", value: role, label: t("access.role"), options: [{ value: "", label: t("users.anyRole") }, ...USER_ROLES.map((r) => ({ value: r, label: t(`roles.${r}`) }))] }]}
      />
      {rows.length === 0 ? (
        <AdminEmpty text={t("users.empty")} />
      ) : (
        <Card className="py-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("users.user")}</TableHead>
                <TableHead>{t("access.role")}</TableHead>
                <TableHead className="text-right">{t("users.posts")}</TableHead>
                <TableHead>{t("users.gcsAccount")}</TableHead>
                <TableHead>{t("users.lastLogin")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>
                    <AdminUserCell user={user} sanctions={user.sanctions} />
                  </TableCell>
                  <TableCell>{user.role !== "user" ? <Badge variant="outline">{t(`roles.${user.role}`)}</Badge> : <span className="text-muted-foreground">{t("roles.user")}</span>}</TableCell>
                  <TableCell className="text-right tabular-nums">{user.posts}</TableCell>
                  <TableCell className="text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5">
                      {user.gcsCreatedAt ? format.dateTime(user.gcsCreatedAt, { dateStyle: "medium" }) : "-"}
                      <RecentAccountBadge createdAt={user.gcsCreatedAt ?? user.createdAt} />
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{user.lastLoginAt ? format.relativeTime(user.lastLoginAt) : "-"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
      <AdminPagination pathname="/admin/users" page={page} total={total} pageSize={ADMIN_PAGE_SIZE} query={{ q, role }} />
    </div>
  );
}
