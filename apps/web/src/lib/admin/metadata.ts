/**
 * GC-Scouting - metadata
 *
 * Page metadata helper of the admin pages.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import type { AppLocale } from "@/i18n/routing";
import { getStaffUser } from "./access";

type AdminNavKey = "dashboard" | "users" | "posts" | "postReports" | "messageReports" | "conversations" | "automod" | "access" | "tweets";

/** Admin page title, empty outside the staff so the 404 keeps the site title. */
export async function adminMetadata(params: Promise<{ locale: string }>, key: AdminNavKey, { adminOnly = false } = {}): Promise<Metadata> {
  const [{ locale }, user] = await Promise.all([params, getStaffUser()]);
  if (!user || (adminOnly && user.role !== "admin")) return {};
  const t = await getTranslations({ locale: locale as AppLocale, namespace: "admin.nav" });
  return { title: t(key) };
}
