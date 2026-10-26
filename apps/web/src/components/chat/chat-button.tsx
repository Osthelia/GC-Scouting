/**
 * GC-Scouting - chat-button
 *
 * Header button that opens the messages, with the unread badge.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowRightIcon, Loader2Icon, MessageSquareIcon } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { ConversationItems, NoConversation, useConversations } from "./conversation-list";
import { cn } from "@/lib/utils";

/** Header button: unread badge, and the latest conversations in a menu. */
export function ChatButton({ initialUnread }: { initialUnread: number }) {
  const t = useTranslations("chat");
  const [open, setOpen] = useState(false);
  const { conversations, unread, refresh } = useConversations(null, 8);
  const count = unread ?? initialUnread;

  useEffect(() => {
    if (!open) return;
    refresh();
    const close = () => setOpen(false);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [open, refresh]);

  return (
    <div className="relative flex-none">
      <button
        type="button"
        aria-expanded={open}
        aria-label={count > 0 ? t("unreadLabel", { count }) : t("title")}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className={cn(
          "relative flex h-[38px] w-[38px] items-center justify-center rounded-[10px] border border-neutral-800 bg-[var(--sc-surface)] text-neutral-300 transition-all hover:bg-[var(--sc-hover)] hover:text-neutral-100 active:scale-[0.95]",
          open && "bg-[var(--sc-hover)] text-neutral-100",
        )}
      >
        <MessageSquareIcon className="h-[18px] w-[18px]" />
        {count > 0 && (
          <span className="absolute -top-1.5 -right-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full border-2 border-[var(--sc-bg)] bg-[var(--sc-accent)] px-1 text-[10px] font-bold text-[var(--sc-accent-ink)]">
            {count > 99 ? "99+" : count}
          </span>
        )}
      </button>
      {open && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="fixed inset-x-3 top-[70px] z-[70] rounded-xl border border-neutral-800 bg-[var(--sc-surface-3)] p-1.5 shadow-[0_20px_48px_rgba(0,0,0,.7)] sm:absolute sm:inset-x-auto sm:top-[46px] sm:right-0 sm:w-[360px]"
        >
          <p className="px-2.5 pt-1.5 pb-2 text-[11px] font-semibold tracking-[0.12em] text-neutral-500 uppercase">{t("title")}</p>
          <div className="max-h-[min(420px,60vh)] overflow-y-auto">
            {conversations === null ? (
              <div className="flex justify-center py-8 text-neutral-500">
                <Loader2Icon className="h-5 w-5 animate-spin" />
              </div>
            ) : conversations.length ? (
              <ConversationItems conversations={conversations} onNavigate={() => setOpen(false)} />
            ) : (
              <NoConversation />
            )}
          </div>
          <Link
            href="/messages"
            onClick={() => setOpen(false)}
            className="mt-1 flex items-center justify-center gap-1.5 rounded-lg border-t border-neutral-800 px-2.5 py-2.5 text-[13px] font-semibold text-[var(--sc-accent)] transition-colors hover:bg-[var(--sc-hover)] active:bg-[var(--sc-hover-2)]"
          >
            {t("seeAll")}
            <ArrowRightIcon className="h-3.5 w-3.5" />
          </Link>
        </div>
      )}
    </div>
  );
}
