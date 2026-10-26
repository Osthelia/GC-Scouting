/**
 * GC-Scouting - access
 *
 * Staff guards for pages and server actions.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser, isStaff, type SessionUser } from "@/lib/auth/session";

/** Logged in staff member or admin, null otherwise. Always the account, never a managed profile. */
export const getStaffUser = cache(async (): Promise<SessionUser | null> => {
  const user = await getCurrentUser();
  return isStaff(user) ? user : null;
});

/** Pages of the admin: login first, then a 404 for anyone outside the staff (the admin is not advertised). */
export async function requireStaff(locale: string, next = `/${locale}/admin`): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect(`/api/auth/login?locale=${locale}&next=${encodeURIComponent(next)}`);
  if (!isStaff(user)) notFound();
  return user;
}

/** Guard for admin data reads, so they never rely on a layout check. */
export async function assertStaff(): Promise<void> {
  if (!(await getStaffUser())) notFound();
}

export async function requireAdmin(locale: string): Promise<SessionUser> {
  const user = await requireStaff(locale);
  if (user.role !== "admin") notFound();
  return user;
}
