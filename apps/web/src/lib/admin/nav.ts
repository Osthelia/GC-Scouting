/**
 * GC-Scouting - nav
 *
 * Admin navigation items.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

import type { ComponentType } from "react";
import { FileText, Flag, KeyRound, LayoutDashboard, MessageSquareWarning, MessagesSquare, ShieldAlert, Users } from "lucide-react";

export type AdminNavItem = {
  href: string;
  labelKey: string;
  icon: ComponentType<{ className?: string }>;
  exact: boolean;
  /** Role management, admins only. */
  adminOnly?: boolean;
};

export const ADMIN_TOP_ITEMS: AdminNavItem[] = [{ href: "/admin", labelKey: "dashboard", icon: LayoutDashboard, exact: true }];

export const ADMIN_NAV_GROUPS: { key: string; labelKey: string; items: AdminNavItem[] }[] = [
  {
    key: "chat",
    labelKey: "groupChat",
    items: [
      { href: "/admin/conversations", labelKey: "conversations", icon: MessagesSquare, exact: false },
      { href: "/admin/automod", labelKey: "automod", icon: ShieldAlert, exact: false },
      { href: "/admin/message-reports", labelKey: "messageReports", icon: MessageSquareWarning, exact: false },
    ],
  },
  {
    key: "posts",
    labelKey: "groupPosts",
    items: [
      { href: "/admin/posts", labelKey: "posts", icon: FileText, exact: false },
      { href: "/admin/reports", labelKey: "postReports", icon: Flag, exact: false },
    ],
  },
  {
    key: "admin",
    labelKey: "groupAdmin",
    items: [
      { href: "/admin/users", labelKey: "users", icon: Users, exact: false },
      { href: "/admin/access", labelKey: "access", icon: KeyRound, exact: false, adminOnly: true },
    ],
  },
];

/** Longest href first, so a detail page (/admin/users/abc) resolves to its section. */
const ADMIN_NAV_ITEMS = [...ADMIN_TOP_ITEMS, ...ADMIN_NAV_GROUPS.flatMap((g) => g.items)].sort((a, b) => b.href.length - a.href.length);

export function matchAdminNavItem(pathname: string): AdminNavItem | undefined {
  return ADMIN_NAV_ITEMS.find((item) => (item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`)));
}
