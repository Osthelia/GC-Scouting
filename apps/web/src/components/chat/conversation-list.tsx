/**
 * GC-Scouting - conversation-list
 *
 * Polled list of conversations.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { ClockIcon, Loader2Icon, MessageSquareIcon } from "lucide-react";
import { Link, usePathname } from "@/i18n/navigation";
import type { ConversationSummary } from "@/lib/chat/queries";

type ConversationPage = { conversations: ConversationSummary[]; hasMore: boolean };
import { UserAvatar } from "@/components/auth/user-menu";
import { PeerBadges } from "./peer-badges";
import { cn } from "@/lib/utils";

const POLL_MS = 15000;

/** Latest conversations, refreshed on an interval and whenever the chat changes on the page. */
export function useConversations(initial: ConversationPage | null, limit: number, enabled = true) {
  const [conversations, setConversations] = useState(initial?.conversations ?? null);
  const [hasMore, setHasMore] = useState(initial?.hasMore ?? false);
  const [unread, setUnread] = useState<number | null>(null);

  const refresh = useCallback(async () => {
    const response = await fetch(`/api/chat/unread?list=${limit}`, { cache: "no-store" }).catch(() => null);
    if (!response?.ok) return false;
    const data = (await response.json()) as ConversationPage & { unread: number };
    setConversations(data.conversations);
    setHasMore(data.hasMore);
    setUnread(data.unread);
    return true;
  }, [limit]);

  useEffect(() => {
    if (!enabled) return;
    const tick = () => document.visibilityState === "visible" && refresh();
    const timer = window.setInterval(tick, POLL_MS);
    window.addEventListener("chat:changed", tick);
    document.addEventListener("visibilitychange", tick);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("chat:changed", tick);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [enabled, refresh]);

  return { conversations, hasMore, unread, refresh };
}

export function ConversationItems({ conversations, activeId, onNavigate }: { conversations: ConversationSummary[]; activeId?: number | null; onNavigate?: () => void }) {
  const t = useTranslations("chat");
  const format = useFormatter();
  const now = new Date();

  return (
    <ul className="flex flex-col gap-0.5">
      {conversations.map((c) => {
        const active = c.id === activeId;
        const preview = c.last.status === "hidden" ? t("hiddenMessage") : c.last.body;
        return (
          <li key={c.id}>
            <Link
              href={`/messages/${c.id}`}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors active:bg-[var(--sc-hover-2)]",
                active ? "bg-[var(--sc-hover)]" : "hover:bg-[var(--sc-hover)]",
              )}
            >
              <UserAvatar user={c.peer} size={38} />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5">
                  <span className={cn("truncate text-[14px] text-neutral-100", c.unread > 0 ? "font-bold" : "font-semibold")}>{c.peer.username}</span>
                  <PeerBadges peer={c.peer} compact />
                  <span className="ml-auto flex-none text-[11.5px] text-neutral-500">{format.relativeTime(new Date(c.last.createdAt), now)}</span>
                </span>
                <span className="mt-0.5 flex items-center gap-1.5">
                  {c.last.status === "blocked" && <ClockIcon className="h-3 w-3 flex-none text-amber-400" />}
                  <span className={cn("truncate text-[13px]", c.unread > 0 ? "font-semibold text-neutral-200" : "text-neutral-500")}>
                    {c.last.author ? `${c.last.author}: ` : c.last.mine && `${t("you")} `}
                    {preview}
                  </span>
                  {c.unread > 0 && (
                    <span className="ml-auto flex h-5 min-w-5 flex-none items-center justify-center rounded-full bg-[var(--sc-accent)] px-1.5 text-[11px] font-bold text-[var(--sc-accent-ink)]">
                      {c.unread > 99 ? "99+" : c.unread}
                    </span>
                  )}
                </span>
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export function NoConversation() {
  const t = useTranslations("chat");
  return (
    <div className="flex flex-col items-center px-6 py-10 text-center">
      <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-neutral-800 bg-[var(--sc-surface-2)] text-[var(--sc-accent)]">
        <MessageSquareIcon className="h-5 w-5" />
      </span>
      <p className="mt-4 text-[15px] font-bold text-neutral-50">{t("empty.title")}</p>
      <p className="mt-1.5 max-w-xs text-[13px] leading-relaxed text-neutral-500">{t("empty.text")}</p>
    </div>
  );
}

/** Left column of the messages page. */
export function ConversationSidebar({ initial, pageSize }: { initial: ConversationPage; pageSize: number }) {
  const t = useTranslations("chat");
  const pathname = usePathname();
  const activeId = Number(pathname.match(/^\/messages\/(\d+)/)?.[1]) || null;
  const [limit, setLimit] = useState(pageSize);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const { conversations, hasMore, refresh } = useConversations(initial, limit);
  const growing = useRef(false);

  // The longer list is fetched once `refresh` follows the new limit.
  useEffect(() => {
    if (!growing.current) return;
    growing.current = false;
    refresh().then((ok) => {
      setFailed(!ok);
      setLoading(false);
    });
  }, [refresh]);

  const loadMore = () => {
    if (loading) return;
    growing.current = true;
    setLoading(true);
    setFailed(false);
    setLimit((current) => current + pageSize);
  };

  return (
    <SidebarFrame hidden={!!activeId}>
      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-4">
        {conversations?.length ? <ConversationItems conversations={conversations} activeId={activeId} /> : <NoConversation />}
        {hasMore && (
          <div className="mt-2 flex flex-col items-center gap-1.5">
            <button
              type="button"
              onClick={loadMore}
              disabled={loading}
              aria-busy={loading}
              className="inline-flex h-9 items-center gap-2 rounded-[10px] border border-neutral-800 px-3.5 text-[13px] font-semibold text-neutral-300 transition-all hover:bg-[var(--sc-hover)] hover:text-neutral-100 active:scale-[0.97] disabled:opacity-70"
            >
              {loading && <Loader2Icon className="h-3.5 w-3.5 animate-spin" />}
              {t("loadMoreConversations")}
            </button>
            {failed && (
              <p role="alert" className="text-[12px] text-red-400">
                {t("errors.server")}
              </p>
            )}
          </div>
        )}
      </div>
    </SidebarFrame>
  );
}

function SidebarFrame({ hidden, children }: { hidden: boolean; children: React.ReactNode }) {
  const t = useTranslations("chat");
  return (
    <aside className={cn("min-h-0 flex-col border-neutral-800 lg:flex lg:w-[320px] lg:flex-none lg:border-r", hidden ? "hidden" : "flex flex-1")}>
      <h1 className="flex-none px-4 pt-4 pb-3 text-[20px] font-bold tracking-tight text-neutral-50">{t("title")}</h1>
      {children}
    </aside>
  );
}

/** Left column while the conversations load. */
export function ConversationSidebarSkeleton() {
  const t = useTranslations("chat");
  const pathname = usePathname();
  return (
    <SidebarFrame hidden={/^\/messages\/\d+/.test(pathname)}>
      <div role="status" aria-label={t("loading")} className="flex flex-col gap-1 px-2">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex items-center gap-3 px-3 py-2.5">
            <div className="h-[38px] w-[38px] flex-none animate-pulse rounded-full bg-[var(--sc-surface)]" />
            <div className="min-w-0 flex-1">
              <div className="h-3.5 w-28 animate-pulse rounded bg-[var(--sc-surface)]" />
              <div className="mt-2 h-3 w-full animate-pulse rounded bg-[var(--sc-surface)]" />
            </div>
          </div>
        ))}
      </div>
    </SidebarFrame>
  );
}
