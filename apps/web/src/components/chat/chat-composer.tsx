/**
 * GC-Scouting - chat-composer
 *
 * Message input of a conversation.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

"use client";

import { useState, useTransition } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { Loader2Icon, SendIcon, ShieldCheckIcon, UserRoundIcon } from "lucide-react";
import { CHAT_MESSAGE_MAX } from "@scouting/db/constants";
import type { SendMessageResult } from "@/actions/chat";
import { TextArea } from "@/components/ui/field";
import { cn } from "@/lib/utils";

/** The staff can read conversations, said wherever a message is written. */
export function StaffNotice({ className }: { className?: string }) {
  const t = useTranslations("chat");
  return (
    <p className={cn("flex items-start gap-1.5 text-[11.5px] leading-snug text-neutral-500", className)}>
      <ShieldCheckIcon className="mt-px h-3.5 w-3.5 flex-none text-neutral-500" />
      {t("staffNotice")}
    </p>
  );
}

/** Message field with its send button. Enter sends, Shift+Enter adds a line. `delegate` is set when writing for a managed profile. */
export function ChatComposer({
  send,
  onSent,
  delegate,
  autoFocus,
  large,
}: {
  send: (body: string) => Promise<SendMessageResult>;
  onSent: (result: Extract<SendMessageResult, { ok: true }>) => void;
  delegate?: { name: string; profile: string } | null;
  autoFocus?: boolean;
  large?: boolean;
}) {
  const t = useTranslations("chat");
  const format = useFormatter();
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const length = body.trim().length;

  const submit = () => {
    if (pending) return;
    setError(null);
    const sent = body;
    startTransition(async () => {
      const result = await send(sent).catch((): SendMessageResult => ({ ok: false, error: "server" }));
      if (result.ok) {
        // Only the sent text goes, what was typed during the send stays.
        setBody((current) => (current.startsWith(sent) ? current.slice(sent.length).replace(/^\n+/, "") : current));
        onSent(result);
        return;
      }
      if (result.bodyError) setError(t(`errors.body.${result.bodyError}`, { max: CHAT_MESSAGE_MAX }));
      else if (result.error === "sanctioned") {
        setError(
          result.sanctionEndsAt
            ? t("errors.sanctionedUntil", { date: format.dateTime(new Date(result.sanctionEndsAt), { dateStyle: "long", timeStyle: "short" }) })
            : t("errors.sanctioned"),
        );
      } else setError(t(`errors.${result.error ?? "server"}`));
    });
  };

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="flex flex-col gap-1.5"
    >
      {delegate && (
        <p className="flex items-start gap-1.5 text-[12px] leading-snug text-neutral-400">
          <UserRoundIcon className="mt-px h-3.5 w-3.5 flex-none text-[var(--sc-accent)]" />
          {t("delegateNotice", { name: delegate.name, profile: delegate.profile })}
        </p>
      )}
      <div className="flex items-end gap-2">
        <TextArea
          value={body}
          autoFocus={autoFocus}
          aria-label={t("placeholder")}
          placeholder={t("placeholder")}
          invalid={!!error && length === 0}
          maxLength={CHAT_MESSAGE_MAX + 200}
          onChange={(e) => {
            setBody(e.target.value);
            if (error) setError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              submit();
            }
          }}
          className={cn("resize-none", large ? "min-h-[120px]" : "max-h-[160px] min-h-[44px] py-2.5")}
        />
        <button
          type="submit"
          disabled={pending}
          aria-busy={pending}
          aria-label={t("send")}
          className="inline-flex h-11 flex-none items-center gap-2 rounded-[11px] bg-[var(--sc-accent)] px-3.5 text-[14px] font-bold text-[var(--sc-accent-ink)] transition-all hover:brightness-110 active:scale-[0.96] disabled:opacity-70"
        >
          {pending ? <Loader2Icon className="h-[18px] w-[18px] animate-spin" /> : <SendIcon className="h-[17px] w-[17px]" />}
          {large && t("send")}
        </button>
      </div>
      <div className="flex items-start justify-between gap-3">
        {error ? (
          <p role="alert" className="text-[12.5px] font-medium text-red-400">
            {error}
          </p>
        ) : (
          <StaffNotice />
        )}
        <span className={cn("flex-none text-[11.5px] tabular-nums", length > CHAT_MESSAGE_MAX ? "text-red-400" : "text-neutral-600")}>
          {length}/{CHAT_MESSAGE_MAX}
        </span>
      </div>
    </form>
  );
}
