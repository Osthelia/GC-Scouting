/**
 * GC-Scouting - root layout
 *
 * Localized root layout: providers, header, footer, theme and metadata.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

import type { Metadata } from "next";
import { Instrument_Sans } from "next/font/google";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { THEME_COOKIE, isThemePreference } from "@/lib/theme";
import { routing, type AppLocale } from "@/i18n/routing";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { HideOnAdmin } from "@/components/hide-on-admin";
import { getActiveProfile, getCurrentUser, isStaff, managedProfiles } from "@/lib/auth/session";
import { unreadCount } from "@/lib/chat/queries";
import type { HeaderUser } from "@/components/auth/user-menu";
import "flag-icons/css/flag-icons.min.css";
import "../globals.css";

const instrumentSans = Instrument_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-body",
  display: "swap",
});

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as AppLocale, namespace: "meta" });
  return {
    title: { default: t("title"), template: `%s - ${t("title")}` },
    description: t("description"),
  };
}

export default async function LocaleLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const [user, active, cookieStore] = await Promise.all([getCurrentUser(), getActiveProfile(), cookies()]);
  const headerUser: HeaderUser | null = user && {
    id: user.id,
    username: user.username,
    avatarUrl: user.avatarUrl,
    profile: user.profile?.status ?? null,
    managed: await managedProfiles(user.id),
    acting: active?.delegated ? { id: active.id, username: active.username, avatarUrl: active.avatarUrl } : null,
    staff: isStaff(user),
    unread: await unreadCount(active?.id ?? user.id),
  };
  const storedTheme = cookieStore.get(THEME_COOKIE)?.value;
  const theme = isThemePreference(storedTheme) ? storedTheme : "system";

  return (
    <html lang={locale} className={instrumentSans.variable} data-scroll-behavior="smooth" data-theme={theme === "system" ? undefined : theme} suppressHydrationWarning>
      <body className="flex min-h-screen flex-col bg-[var(--sc-bg)] font-sans text-[15px] text-[var(--sc-text)] antialiased">
        <NextIntlClientProvider>
          <HideOnAdmin>
            <SiteHeader theme={theme} user={headerUser} />
          </HideOnAdmin>
          <main className="flex-1">{children}</main>
          <HideOnAdmin>
            <SiteFooter />
          </HideOnAdmin>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
