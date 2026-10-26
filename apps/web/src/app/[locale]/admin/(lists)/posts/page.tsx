/**
 * GC-Scouting - admin posts page
 *
 * Admin list of posts.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

import type { Metadata } from "next";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { Pencil, RotateCcw } from "lucide-react";
import { POST_TYPES } from "@scouting/db/constants";
import { requireStaff } from "@/lib/admin/access";
import { adminMetadata } from "@/lib/admin/metadata";
import { Link } from "@/i18n/navigation";
import { ADMIN_PAGE_SIZE, ADMIN_POST_STATES, listAdminPosts } from "@/lib/admin/queries";
import { POST_TYPE_BY_KEY } from "@/lib/post-types";
import { removePostAsStaff, restorePostAsStaff } from "@/actions/admin";
import { AdminEmpty, AdminPageHeader, AdminPagination, AdminUserCell, pageParam, clampPage } from "@/components/admin/admin-common";
import { AdminActionButton, AdminFilterBar, RemovePostDialog } from "@/components/admin/admin-actions";
import { PostTypeBadge } from "@/components/post/badges";
import { Badge } from "@/components/admin/ui/badge";
import { Button } from "@/components/admin/ui/button";
import { Card } from "@/components/admin/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/admin/ui/table";

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<{ q?: string; state?: string; type?: string; page?: string }> };

export function generateMetadata({ params }: Props): Promise<Metadata> {
  return adminMetadata(params, "posts");
}

export default async function AdminPostsPage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireStaff(locale, `/${locale}/admin/posts`);
  const sp = await searchParams;
  const q = (sp.q ?? "").trim().slice(0, 100);
  const state = ADMIN_POST_STATES.find((s) => s === sp.state) ?? "";
  const type = POST_TYPES.find((p) => p === sp.type) ?? "";
  const page = pageParam(sp.page);
  const t = await getTranslations("admin.posts");
  const format = await getFormatter();
  const { rows, total } = await listAdminPosts({ q, state, type, page });
  clampPage({ locale, pathname: "/admin/posts", page, total, pageSize: ADMIN_PAGE_SIZE, query: { q, state, type } });

  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader title={t("title")} subtitle={t("subtitle")} />
      <AdminFilterBar
        search={q}
        searchPlaceholder={t("search")}
        filters={[
          { name: "state", value: state, label: t("stateLabel"), options: [{ value: "", label: t("anyState") }, ...ADMIN_POST_STATES.map((s) => ({ value: s, label: t(`state.${s}`) }))] },
          { name: "type", value: type, label: t("typeLabel"), options: [{ value: "", label: t("anyType") }, ...POST_TYPES.map((p) => ({ value: p, label: POST_TYPE_BY_KEY[p].code }))] },
        ]}
      />
      {rows.length === 0 ? (
        <AdminEmpty text={t("empty")} />
      ) : (
        <Card className="py-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("post")}</TableHead>
                <TableHead>{t("author")}</TableHead>
                <TableHead>{t("stateLabel")}</TableHead>
                <TableHead>{t("bumped")}</TableHead>
                <TableHead className="text-right">{t("actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((post) => (
                <TableRow key={post.id}>
                  <TableCell>
                    <span className="flex items-center gap-2">
                      <PostTypeBadge type={post.type} />
                      {post.state === "removed" || post.state === "deleted" ? (
                        <span className="font-medium">{post.displayName}</span>
                      ) : (
                        <Link href={`/posts/${post.type}/${post.id}`} className="font-medium hover:text-primary active:opacity-70">
                          {post.displayName}
                        </Link>
                      )}
                      {post.reportsOpen > 0 && (
                        <Link href="/admin/reports">
                          <Badge variant="destructive">{t("reports", { count: post.reportsOpen })}</Badge>
                        </Link>
                      )}
                    </span>
                  </TableCell>
                  <TableCell>
                    <AdminUserCell user={post.author} />
                  </TableCell>
                  <TableCell>
                    <Badge variant={post.state === "visible" ? "default" : post.state === "removed" ? "destructive" : "outline"}>{t(`state.${post.state}`)}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{format.relativeTime(post.bumpedAt)}</TableCell>
                  <TableCell className="text-right">
                    <span className="inline-flex flex-wrap items-start justify-end gap-1.5">
                      {(post.state === "visible" || post.state === "expired") && (
                        <>
                          <Button variant="outline" size="sm" className="active:scale-[0.97]" render={<Link href={`/posts/${post.type}/${post.id}/edit`} />}>
                            <Pencil />
                            {t("edit")}
                          </Button>
                          <RemovePostDialog postName={post.displayName} trigger={t("remove")} action={removePostAsStaff.bind(null, post.id)} />
                        </>
                      )}
                      {post.state === "removed" && <AdminActionButton label={t("restore")} icon={<RotateCcw />} confirm={t("restoreConfirm")} action={restorePostAsStaff.bind(null, post.id)} />}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
      <AdminPagination pathname="/admin/posts" page={page} total={total} pageSize={ADMIN_PAGE_SIZE} query={{ q, state, type }} />
    </div>
  );
}
