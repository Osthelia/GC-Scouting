/**
 * GC-Scouting - message-author-button
 *
 * Button that starts a conversation with the author of a post.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

"use client";

import { useRef } from "react";
import { useTranslations } from "next-intl";
import { MessageSquareIcon, XIcon } from "lucide-react";
import { sendMessage } from "@/actions/chat";
import { Link, useRouter } from "@/i18n/navigation";
import { LoginLink } from "@/components/auth/login-link";
import { ChatComposer } from "./chat-composer";

const buttonClass =
  "inline-flex h-[38px] items-center gap-2 rounded-[10px] bg-[var(--sc-accent)] px-3.5 text-[13px] font-bold text-[var(--sc-accent-ink)] transition-all hover:brightness-110 active:scale-[0.97]";

/** Starts a conversation with the author of a post, or opens the existing one. */
export function MessageAuthorButton({
  postId,
  authorName,
  loggedIn,
  conversationId,
  delegate,
}: {
  postId: number;
  authorName: string;
  loggedIn: boolean;
  conversationId: number | null;
  /** Set when writing for a managed profile. */
  delegate: { name: string; profile: string } | null;
}) {
  const t = useTranslations("chat.start");
  const dialog = useRef<HTMLDialogElement>(null);
  const router = useRouter();

  if (conversationId) {
    return (
      <Link href={`/messages/${conversationId}`} className={buttonClass}>
        <MessageSquareIcon className="h-4 w-4" />
        {t("open")}
      </Link>
    );
  }

  return (
    <>
      <button type="button" onClick={() => dialog.current?.showModal()} className={buttonClass}>
        <MessageSquareIcon className="h-4 w-4" />
        {t("button")}
      </button>
      <dialog
        ref={dialog}
        aria-labelledby={`start-chat-${postId}`}
        onClick={(e) => e.target === e.currentTarget && dialog.current?.close()}
        className="m-auto w-[calc(100%-32px)] max-w-[520px] rounded-2xl border border-neutral-800 bg-[var(--sc-surface-2)] p-0 text-neutral-100 backdrop:bg-black/60 backdrop:backdrop-blur-[2px]"
      >
        <div className="flex items-center justify-between gap-3 border-b border-neutral-800 px-5 py-4">
          <h2 id={`start-chat-${postId}`} className="text-[16px] font-bold tracking-tight text-neutral-50">
            {t("title", { name: authorName })}
          </h2>
          <button
            type="button"
            onClick={() => dialog.current?.close()}
            aria-label={t("close")}
            className="flex h-8 w-8 items-center justify-center rounded-[9px] border border-neutral-800 bg-[var(--sc-surface)] text-neutral-400 transition-all hover:text-neutral-100 active:scale-[0.95]"
          >
            <XIcon className="h-4 w-4" />
          </button>
        </div>
        <div className="px-5 py-5">
          {loggedIn ? (
            <ChatComposer
              large
              send={(body) => sendMessage({ postId }, body)}
              delegate={delegate}
              onSent={(result) => {
                dialog.current?.close();
                router.push(`/messages/${result.conversationId}`);
              }}
            />
          ) : (
            <div className="flex flex-col items-start gap-4">
              <p className="text-[13.5px] leading-relaxed text-neutral-400">{t("loginHint")}</p>
              <LoginLink label={t("login")} small />
            </div>
          )}
        </div>
      </dialog>
    </>
  );
}
