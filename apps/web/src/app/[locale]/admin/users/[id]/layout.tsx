/**
 * GC-Scouting - users id layout
 *
 * Layout of the admin user page, checks the staff role.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/admin/access";
import { adminUserExists } from "@/lib/admin/queries";

// Checked above the `loading.tsx` boundary so a missing account answers with a 404 status.
export default async function AdminUserLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  await requireStaff(locale, `/${locale}/admin/users/${encodeURIComponent(id)}`);
  if (id.length > 64 || !(await adminUserExists(id))) notFound();
  return children;
}
