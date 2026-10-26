/**
 * GC-Scouting - admin-sidebar
 *
 * Admin navigation sidebar with collapsible groups.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, ChevronDown } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { ADMIN_NAV_GROUPS, ADMIN_TOP_ITEMS, type AdminNavItem } from "@/lib/admin/nav";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from "@/components/admin/ui/sidebar";

const STORAGE_PREFIX = "sc_admin_nav_";

/** Collapsible group, its state kept per browser. */
function NavGroup({ groupKey, label, children }: { groupKey: string; label: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  const storageKey = `${STORAGE_PREFIX}${groupKey}`;

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(storageKey);
      if (stored !== null) setOpen(stored !== "0");
    } catch {}
  }, [storageKey]);

  const toggle = () =>
    setOpen((prev) => {
      try {
        window.localStorage.setItem(storageKey, prev ? "0" : "1");
      } catch {}
      return !prev;
    });

  return (
    <SidebarGroup className="gap-1">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-[11px] font-semibold tracking-wider text-sidebar-foreground/60 uppercase outline-hidden transition-colors hover:text-sidebar-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring active:opacity-70 group-data-[collapsible=icon]:hidden"
      >
        <span>{label}</span>
        <ChevronDown className={cn("size-3.5 shrink-0 transition-transform duration-200", !open && "-rotate-90")} />
      </button>
      <div
        className={cn(
          "grid transition-[grid-template-rows] duration-200 ease-linear",
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
          "group-data-[collapsible=icon]:grid-rows-[1fr]",
        )}
      >
        <div className="overflow-hidden">
          <SidebarGroupContent>{children}</SidebarGroupContent>
        </div>
      </div>
    </SidebarGroup>
  );
}

/** `badges`: pending items per section href (automod queue, open reports). */
export function AdminSidebar({ isAdmin, badges }: { isAdmin: boolean; badges: Record<string, number> }) {
  const t = useTranslations("admin.nav");
  const pathname = usePathname();
  const isActive = (item: AdminNavItem) => (item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`));
  const groups = ADMIN_NAV_GROUPS.map((g) => ({ ...g, items: g.items.filter((i) => isAdmin || !i.adminOnly) })).filter((g) => g.items.length > 0);

  const item = (entry: AdminNavItem) => (
    <SidebarMenuItem key={entry.href}>
      <SidebarMenuButton isActive={isActive(entry)} tooltip={t(entry.labelKey)} render={<Link href={entry.href} />}>
        <entry.icon className="size-3.5" />
        <span>{t(entry.labelKey)}</span>
      </SidebarMenuButton>
      {!!badges[entry.href] && <SidebarMenuBadge className="bg-primary/15 text-primary">{badges[entry.href]}</SidebarMenuBadge>}
    </SidebarMenuItem>
  );

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center px-2 py-1.5">
          <span className="truncate text-sm font-semibold group-data-[collapsible=icon]:hidden">{t("title")}</span>
        </div>
      </SidebarHeader>
      <SidebarContent className="gap-3">
        <SidebarGroup className="pb-3">
          <SidebarGroupContent>
            <SidebarMenu className="gap-1.5">{ADMIN_TOP_ITEMS.map(item)}</SidebarMenu>
          </SidebarGroupContent>
          <SidebarSeparator className="mt-3 mb-0 group-data-[collapsible=icon]:hidden" />
        </SidebarGroup>
        {groups.map((group) => (
          <NavGroup key={group.key} groupKey={group.key} label={t(group.labelKey)}>
            <SidebarMenu className="gap-1.5">{group.items.map(item)}</SidebarMenu>
          </NavGroup>
        ))}
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton tooltip={t("backToSite")} render={<Link href="/" />}>
              <ArrowLeft />
              <span>{t("backToSite")}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
