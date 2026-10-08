/**
 * GC-Scouting - conversation-view
 *
 * Polled conversation thread with its composer.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

"use client";

import { Fragment, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { ArrowLeftIcon, BanIcon, ClockIcon, FlagIcon, Loader2Icon, ShieldOffIcon } from "lucide-react";
import { markConversationRead, reportMessage, sendMessage, setUserBlocked } from "@/actions/chat";
import { Link } from "@/i18n/navigation";
import type { ChatMessageView, ConversationDetail, MessageAuthor } from "@/lib/chat/queries";
import { POST_TYPE_BY_KEY } from "@/lib/post-types";
import { UserAvatar } from "@/components/auth/user-menu";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { ReportDialog } from "@/components/post/report-post-button";
import { ChatComposer } from "./chat-composer";
import { MessageBody } from "./message-body";
import { PeerBadges, PeerNotices } from "./peer-badges";
import { cn } from "@/lib/utils";

const POLL_MS = 4000;

/** Tells the conversation list and the header button that something changed. */
export function emitChatChanged() {
  window.dispatchEvent(new Event("chat:changed"));
}

export function ConversationView({ initial, headerExtra }: { initial: ConversationDetail; headerExtra?: React.ReactNode }) {
  const t = useTranslations("chat");
  const [conversation, setConversation] = useState(initial);
  const [blockError, setBlockError] = useState(false);
  const [hasOlder, setHasOlder] = useState(initial.hasMore);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [olderError, setOlderError] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);
  /** Scroll height before older messages were added on top, to keep the view in place. */
  const heightBeforeOlder = useRef<number | null>(null);
  const lastPeerMessage = useRef<number | null>(null);
  const { peer } = conversation;

  const refresh = useCallback(async () => {
    const response = await fetch(`/api/chat/conversations/${initial.id}`, { cache: "no-store" }).catch(() => null);
    if (!response?.ok) return;
    const latest = (await response.json()) as ConversationDetail;
    // The poll only returns the latest page: messages loaded before it are kept.
    setConversation((c) => {
      const first = latest.messages[0]?.id ?? Infinity;
      return { ...latest, messages: [...c.messages.filter((m) => m.id < first), ...latest.messages] };
    });
  }, [initial.id]);

  const loadOlder = async () => {
    const oldest = conversation.messages[0]?.id;
    if (loadingOlder || !oldest) return;
    setLoadingOlder(true);
    setOlderError(false);
    const response = await fetch(`/api/chat/conversations/${initial.id}?before=${oldest}`, { cache: "no-store" }).catch(() => null);
    if (response?.ok) {
      const page = (await response.json()) as { messages: ChatMessageView[]; hasMore: boolean };
      heightBeforeOlder.current = scroller.current?.scrollHeight ?? null;
      setConversation((c) => ({ ...c, messages: [...page.messages.filter((m) => m.id < (c.messages[0]?.id ?? Infinity)), ...c.messages] }));
      setHasOlder(page.hasMore);
    } else setOlderError(true);
    setLoadingOlder(false);
  };

  // Polling while the tab is visible, at once when it comes back.
  useEffect(() => {
    const tick = () => document.visibilityState === "visible" && refresh();
    const timer = window.setInterval(tick, POLL_MS);
    document.addEventListener("visibilitychange", tick);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [refresh]);

  // Read receipt for every new message of the peer.
  useEffect(() => {
    const latest = conversation.messages.filter((m) => !m.mine).at(-1)?.id ?? 0;
    if (lastPeerMessage.current === null || latest > lastPeerMessage.current) {
      lastPeerMessage.current = latest;
      markConversationRead(conversation.id)
        .then(emitChatChanged)
        .catch(() => {});
    }
  }, [conversation.id, conversation.messages]);

  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el) return;
    if (heightBeforeOlder.current !== null) {
      el.scrollTop += el.scrollHeight - heightBeforeOlder.current;
      heightBeforeOlder.current = null;
    } else if (stickToBottom.current) el.scrollTop = el.scrollHeight;
  }, [conversation.messages]);

  const onSent = (message: ChatMessageView) => {
    stickToBottom.current = true;
    setConversation((c) => (c.messages.some((m) => m.id === message.id) ? c : { ...c, messages: [...c.messages, message] }));
    emitChatChanged();
  };

  const toggleBlock = async (blocked: boolean) => {
    setBlockError(false);
    const result = await setUserBlocked(conversation.id, blocked).catch(() => ({ ok: false }) as const);
    if (result.ok) {
      setConversation((c) => ({ ...c, blockedByMe: blocked }));
      emitChatChanged();
    } else setBlockError(true);
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex flex-none flex-wrap items-center gap-x-3 gap-y-2 border-b border-neutral-800 px-4 py-3">
        {/* Full width on mobile so the actions wrap below the name. */}
        <div className="flex min-w-0 flex-1 basis-full items-center gap-3 sm:basis-0">
          <Link
            href="/messages"
            aria-label={t("back")}
            className="flex h-9 w-9 flex-none items-center justify-center rounded-[9px] border border-neutral-800 text-neutral-400 transition-all hover:text-neutral-100 active:scale-[0.95] lg:hidden"
          >
            <ArrowLeftIcon className="h-4 w-4" />
          </Link>
          <UserAvatar user={peer} size={36} />
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-1.5">
              <p className="truncate text-[15px] font-semibold text-neutral-50">{peer.username}</p>
              <PeerBadges peer={peer} compact />
            </div>
            {conversation.post && (
              <Link
                href={`/posts/${conversation.post.type}/${conversation.post.id}`}
                className="block truncate text-[12.5px] text-neutral-500 transition-colors hover:text-[var(--sc-accent)] active:opacity-70"
              >
                {t("fromPost", { code: POST_TYPE_BY_KEY[conversation.post.type].code, name: conversation.post.displayName })}
              </Link>
            )}
          </div>
        </div>
        <div className="ml-auto flex flex-none items-start gap-3">
          {headerExtra}
          <div className="flex flex-none flex-col items-end gap-1">
            {conversation.blockedByMe ? (
              <ConfirmButton label={t("unblock")} confirmLabel={t("unblockConfirm")} cancelLabel={t("cancel")} icon={<ShieldOffIcon className="h-3.5 w-3.5" />} onConfirm={() => toggleBlock(false)} />
            ) : (
              <ConfirmButton label={t("block")} confirmLabel={t("blockConfirm")} cancelLabel={t("cancel")} icon={<BanIcon className="h-3.5 w-3.5" />} danger onConfirm={() => toggleBlock(true)} />
            )}
            {blockError && (
              <p role="alert" className="text-[12px] text-red-400">
                {t("errors.server")}
              </p>
            )}
          </div>
        </div>
      </header>

      <div
        ref={scroller}
        onScroll={(e) => {
          const el = e.currentTarget;
          stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
        }}
        className="min-h-0 flex-1 overflow-y-auto px-4 py-4"
      >
        <div className="mx-auto flex max-w-[760px] flex-col gap-3">
          <PeerNotices peer={peer} />
          {hasOlder && (
            <div className="flex flex-col items-center gap-1.5">
              <button
                type="button"
                onClick={loadOlder}
                disabled={loadingOlder}
                aria-busy={loadingOlder}
                className="inline-flex h-8 items-center gap-2 rounded-[9px] border border-neutral-800 px-3 text-[12.5px] font-semibold text-neutral-400 transition-all hover:bg-[var(--sc-hover)] hover:text-neutral-100 active:scale-[0.97] disabled:opacity-70"
              >
                {loadingOlder && <Loader2Icon className="h-3.5 w-3.5 animate-spin" />}
                {t("loadOlder")}
              </button>
              {olderError && (
                <p role="alert" className="text-[12px] text-red-400">
                  {t("errors.server")}
                </p>
              )}
            </div>
          )}
          <MessageList messages={conversation.messages} peerName={peer.username} />
        </div>
      </div>

      <div className="flex-none border-t border-neutral-800 px-4 py-3">
        <div className="mx-auto max-w-[760px]">
          {conversation.blockedByMe ? (
            <p className="py-2 text-center text-[13px] text-neutral-500">{t("blockedByMe", { name: peer.username })}</p>
          ) : conversation.blockedByPeer ? (
            <p className="py-2 text-center text-[13px] text-neutral-500">{t("blockedByPeer")}</p>
          ) : (
            <ChatComposer
              send={(body) => sendMessage({ conversationId: conversation.id }, body)}
              onSent={(result) => onSent(result.message)}
              delegate={conversation.delegate}
              autoFocus
            />
          )}
        </div>
      </div>
    </div>
  );
}

function MessageList({ messages, peerName }: { messages: ChatMessageView[]; peerName: string }) {
  const t = useTranslations("chat");
  const format = useFormatter();
  const dayKey = (iso: string) => new Date(iso).toDateString();

  if (!messages.length) return <p className="py-10 text-center text-[13px] text-neutral-500">{t("emptyConversation")}</p>;

  return messages.map((message, i) => {
    const newDay = i === 0 || dayKey(messages[i - 1]!.createdAt) !== dayKey(message.createdAt);
    return (
      <Fragment key={message.id}>
        {newDay && (
          <p className="mt-2 text-center text-[11.5px] font-semibold tracking-[0.08em] text-neutral-600 uppercase">
            {format.dateTime(new Date(message.createdAt), { dateStyle: "full" })}
          </p>
        )}
        <MessageBubble message={message} peerName={peerName} />
      </Fragment>
    );
  });
}

function MessageBubble({ message, peerName }: { message: ChatMessageView; peerName: string }) {
  const t = useTranslations("chat");
  const tReport = useTranslations("report");
  const format = useFormatter();
  const time = format.dateTime(new Date(message.createdAt), { timeStyle: "short" });

  if (message.status === "hidden") {
    return (
      <div className={cn("flex", message.mine ? "justify-end" : "justify-start")}>
        <p className="rounded-2xl border border-dashed border-neutral-800 px-3.5 py-2 text-[13px] text-neutral-500 italic">{t("hiddenMessage")}</p>
      </div>
    );
  }

  const held = message.status === "blocked";
  return (
    <div className={cn("flex flex-col gap-1", message.mine ? "items-end" : "items-start")}>
      {message.author && <MessageAuthorLine author={message.author} />}
      <div className={cn("group flex w-full items-end gap-1.5", message.mine ? "flex-row-reverse" : "flex-row")}>
        <div
          className={cn(
            "max-w-[min(85%,560px)] rounded-2xl px-3.5 py-2 text-[14px] leading-relaxed",
            message.mine ? "rounded-br-md bg-[var(--sc-accent)] text-[var(--sc-accent-ink)]" : "rounded-bl-md border border-neutral-800 bg-[var(--sc-surface)] text-neutral-100",
            held && "border border-dashed border-amber-500/60 bg-amber-500/10 text-neutral-100",
          )}
        >
          <MessageBody body={message.body} />
          <p className={cn("mt-1 flex items-center justify-end gap-1 text-[11px]", message.mine && !held ? "text-[var(--sc-accent-ink)]/70" : "text-neutral-500")}>
            {held && (
              <span className="inline-flex items-center gap-1 font-semibold text-amber-300">
                <ClockIcon className="h-3 w-3" />
                {t("held")}
              </span>
            )}
            {time}
          </p>
        </div>
        {!message.mine && (
          <ReportDialog
            id={`message-${message.id}`}
            title={t("reportTitle", { name: message.author?.username ?? peerName })}
            loggedIn
            errors="errors.messageForm"
            submit={(input) => reportMessage(message.id, input)}
          >
            {(open) => (
              <button
                type="button"
                onClick={open}
                aria-label={tReport("button")}
                title={tReport("button")}
                className="mb-1 flex h-7 w-7 flex-none items-center justify-center rounded-md text-neutral-600 opacity-100 transition-all hover:bg-[var(--sc-hover)] hover:text-red-400 focus-visible:opacity-100 active:scale-[0.92] sm:opacity-0 sm:group-hover:opacity-100"
              >
                <FlagIcon className="h-3.5 w-3.5" />
              </button>
            )}
          </ReportDialog>
        )}
      </div>
    </div>
  );
}

/** Manager who wrote a message for the profile, shown above it. */
function MessageAuthorLine({ author }: { author: MessageAuthor }) {
  const t = useTranslations("chat");
  return (
    <p className="flex max-w-[min(85%,560px)] items-center gap-1.5 px-1 text-[11.5px] text-neutral-500">
      <UserAvatar user={author} size={16} />
      <span className="truncate">
        {t.rich("writtenBy", { name: author.username, profile: author.profile, strong: (chunks) => <span className="font-semibold text-neutral-300">{chunks}</span> })}
      </span>
    </p>
  );
}

/** Spinner shown while a conversation loads. */
export function ConversationLoading() {
  return (
    <div className="flex h-full items-center justify-center text-neutral-500">
      <Loader2Icon className="h-6 w-6 animate-spin" />
    </div>
  );
}
