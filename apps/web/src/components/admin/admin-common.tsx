/**
 * GC-Scouting - admin-common
 *
 * Shared building blocks of the admin pages (header, stat cards, empty states).
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

import type { ComponentType, ReactNode } from "react";
import { ChevronLeft, ChevronRight, ExternalLink } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { activeSanctions } from "@/lib/sanction-rules";
import { Link, redirect } from "@/i18n/navigation";
import { GCS_URL } from "@/lib/gcs";
import type { GcsSanction } from "@scouting/db";
import type { AdminUserRef } from "@/lib/admin/queries";
import { Card, CardContent } from "@/components/admin/ui/card";
import { Button } from "@/components/admin/ui/button";
import { Badge } from "@/components/admin/ui/badge";
import { UserAvatar } from "@/components/auth/user-menu";
import { cn } from "@/lib/utils";

export function AdminPageHeader({ title, subtitle, children }: { title: string; subtitle?: string; children?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

const COLOR_STYLES = {
  amber: "bg-amber-400/10 text-amber-400",
  emerald: "bg-emerald-400/10 text-emerald-400",
  destructive: "bg-destructive/10 text-destructive",
  sky: "bg-sky-400/10 text-sky-400",
  violet: "bg-violet-400/10 text-violet-400",
  muted: "bg-muted text-muted-foreground",
} as const;

export function AdminStatCard({
  label,
  value,
  icon: Icon,
  color,
  href,
}: {
  label: string;
  value: ReactNode;
  icon: ComponentType<{ className?: string }>;
  color: keyof typeof COLOR_STYLES;
  href?: string;
}) {
  const card = (
    <Card className={cn(href && "transition-colors hover:bg-accent active:scale-[0.99]")}>
      <CardContent className="flex items-center gap-3 py-1">
        <div className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg", COLOR_STYLES[color])}>
          <Icon className="size-4.5" />
        </div>
        <div className="flex flex-col">
          <span className="text-xl font-bold tabular-nums">{value}</span>
          <span className="text-xs text-muted-foreground">{label}</span>
        </div>
      </CardContent>
    </Card>
  );
  return href ? <Link href={href}>{card}</Link> : card;
}

export function AdminPagination({ pathname, page, total, pageSize, query }: { pathname: string; page: number; total: number; pageSize: number; query: Record<string, string> }) {
  const t = useTranslations("admin.common");
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (total === 0) return null;
  if (totalPages <= 1) return <p className="text-sm text-muted-foreground">{t("total", { count: total })}</p>;
  const href = (p: number) => pageHref(pathname, query, p);

  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-sm text-muted-foreground">{t("total", { count: total })}</span>
      <div className="flex items-center gap-2">
        {page <= 1 ? (
          <Button variant="outline" size="sm" disabled aria-label={t("previous")}>
            <ChevronLeft className="size-4" />
          </Button>
        ) : (
          <Button variant="outline" size="sm" aria-label={t("previous")} render={<Link href={href(page - 1)} />}>
            <ChevronLeft className="size-4" />
          </Button>
        )}
        <span className="text-sm text-muted-foreground tabular-nums">
          {page} / {totalPages}
        </span>
        {page >= totalPages ? (
          <Button variant="outline" size="sm" disabled aria-label={t("next")}>
            <ChevronRight className="size-4" />
          </Button>
        ) : (
          <Button variant="outline" size="sm" aria-label={t("next")} render={<Link href={href(page + 1)} />}>
            <ChevronRight className="size-4" />
          </Button>
        )}
      </div>
    </div>
  );
}

/** GC Stats admin page of an account: bans and other sanctions are given there. */
export function gcsAdminUserUrl(locale: string, gcsUserId: string): string {
  return `${GCS_URL}/${locale}/admin/users/${encodeURIComponent(gcsUserId)}`;
}

export function GcsAdminLink({ gcsUserId, label }: { gcsUserId: string; label?: boolean }) {
  const t = useTranslations("admin.common");
  const locale = useLocale();
  return (
    <a
      href={gcsAdminUserUrl(locale, gcsUserId)}
      target="_blank"
      rel="noopener noreferrer"
      title={t("gcsAdmin")}
      aria-label={t("gcsAdmin")}
      className="inline-flex items-center gap-1 rounded-md text-xs font-medium text-muted-foreground transition-colors hover:text-primary active:opacity-70"
    >
      <ExternalLink className="size-3.5" />
      {label && t("gcsAdmin")}
    </a>
  );
}

export function SanctionBadges({ sanctions }: { sanctions: GcsSanction[] }) {
  const t = useTranslations("admin.sanctions");
  const active = activeSanctions(sanctions);
  if (!active.length) return null;
  return (
    <>
      {[...new Set(active.map((s) => s.type))].map((type) => (
        <Badge key={type} variant={type === "warning" ? "secondary" : "destructive"} className={cn(type === "warning" && "bg-amber-400/15 text-amber-400")}>
          {t(type)}
        </Badge>
      ))}
    </>
  );
}

/** Avatar, name linking to the admin page of the account, and its GC Stats admin page. */
export function AdminUserCell({ user, sanctions }: { user: AdminUserRef; sanctions?: GcsSanction[] }) {
  return (
    <span className="inline-flex min-w-0 items-center gap-2">
      <UserAvatar user={user} size={24} />
      <Link href={`/admin/users/${user.id}`} className="truncate font-medium transition-colors hover:text-primary active:opacity-70">
        {user.username}
      </Link>
      <GcsAdminLink gcsUserId={user.gcsUserId} />
      {sanctions && <SanctionBadges sanctions={sanctions} />}
    </span>
  );
}

export function AdminEmpty({ text }: { text: string }) {
  return <p className="rounded-xl border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">{text}</p>;
}

const MAX_PAGE = 100_000;

function pageHref(pathname: string, query: Record<string, string>, page: number) {
  const clean = Object.fromEntries(Object.entries(query).filter(([, v]) => v !== ""));
  return { pathname, query: { ...clean, page: String(page) } };
}

/** Page number from the query, 1 when missing, invalid or out of bounds. */
export function pageParam(value: string | undefined): number {
  if (!value || !/^\d{1,6}$/.test(value)) return 1;
  const page = Number(value);
  return page >= 1 && page <= MAX_PAGE ? page : 1;
}

/** A page past the last one (stale link after a filter or deletions) goes to the last page. */
export function clampPage({ locale, pathname, page, total, pageSize, query }: { locale: string; pathname: string; page: number; total: number; pageSize: number; query: Record<string, string> }) {
  const last = Math.max(1, Math.ceil(total / pageSize));
  if (page > last) redirect({ href: pageHref(pathname, query, last), locale });
}
