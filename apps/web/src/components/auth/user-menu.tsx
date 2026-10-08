/**
 * GC-Scouting - user-menu
 *
 * Header user menu with profile switching and account links.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

"use client";

import { useEffect, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { CheckIcon, ChevronDownIcon, ExternalLinkIcon, FileTextIcon, Loader2Icon, LogOutIcon, MessageSquareIcon, SettingsIcon, ShieldIcon, UsersIcon } from "lucide-react";
import { switchProfile } from "@/actions/account";
import { Link, useRouter } from "@/i18n/navigation";
import { GCS_URL } from "@/lib/gcs";
import { initials } from "@/lib/posts";
import { cn } from "@/lib/utils";
import { useImageFallback } from "@/lib/use-image-fallback";

export type ProfileIdentity = { id: string; username: string; avatarUrl: string | null };

export type HeaderUser = ProfileIdentity & {
  profile: "verified" | "pending" | null;
  /** Profiles the account manages. */
  managed: ProfileIdentity[];
  /** Managed profile in use, null when acting as the account. */
  acting: ProfileIdentity | null;
  /** Staff or admin, the admin is linked in the menu. */
  staff: boolean;
  /** Unread messages of the active profile. */
  unread: number;
};

export function UserAvatar({ user, size = 28 }: { user: Pick<HeaderUser, "username" | "avatarUrl">; size?: number }) {
  const [failed, setFailed] = useState(false);
  const fallback = useImageFallback(() => setFailed(true));
  const style = { width: size, height: size, borderRadius: size * 0.3 };

  if (user.avatarUrl && !failed) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={user.avatarUrl} alt="" style={style} className="flex-none object-cover" {...fallback} />;
  }
  return (
    <span style={{ ...style, fontSize: size * 0.4 }} className="flex flex-none items-center justify-center bg-[var(--sc-surface-2)] font-black text-neutral-300">
      {initials(user.username)}
    </span>
  );
}

/** Switches the active profile, then reloads the server data. */
export function useSwitchProfile() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [target, setTarget] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  const run = (ownerId: string | null) => {
    setTarget(ownerId ?? "");
    setFailed(false);
    startTransition(async () => {
      const result = await switchProfile(ownerId).catch(() => ({ ok: false }) as const);
      if (result.ok) router.refresh();
      else setFailed(true);
    });
  };
  return { run, pending, target: pending ? target : undefined, failed };
}

export function UserMenu({ user, inline }: { user: HeaderUser; inline?: boolean }) {
  const t = useTranslations("auth");
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const switcher = useSwitchProfile();
  const shown = user.acting ?? user;
  const menuItem =
    "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2.5 text-left text-sm font-medium text-neutral-400 transition-colors hover:bg-[var(--sc-hover)] hover:text-neutral-100 active:bg-[var(--sc-hover-2)]";

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [open]);

  const panel = (
    <>
      <div className="flex items-center gap-2.5 px-2.5 pt-1.5 pb-2.5">
        <UserAvatar user={user} size={34} />
        <div className="min-w-0">
          <p className="truncate text-[14px] font-semibold text-neutral-50">{user.username}</p>
          <p className="text-[12px] text-neutral-500">{t(`profile.${user.profile ?? "none"}`)}</p>
        </div>
      </div>
      {user.managed.length > 0 && (
        <div className="border-t border-neutral-800 py-1.5">
          <p className="px-2.5 pt-1 pb-1.5 text-[11px] font-semibold tracking-[0.12em] text-neutral-500 uppercase">{t("actAs")}</p>
          {[user, ...user.managed].map((p) => {
            const self = p.id === user.id;
            const active = p.id === shown.id;
            return (
              <button
                key={p.id}
                type="button"
                disabled={switcher.pending}
                aria-pressed={active}
                onClick={() => !active && switcher.run(self ? null : p.id)}
                className={cn(menuItem, "py-2 disabled:opacity-70", active && "text-neutral-100")}
              >
                <UserAvatar user={p} size={22} />
                <span className="min-w-0 flex-1 truncate">{self ? t("yourself", { name: p.username }) : p.username}</span>
                {switcher.target === (self ? "" : p.id) ? (
                  <Loader2Icon className="h-4 w-4 animate-spin" />
                ) : (
                  active && <CheckIcon className="h-4 w-4 text-[var(--sc-accent)]" />
                )}
              </button>
            );
          })}
          {switcher.failed && (
            <p role="alert" className="px-2.5 pt-1 text-[12px] text-red-400">
              {t("switchFailed")}
            </p>
          )}
        </div>
      )}
      <div className="border-t border-neutral-800 py-1.5">
        <Link href="/me" onClick={() => setOpen(false)} className={menuItem}>
          <FileTextIcon className="h-4 w-4" />
          {t("myPosts")}
        </Link>
        <Link href="/messages" onClick={() => setOpen(false)} className={menuItem}>
          <MessageSquareIcon className="h-4 w-4" />
          {t("messages")}
          {user.unread > 0 && (
            <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--sc-accent)] px-1.5 text-[11px] font-bold text-[var(--sc-accent-ink)]">
              {user.unread > 99 ? "99+" : user.unread}
            </span>
          )}
        </Link>
        <Link href="/account" onClick={() => setOpen(false)} className={menuItem}>
          <SettingsIcon className="h-4 w-4" />
          {t("settings")}
        </Link>
        {user.staff && (
          <Link href="/admin" onClick={() => setOpen(false)} className={menuItem}>
            <ShieldIcon className="h-4 w-4" />
            {t("admin")}
          </Link>
        )}
        <a href={`${GCS_URL}/${locale}/settings/account`} target="_blank" rel="noopener noreferrer" className={menuItem}>
          <ExternalLinkIcon className="h-4 w-4" />
          {t("gcsAccount")}
        </a>
      </div>
      <div className="border-t border-neutral-800 pt-1.5">
        <LogoutButton label={t("logout")} />
      </div>
    </>
  );

  if (inline) return <div className="flex flex-col">{panel}</div>;

  return (
    <div className="relative flex-none">
      <button
        type="button"
        aria-expanded={open}
        aria-label={t("account")}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className="flex h-[38px] items-center gap-2 rounded-[10px] border border-neutral-800 bg-[var(--sc-surface)] pr-2.5 pl-1.5 text-[13.5px] font-semibold text-neutral-100 transition-all hover:bg-[var(--sc-hover)] active:scale-[0.97]"
      >
        <span className="relative flex-none">
          <UserAvatar user={shown} />
          {user.acting && (
            <span className="absolute -right-1 -bottom-1 flex h-3.5 w-3.5 items-center justify-center rounded-full border border-[var(--sc-bg)] bg-[var(--sc-accent)] text-[var(--sc-accent-ink)]">
              <UsersIcon className="h-2 w-2" strokeWidth={3} />
            </span>
          )}
        </span>
        <span className="max-w-[140px] truncate">{shown.username}</span>
        <ChevronDownIcon className={cn("h-3.5 w-3.5 text-neutral-500 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute top-[46px] right-0 z-[70] w-[260px] rounded-xl border border-neutral-800 bg-[var(--sc-surface-3)] p-1.5 shadow-[0_20px_48px_rgba(0,0,0,.7)]"
        >
          {panel}
        </div>
      )}
    </div>
  );
}

function LogoutButton({ label }: { label: string }) {
  const locale = useLocale();
  const [pending, setPending] = useState(false);

  return (
    <form
      method="post"
      action="/api/auth/logout"
      onSubmit={(e) => {
        const next = e.currentTarget.elements.namedItem("next") as HTMLInputElement;
        next.value = window.location.pathname + window.location.search;
        setPending(true);
      }}
    >
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="next" value={`/${locale}`} />
      <button
        type="submit"
        disabled={pending}
        className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2.5 text-left text-sm font-medium text-neutral-400 transition-colors hover:bg-[var(--sc-hover)] hover:text-neutral-100 active:bg-[var(--sc-hover-2)] disabled:opacity-70"
      >
        {pending ? <Loader2Icon className="h-4 w-4 animate-spin" /> : <LogOutIcon className="h-4 w-4" />}
        {label}
      </button>
    </form>
  );
}
