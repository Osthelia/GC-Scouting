/**
 * GC-Scouting - admin access layout
 *
 * Layout of the staff access page, checks the staff role before anything renders.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

import { requireAdmin } from "@/lib/admin/access";

// Checked above `loading.tsx` so a staff member gets a 404 status.
export default async function AdminAccessLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  await requireAdmin((await params).locale);
  return children;
}
