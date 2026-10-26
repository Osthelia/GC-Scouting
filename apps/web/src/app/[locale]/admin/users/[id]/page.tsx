/**
 * GC-Scouting - users id page
 *
 * Admin detail of a user: profile, posts, sanctions and actions.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { ArrowLeft } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { getAdminUser } from "@/lib/admin/queries";
import { requireStaff } from "@/lib/admin/access";
import { adminMetadata } from "@/lib/admin/metadata";
import { adminGcsUserIds } from "@/lib/auth/account";
import { activeSanctions } from "@/lib/sanction-rules";
import { AdminPageHeader, GcsAdminLink, SanctionBadges } from "@/components/admin/admin-common";
import { RecentAccountBadge } from "@/components/admin/recent-account-badge";
import { RoleSelect } from "@/components/admin/role-select";
import { UserAvatar } from "@/components/auth/user-menu";
import { Badge } from "@/components/admin/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/admin/ui/card";

type Props = { params: Promise<{ locale: string; id: string }> };

export function generateMetadata({ params }: Props): Promise<Metadata> {
  return adminMetadata(params, "users");
}

export default async function AdminUserPage({ params }: Props) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const staff = await requireStaff(locale, `/${locale}/admin/users/${encodeURIComponent(id)}`);
  const user = id.length <= 64 ? await getAdminUser(id) : null;
  if (!user) notFound();
  const t = await getTranslations("admin");
  const format = await getFormatter();
  const sanctions = activeSanctions(user.sanctions);
  const lockedRole = adminGcsUserIds().includes(user.gcsUserId) || user.id === staff.id;

  const facts: [string, React.ReactNode][] = [
    [t("users.gcsAccount"), user.gcsCreatedAt ? format.dateTime(user.gcsCreatedAt, { dateStyle: "long" }) : "-"],
    [t("users.joined"), format.dateTime(user.createdAt, { dateStyle: "long" })],
    [t("users.lastLogin"), user.lastLoginAt ? format.relativeTime(user.lastLoginAt) : "-"],
    [t("users.email"), user.email ?? "-"],
    [t("users.discord"), user.discordId ?? "-"],
    [t("users.posts"), user.posts],
  ];

  return (
    <div className="flex flex-col gap-6">
      <Link href="/admin/users" className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground active:opacity-70">
        <ArrowLeft className="size-4" />
        {t("users.back")}
      </Link>
      <AdminPageHeader title={user.username}>
        <GcsAdminLink gcsUserId={user.gcsUserId} label />
      </AdminPageHeader>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex flex-wrap items-center gap-2">
              <UserAvatar user={user} size={32} />
              {user.username}
              {user.role !== "user" && <Badge variant="outline">{t(`roles.${user.role}`)}</Badge>}
              <RecentAccountBadge createdAt={user.gcsCreatedAt ?? user.createdAt} />
              <SanctionBadges sanctions={user.sanctions} />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="flex flex-col divide-y text-sm">
              {facts.map(([label, value]) => (
                <div key={label} className="flex justify-between gap-4 py-2">
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd className="truncate text-right font-medium">{value}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>

        <div className="flex flex-col gap-4">
          {staff.role === "admin" && (
            <Card>
              <CardHeader>
                <CardTitle>{t("access.role")}</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                <RoleSelect userId={user.id} role={user.role} disabled={lockedRole} />
                {lockedRole && <p className="text-xs text-muted-foreground">{t("access.locked")}</p>}
              </CardContent>
            </Card>
          )}
          <Card>
            <CardHeader>
              <CardTitle>{t("users.sanctions")}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2 text-sm">
              {sanctions.length === 0 ? (
                <p className="text-muted-foreground">{t("users.noSanction")}</p>
              ) : (
                sanctions.map((s) => (
                  <p key={s.id} className="flex flex-wrap items-center gap-2">
                    <Badge variant={s.type === "warning" ? "secondary" : "destructive"}>{t(`sanctions.${s.type}`)}</Badge>
                    {s.endsAt ? t("users.sanctionUntil", { date: format.dateTime(new Date(s.endsAt), { dateStyle: "medium", timeStyle: "short" }) }) : t("users.sanctionPermanent")}
                  </p>
                ))
              )}
              <p className="text-xs text-muted-foreground">
                {user.sanctionsCheckedAt ? t("users.sanctionsChecked", { date: format.relativeTime(user.sanctionsCheckedAt) }) : t("users.sanctionsNever")} {t("users.sanctionsHint")}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>{t("users.conversations")}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-1 text-sm">
              {user.conversations.length === 0 ? (
                <p className="text-muted-foreground">{t("users.noConversation")}</p>
              ) : (
                user.conversations.map((c) => (
                  <Link key={c.id} href={`/admin/conversations/${c.id}`} className="flex justify-between gap-3 rounded-md px-2 py-1.5 transition-colors hover:bg-accent active:opacity-70">
                    <span className="truncate font-medium">{c.peer}</span>
                    <span className="flex-none text-muted-foreground">{format.relativeTime(c.lastMessageAt)}</span>
                  </Link>
                ))
              )}
              <Link href={`/admin/posts?q=${encodeURIComponent(user.username)}`} className="mt-2 text-sm font-medium text-primary hover:underline active:opacity-70">
                {t("users.seePosts")}
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
