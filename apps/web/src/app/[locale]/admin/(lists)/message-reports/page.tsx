/**
 * GC-Scouting - admin message-reports page
 *
 * Admin list of reported chat messages.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

import type { Metadata } from "next";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { EyeOff, X } from "lucide-react";
import { requireStaff } from "@/lib/admin/access";
import { adminMetadata } from "@/lib/admin/metadata";
import { Link } from "@/i18n/navigation";
import { ADMIN_PAGE_SIZE, listMessageReports, type ReportStatus } from "@/lib/admin/queries";
import { handleMessageReport } from "@/actions/admin";
import { AdminEmpty, AdminPageHeader, AdminPagination, AdminUserCell, pageParam, clampPage } from "@/components/admin/admin-common";
import { AdminActionButton, AdminFilterBar } from "@/components/admin/admin-actions";
import { AdminMessageCard } from "@/components/admin/admin-message-card";
import { Badge } from "@/components/admin/ui/badge";
import { Card, CardContent } from "@/components/admin/ui/card";

const STATUSES: ReportStatus[] = ["open", "handled", "dismissed"];

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<{ status?: string; page?: string }> };

export function generateMetadata({ params }: Props): Promise<Metadata> {
  return adminMetadata(params, "messageReports");
}

export default async function AdminMessageReportsPage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireStaff(locale, `/${locale}/admin/message-reports`);
  const sp = await searchParams;
  const status = STATUSES.find((s) => s === sp.status) ?? "open";
  const page = pageParam(sp.page);
  const t = await getTranslations("admin");
  const tReasons = await getTranslations("report.reasons");
  const format = await getFormatter();
  const { rows, total } = await listMessageReports({ status, page });
  clampPage({ locale, pathname: "/admin/message-reports", page, total, pageSize: ADMIN_PAGE_SIZE, query: { status: status === "open" ? "" : status } });

  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader title={t("messageReports.title")} subtitle={t("messageReports.subtitle")} />
      <AdminFilterBar filters={[{ name: "status", value: status === "open" ? "" : status, label: t("reportStatus.label"), options: STATUSES.map((s) => ({ value: s === "open" ? "" : s, label: t(`reportStatus.${s}`) })) }]} />
      {rows.length === 0 ? (
        <AdminEmpty text={t("messageReports.empty")} />
      ) : (
        <div className="flex flex-col gap-3">
          {rows.map((report) => (
            <Card key={report.id} className="py-4">
              <CardContent className="flex flex-col gap-3">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <Badge variant="destructive">{tReasons(`${report.reason}.label`)}</Badge>
                  <span className="text-muted-foreground">{t("messageReports.by")}</span>
                  {report.reporter ? <AdminUserCell user={report.reporter} /> : <span>?</span>}
                  <span className="text-xs text-muted-foreground">{format.relativeTime(report.createdAt)}</span>
                  {report.handledBy && <span className="text-xs text-muted-foreground">{t(`reportStatus.${report.status}By`, { name: report.handledBy })}</span>}
                  <Link href={`/admin/conversations/${report.message.conversationId}`} className="ml-auto text-xs font-medium text-primary hover:underline active:opacity-70">
                    {t("automod.context")}
                  </Link>
                </div>
                {report.details && <p className="border-l-2 pl-3 text-sm whitespace-pre-line text-muted-foreground">{report.details}</p>}
                <AdminMessageCard
                  message={{ ...report.message, moderation: null }}
                  sender={<AdminUserCell user={report.message.sender} />}
                  actions={
                    report.status === "open" ? (
                      <>
                        <AdminActionButton label={t("messageReports.hide")} icon={<EyeOff />} variant="destructive" action={handleMessageReport.bind(null, report.id, "hide")} />
                        <AdminActionButton label={t("messageReports.dismiss")} icon={<X />} action={handleMessageReport.bind(null, report.id, "dismiss")} />
                      </>
                    ) : null
                  }
                />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      <AdminPagination pathname="/admin/message-reports" page={page} total={total} pageSize={ADMIN_PAGE_SIZE} query={{ status: status === "open" ? "" : status }} />
    </div>
  );
}
