/**
 * GC-Scouting - admin access page
 *
 * Admin page that lists the staff members and their roles.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { requireAdmin } from "@/lib/admin/access";
import { adminMetadata } from "@/lib/admin/metadata";
import { listAdminUsers, listStaff } from "@/lib/admin/queries";
import { adminGcsUserIds } from "@/lib/auth/account";
import { AdminEmpty, AdminPageHeader, AdminUserCell } from "@/components/admin/admin-common";
import { AdminFilterBar } from "@/components/admin/admin-actions";
import { RoleSelect } from "@/components/admin/role-select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/admin/ui/card";

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<{ q?: string }> };

export function generateMetadata({ params }: Props): Promise<Metadata> {
  return adminMetadata(params, "access", { adminOnly: true });
}

/** Admins only: who is staff or admin, and the search to give a role. */
export default async function AdminAccessPage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const admin = await requireAdmin(locale);
  const q = ((await searchParams).q ?? "").trim().slice(0, 100);
  const t = await getTranslations("admin.access");
  const [staff, found] = await Promise.all([listStaff(), q ? listAdminUsers({ q, role: "", page: 1 }) : null]);
  const bootstrap = adminGcsUserIds();
  const locked = (user: { id: string; gcsUserId: string }) => user.id === admin.id || bootstrap.includes(user.gcsUserId);

  const row = (user: (typeof staff)[number]) => (
    <div key={user.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
      <AdminUserCell user={user} />
      <RoleSelect userId={user.id} role={user.role} disabled={locked(user)} />
    </div>
  );

  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader title={t("title")} subtitle={t("subtitle")} />

      <Card>
        <CardHeader>
          <CardTitle>{t("current")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col divide-y">{staff.map(row)}</CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("grant")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <AdminFilterBar search={q} searchPlaceholder={t("search")} />
          {found && (found.rows.length === 0 ? <AdminEmpty text={t("noResult")} /> : <div className="flex flex-col divide-y">{found.rows.map(row)}</div>)}
          <p className="text-xs text-muted-foreground">{t("hint")}</p>
        </CardContent>
      </Card>
    </div>
  );
}
