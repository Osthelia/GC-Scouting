/**
 * GC-Scouting - admin-header
 *
 * Admin top bar with the user menu.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

"use client";

import { useTranslations } from "next-intl";
import { usePathname } from "@/i18n/navigation";
import { matchAdminNavItem } from "@/lib/admin/nav";
import { SidebarTrigger } from "@/components/admin/ui/sidebar";
import { Badge } from "@/components/admin/ui/badge";
import { UserAvatar } from "@/components/auth/user-menu";
import type { UserRole } from "@scouting/db/constants";

export function AdminHeader({ user }: { user: { username: string; avatarUrl: string | null; role: UserRole } }) {
  const t = useTranslations("admin");
  const pathname = usePathname();
  const current = matchAdminNavItem(pathname);

  return (
    <header className="flex h-14 flex-none items-center gap-2 border-b px-4">
      <SidebarTrigger className="-ml-1" label={t("nav.toggle")} />
      <span className="ml-2 min-w-0 truncate text-sm font-medium">{t(`nav.${current?.labelKey ?? "dashboard"}`)}</span>
      <div className="ml-auto flex items-center gap-2.5">
        <Badge variant="outline">{t(`roles.${user.role}`)}</Badge>
        <span className="hidden text-sm font-medium sm:inline">{user.username}</span>
        <UserAvatar user={user} size={28} />
      </div>
    </header>
  );
}
