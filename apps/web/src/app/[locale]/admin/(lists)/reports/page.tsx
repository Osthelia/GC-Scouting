/**
 * GC-Scouting - admin reports page
 *
 * Admin list of reported posts.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

import type { Metadata } from "next";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { X } from "lucide-react";
import { requireStaff } from "@/lib/admin/access";
import { adminMetadata } from "@/lib/admin/metadata";
import { Link } from "@/i18n/navigation";
import { ADMIN_PAGE_SIZE, listPostReports, type ReportStatus } from "@/lib/admin/queries";
import { dismissPostReport, removePostAsStaff } from "@/actions/admin";
import { AdminEmpty, AdminPageHeader, AdminPagination, pageParam, clampPage } from "@/components/admin/admin-common";
import { AdminActionButton, AdminFilterBar, RemovePostDialog } from "@/components/admin/admin-actions";
import { PostTypeBadge } from "@/components/post/badges";
import { Badge } from "@/components/admin/ui/badge";
import { Card, CardContent } from "@/components/admin/ui/card";

const STATUSES: ReportStatus[] = ["open", "handled", "dismissed"];

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<{ status?: string; page?: string }> };

export function generateMetadata({ params }: Props): Promise<Metadata> {
  return adminMetadata(params, "postReports");
}

export default async function AdminPostReportsPage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireStaff(locale, `/${locale}/admin/reports`);
  const sp = await searchParams;
  const status = STATUSES.find((s) => s === sp.status) ?? "open";
  const page = pageParam(sp.page);
  const t = await getTranslations("admin");
  const tReasons = await getTranslations("report.reasons");
  const format = await getFormatter();
  const { rows, total } = await listPostReports({ status, page });
  clampPage({ locale, pathname: "/admin/reports", page, total, pageSize: ADMIN_PAGE_SIZE, query: { status: status === "open" ? "" : status } });

  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader title={t("postReports.title")} subtitle={t("postReports.subtitle")} />
      <AdminFilterBar filters={[{ name: "status", value: status === "open" ? "" : status, label: t("reportStatus.label"), options: STATUSES.map((s) => ({ value: s === "open" ? "" : s, label: t(`reportStatus.${s}`) })) }]} />
      {rows.length === 0 ? (
        <AdminEmpty text={t("postReports.empty")} />
      ) : (
        <div className="flex flex-col gap-3">
          {rows.map((report) => (
            <Card key={report.id} className="py-4">
              <CardContent className="flex flex-col gap-3">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <PostTypeBadge type={report.post.type} />
                  <Link href={`/posts/${report.post.type}/${report.post.id}`} className="font-semibold hover:text-primary active:opacity-70">
                    {report.post.displayName}
                  </Link>
                  {!report.post.visible && <Badge variant="outline">{t(`postReports.postState.${report.post.status}`)}</Badge>}
                  <Badge variant="destructive">{tReasons(`${report.reason}.label`)}</Badge>
                  <span className="text-xs text-muted-foreground">
                    {t("postReports.by", { name: report.reporter.username ?? report.reporter.discordId ?? "?" })}, {format.relativeTime(report.createdAt)}
                  </span>
                  {report.handledBy && <span className="text-xs text-muted-foreground">{t(`reportStatus.${report.status}By`, { name: report.handledBy })}</span>}
                </div>
                {report.details && <p className="border-l-2 pl-3 text-sm whitespace-pre-line text-muted-foreground">{report.details}</p>}
                {report.status === "open" && (
                  <div className="flex flex-wrap gap-1.5">
                    {report.post.visible && <RemovePostDialog postName={report.post.displayName} trigger={t("posts.remove")} action={removePostAsStaff.bind(null, report.post.id)} />}
                    <AdminActionButton label={t("postReports.dismiss")} icon={<X />} action={dismissPostReport.bind(null, report.id)} />
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      <AdminPagination pathname="/admin/reports" page={page} total={total} pageSize={ADMIN_PAGE_SIZE} query={{ status: status === "open" ? "" : status }} />
    </div>
  );
}
