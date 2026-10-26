/**
 * GC-Scouting - admin layout
 *
 * Admin area layout: sidebar, header and staff guard.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { getStaffUser, requireStaff } from "@/lib/admin/access";
import { adminPending } from "@/lib/admin/queries";
import { SidebarInset, SidebarProvider } from "@/components/admin/ui/sidebar";
import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { AdminHeader } from "@/components/admin/admin-header";

// Outside the staff the 404 keeps the site title.
export async function generateMetadata(): Promise<Metadata> {
  if (!(await getStaffUser())) return {};
  return {
    title: { template: "%s | GC Scouting Admin", default: "GC Scouting Admin" },
    robots: { index: false, follow: false },
  };
}

export default async function AdminLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireStaff(locale);
  const pending = await adminPending();

  return (
    <SidebarProvider>
      <AdminSidebar
        isAdmin={user.role === "admin"}
        badges={{ "/admin/automod": pending.held, "/admin/message-reports": pending.messageReports, "/admin/reports": pending.postReports }}
      />
      <SidebarInset>
        <AdminHeader user={user} />
        <div className="flex-1 p-4 sm:p-6">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
