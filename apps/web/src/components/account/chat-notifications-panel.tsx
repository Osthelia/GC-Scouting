/**
 * GC-Scouting - chat-notifications-panel
 *
 * Account panel to choose how new chat messages are notified.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { BellIcon, CheckCircle2Icon, Loader2Icon, SaveIcon } from "lucide-react";
import { updateChatNotifications, type ChatNotificationsResult } from "@/actions/account";
import { CheckRow } from "@/components/ui/check-row";

/** Alerts sent for new messages (one per unread conversation). */
export function ChatNotificationsPanel({ initial, email, hasDiscord }: { initial: { email: boolean; discord: boolean }; email: string | null; hasDiscord: boolean }) {
  const t = useTranslations("account.chatNotifications");
  const [values, setValues] = useState({ email: initial.email && !!email, discord: initial.discord && hasDiscord });
  const [status, setStatus] = useState<"idle" | "saved" | Exclude<ChatNotificationsResult, { ok: true }>["error"]>("idle");
  const [pending, startTransition] = useTransition();

  const save = () =>
    startTransition(async () => {
      const result = await updateChatNotifications(values).catch((): ChatNotificationsResult => ({ ok: false, error: "server" }));
      setStatus(result.ok ? "saved" : result.error);
    });

  return (
    <section className="rounded-2xl border border-neutral-800 bg-[var(--sc-surface)] p-4 sm:p-6">
      <h2 className="text-[16px] font-bold tracking-tight text-neutral-50">{t("title")}</h2>
      <p className="mt-1 text-[13px] leading-relaxed text-neutral-500">{t("text")}</p>
      <div className="mt-4 flex flex-col gap-2">
        <CheckRow
          icon={BellIcon}
          checked={values.email}
          disabled={!email}
          onChange={(v) => {
            setValues((s) => ({ ...s, email: v }));
            setStatus("idle");
          }}
          label={t("email")}
          detail={email ?? t("noEmail")}
          invalid={status === "noEmail"}
        />
        <CheckRow
          icon={BellIcon}
          checked={values.discord}
          disabled={!hasDiscord}
          onChange={(v) => {
            setValues((s) => ({ ...s, discord: v }));
            setStatus("idle");
          }}
          label={t("discord")}
          detail={hasDiscord ? t("discordLinked") : t("noDiscord")}
          invalid={status === "noDiscord"}
        />
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-end gap-3">
        {status === "saved" ? (
          <span className="mr-auto inline-flex items-center gap-1.5 text-[13px] font-medium text-emerald-400">
            <CheckCircle2Icon className="h-4 w-4" />
            {t("saved")}
          </span>
        ) : (
          status !== "idle" && (
            <span role="alert" className="mr-auto text-[13px] font-medium text-red-400">
              {t(`errors.${status}`)}
            </span>
          )
        )}
        <button
          type="button"
          onClick={save}
          disabled={pending}
          aria-busy={pending}
          className="inline-flex h-10 items-center gap-2 rounded-[10px] bg-[var(--sc-accent)] px-4 text-[13.5px] font-bold text-[var(--sc-accent-ink)] transition-all hover:brightness-110 active:scale-[0.97] disabled:opacity-70"
        >
          {pending ? <Loader2Icon className="h-4 w-4 animate-spin" /> : <SaveIcon className="h-4 w-4" />}
          {t("save")}
        </button>
      </div>
    </section>
  );
}
