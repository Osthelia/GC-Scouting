/**
 * GC-Scouting - site-header
 *
 * Site header with navigation, chat and user menu.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Loader2Icon, UsersIcon } from "lucide-react";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { routing, localeDisplay, type AppLocale } from "@/i18n/routing";
import { Wordmark } from "@/components/logo";
import { LoginLink } from "@/components/auth/login-link";
import { UserMenu, useSwitchProfile, type HeaderUser } from "@/components/auth/user-menu";
import { PreferencesMenu } from "@/components/preferences-menu";
import { ChatButton } from "@/components/chat/chat-button";
import { POST_TYPES } from "@/lib/post-types";
import type { ThemePreference } from "@/lib/theme";
import { cn } from "@/lib/utils";

const TYPE_NAV = POST_TYPES.map((type) => ({ key: type.key, code: type.code, color: type.color, href: `/posts/${type.key}` }));

export function SiteHeader({ user, theme }: { user: HeaderUser | null; theme: ThemePreference }) {
  const t = useTranslations("nav");
  const tTypes = useTranslations("home.types");
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => setMobileOpen(false), [pathname]);

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`));

  return (
    <header className="sticky top-0 z-[60] border-b border-neutral-800 bg-[var(--sc-bg)]/90 backdrop-blur-xl">
      <div className="mx-auto flex h-[62px] max-w-[1400px] items-center gap-3 px-4 sm:h-[66px] sm:gap-5 sm:px-6 lg:gap-9">
        <Link href="/" className="flex flex-none items-center active:scale-[0.98]">
          <Wordmark />
        </Link>

        <nav className="hidden items-center gap-1 lg:flex">
          <Link
            href="/"
            className={cn(
              "mr-3 text-[14.5px] transition-colors active:opacity-70",
              isActive("/") ? "font-semibold text-neutral-50" : "font-medium text-neutral-500 hover:text-neutral-50"
            )}
          >
            {t("home")}
          </Link>
          {TYPE_NAV.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.key}
                href={item.href}
                title={tTypes(`${item.key}.label`)}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "rounded-lg px-2.5 py-1.5 font-mono text-[13px] font-black tracking-wider transition-all active:scale-[0.95]",
                  !active && "text-neutral-500 hover:bg-[var(--sc-hover)] hover:text-neutral-100"
                )}
                style={active ? { color: item.color, background: `color-mix(in oklab, ${item.color} 16%, transparent)` } : undefined}
              >
                {item.code}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto hidden items-center gap-2.5 lg:flex">
          <PreferencesMenu theme={theme} />
          <LanguageSwitcher />
          <Link
            href="/posts/new"
            className="flex h-[38px] items-center rounded-[10px] border border-neutral-800 bg-[var(--sc-surface)] px-3.5 text-[13.5px] font-semibold text-neutral-200 transition-all hover:border-[var(--sc-hover-2)] hover:bg-[var(--sc-hover)] active:scale-[0.97]"
          >
            {t("newPost")}
          </Link>
          {user && <ChatButton initialUnread={user.unread} />}
          {user ? <UserMenu user={user} /> : <LoginLink small label={t("login")} />}
        </div>

        <div className="ml-auto flex items-center gap-2 lg:hidden">
          {user ? <ChatButton initialUnread={user.unread} /> : <LoginLink small label={t("loginShort")} />}
          <button
            type="button"
            aria-label={t("menu")}
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen((v) => !v)}
            className="flex h-[38px] w-[38px] items-center justify-center rounded-[10px] border border-neutral-800 bg-[var(--sc-surface)] text-neutral-300 transition-all active:scale-[0.95]"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round">
              {mobileOpen ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
            </svg>
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="border-t border-neutral-800 bg-[var(--sc-bg)] px-4 pt-3 pb-5 lg:hidden">
          <nav className="flex flex-col gap-1">
            <Link
              href="/"
              className={cn(
                "rounded-lg px-3 py-2.5 text-[15px] transition-colors active:bg-[var(--sc-hover)]",
                isActive("/") ? "bg-[var(--sc-surface)] font-semibold text-neutral-50" : "font-medium text-neutral-400"
              )}
            >
              {t("home")}
            </Link>
            {TYPE_NAV.map((item) => (
              <Link
                key={item.key}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-[15px] transition-colors active:bg-[var(--sc-hover)]",
                  isActive(item.href) ? "bg-[var(--sc-surface)] font-semibold text-neutral-50" : "font-medium text-neutral-400"
                )}
              >
                <span className="w-11 font-mono text-[13px] font-black tracking-wider" style={{ color: item.color }}>
                  {item.code}
                </span>
                {tTypes(`${item.key}.label`)}
              </Link>
            ))}
            <Link href="/posts/new" className="rounded-lg px-3 py-2.5 text-[15px] font-medium text-neutral-400 active:bg-[var(--sc-hover)]">
              {t("newPost")}
            </Link>
          </nav>
          {user && (
            <div className="mt-3 border-t border-neutral-800 pt-3">
              <UserMenu user={user} inline />
            </div>
          )}
          <div className="mt-3 border-t border-neutral-800 pt-3">
            <LanguageSwitcher inline />
          </div>
          <div className="mt-3 border-t border-neutral-800 pt-3">
            <PreferencesMenu theme={theme} inline />
          </div>
        </div>
      )}
      {user?.acting && <ActingBanner name={user.acting.username} />}
    </header>
  );
}

/** Reminds a delegate whose profile they are acting as. */
function ActingBanner({ name }: { name: string }) {
  const t = useTranslations("auth");
  const switcher = useSwitchProfile();

  return (
    <div className="border-t border-[color-mix(in_oklab,var(--sc-accent)_30%,transparent)] bg-[color-mix(in_oklab,var(--sc-accent)_10%,transparent)]">
      <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2 text-[13px] sm:px-6">
        <UsersIcon className="h-4 w-4 flex-none text-[var(--sc-accent)]" />
        <span className="text-neutral-200">{t("actingAs", { name })}</span>
        <button
          type="button"
          onClick={() => switcher.run(null)}
          disabled={switcher.pending}
          className="inline-flex items-center gap-1.5 rounded-md font-semibold text-[var(--sc-accent)] transition-opacity hover:opacity-80 active:opacity-60 disabled:opacity-60"
        >
          {switcher.pending && <Loader2Icon className="h-3.5 w-3.5 animate-spin" />}
          {t("backToSelf")}
        </button>
        {switcher.failed && <span className="text-red-400">{t("switchFailed")}</span>}
      </div>
    </div>
  );
}

/** Same dropdown as GC Stats' header, flags + names. */
function LanguageSwitcher({ inline }: { inline?: boolean }) {
  const locale = useLocale() as AppLocale;
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [open]);

  const options = routing.locales.map((code) => {
    const active = code === locale;
    return (
      <button
        key={code}
        type="button"
        onClick={() => {
          setOpen(false);
          router.replace(pathname, { locale: code });
        }}
        className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2.5 text-left text-sm transition-colors hover:bg-[var(--sc-hover)] active:bg-[var(--sc-hover-2)]"
        style={{
          background: active ? "var(--sc-hover)" : undefined,
          color: active ? "var(--sc-accent)" : "var(--sc-text-dim)",
          fontWeight: active ? 600 : 500,
        }}
      >
        <span className="text-base leading-none">{localeDisplay[code].flag}</span>
        <span>{localeDisplay[code].name}</span>
      </button>
    );
  });

  if (inline) return <div className="flex flex-col gap-0.5">{options}</div>;

  return (
    <div className="relative flex-none">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className="flex h-[38px] items-center gap-1.5 rounded-[10px] border border-neutral-800 bg-[var(--sc-surface)] px-2.5 text-neutral-50 transition-all hover:bg-[var(--sc-hover)] active:scale-[0.97]"
      >
        <span className="text-base leading-none">{localeDisplay[locale].flag}</span>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--sc-text-tertiary)" strokeWidth="3" strokeLinecap="round">
          <path d="M5 9l7 7 7-7" />
        </svg>
      </button>
      {open && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute top-[46px] right-0 z-[70] w-[186px] rounded-xl border border-neutral-800 bg-[var(--sc-surface-3)] p-1.5 shadow-[0_20px_48px_rgba(0,0,0,.7)]"
        >
          {options}
        </div>
      )}
    </div>
  );
}
