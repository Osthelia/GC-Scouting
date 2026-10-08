/**
 * GC-Scouting - report-post-button
 *
 * Report dialog with per field validation errors.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

"use client";

import { useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { CheckCircle2Icon, FlagIcon, Loader2Icon, XIcon } from "lucide-react";
import { REPORT_MESSAGE_MAX, REPORT_MESSAGE_MIN, REPORT_REASONS, type ReportReason } from "@scouting/db/constants";
import { reportPost } from "@/actions/reports";
import type { ReportFieldErrors } from "@/lib/report-form";
import { Field, TextArea } from "@/components/ui/field";
import { LoginLink } from "@/components/auth/login-link";
import { cn } from "@/lib/utils";

const ghostButton =
  "inline-flex h-9 items-center gap-1.5 rounded-[9px] border border-neutral-800 bg-[var(--sc-surface)] px-3 text-[13px] font-semibold text-neutral-400 transition-all hover:bg-[var(--sc-hover)] hover:text-neutral-100 active:scale-[0.97]";

export type ReportResult = { ok: true } | { ok: false; fieldErrors: ReportFieldErrors; formError?: string };

/** "Report" button and its dialog on a post. Logged out visitors are asked to log in first. */
export function ReportPostButton({ postId, loggedIn }: { postId: number; loggedIn: boolean }) {
  const t = useTranslations("report");
  return (
    <ReportDialog id={`post-${postId}`} title={t("title")} loggedIn={loggedIn} submit={(input) => reportPost(postId, input)}>
      {(open) => (
        <button type="button" onClick={open} className={ghostButton}>
          <FlagIcon className="h-3.5 w-3.5" />
          {t("button")}
        </button>
      )}
    </ReportDialog>
  );
}

/** Report dialog shared by posts and chat messages, `children` renders the button that opens it. */
export function ReportDialog({
  id,
  title,
  loggedIn,
  submit: send,
  errors = "errors.form",
  children,
}: {
  id: string;
  title: string;
  /** Key of the form errors in the `report` messages. */
  errors?: "errors.form" | "errors.messageForm";
  loggedIn: boolean;
  submit: (input: { reason: ReportReason | null; message: string }) => Promise<ReportResult>;
  children: (open: () => void) => React.ReactNode;
}) {
  const t = useTranslations("report");
  const dialog = useRef<HTMLDialogElement>(null);
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [message, setMessage] = useState("");
  const [fieldErrors, setFieldErrors] = useState<ReportFieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [pending, startTransition] = useTransition();

  function open() {
    if (sent) {
      setSent(false);
      setReason(null);
      setMessage("");
    }
    setFieldErrors({});
    setFormError(null);
    dialog.current?.showModal();
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    startTransition(async () => {
      const result = await send({ reason, message }).catch((): ReportResult => ({ ok: false, fieldErrors: {}, formError: "server" }));
      if (result.ok) {
        setSent(true);
        return;
      }
      setFieldErrors(result.fieldErrors);
      setFormError(result.formError ?? null);
    });
  }

  return (
    <>
      {children(open)}

      <dialog
        ref={dialog}
        aria-labelledby={`report-title-${id}`}
        onClick={(e) => e.target === e.currentTarget && !pending && dialog.current?.close()}
        onCancel={(e) => pending && e.preventDefault()}
        className="m-auto w-[calc(100%-32px)] max-w-[480px] rounded-2xl border border-neutral-800 bg-[var(--sc-surface-2)] p-0 text-neutral-100 backdrop:bg-black/60 backdrop:backdrop-blur-[2px]"
      >
        <div className="flex items-center justify-between gap-3 border-b border-neutral-800 px-5 py-4">
          <h2 id={`report-title-${id}`} className="text-[16px] font-bold tracking-tight text-neutral-50">
            {title}
          </h2>
          <button
            type="button"
            disabled={pending}
            onClick={() => dialog.current?.close()}
            aria-label={t("close")}
            className="flex h-8 w-8 items-center justify-center rounded-[9px] border border-neutral-800 bg-[var(--sc-surface)] text-neutral-400 transition-all hover:text-neutral-100 active:scale-[0.95]"
          >
            <XIcon className="h-4 w-4" />
          </button>
        </div>

        {!loggedIn ? (
          <div className="flex flex-col items-start gap-4 px-5 py-5">
            <p className="text-[13.5px] leading-relaxed text-neutral-400">{t("loginHint")}</p>
            <LoginLink label={t("login")} small />
          </div>
        ) : sent ? (
          <div className="flex flex-col items-start gap-4 px-5 py-5">
            <div className="flex items-start gap-3">
              <CheckCircle2Icon className="mt-0.5 h-5 w-5 flex-none text-emerald-400" />
              <div>
                <p className="text-[14px] font-semibold text-neutral-100">{t("sent")}</p>
                <p className="mt-0.5 text-[13px] text-neutral-400">{t("sentHint")}</p>
              </div>
            </div>
            <button type="button" onClick={() => dialog.current?.close()} className={ghostButton}>
              {t("close")}
            </button>
          </div>
        ) : (
          <form onSubmit={submit} noValidate className="flex flex-col gap-5 px-5 py-5">
            <Field label={t("reason")} required error={fieldErrors.reason && t("errors.reasonRequired")}>
              <div role="radiogroup" aria-label={t("reason")} className="flex flex-col gap-1.5">
                {REPORT_REASONS.map((r) => (
                  <button
                    key={r}
                    type="button"
                    role="radio"
                    aria-checked={reason === r}
                    onClick={() => {
                      setReason(r);
                      setFieldErrors((f) => ({ ...f, reason: undefined }));
                    }}
                    className={cn(
                      "flex flex-col items-start rounded-[10px] border px-3 py-2 text-left transition-all active:scale-[0.99]",
                      reason === r
                        ? "border-[color-mix(in_oklab,var(--sc-accent)_55%,transparent)] bg-[color-mix(in_oklab,var(--sc-accent)_12%,transparent)]"
                        : "border-neutral-800 bg-[var(--sc-surface)] hover:bg-[var(--sc-hover)]"
                    )}
                  >
                    <span className={cn("text-[13.5px] font-semibold", reason === r ? "text-[var(--sc-accent)]" : "text-neutral-200")}>{t(`reasons.${r}.label`)}</span>
                    <span className="text-[12px] text-neutral-500">{t(`reasons.${r}.hint`)}</span>
                  </button>
                ))}
              </div>
            </Field>

            <Field
              label={t("message")}
              htmlFor={`report-message-${id}`}
              required={reason === "other"}
              hint={t("messageHint")}
              error={fieldErrors.message && t(`errors.message.${fieldErrors.message}`, { min: REPORT_MESSAGE_MIN, max: REPORT_MESSAGE_MAX })}
              aside={
                <span className={cn("text-[11.5px] tabular-nums", message.trim().length > REPORT_MESSAGE_MAX ? "text-red-400" : "text-neutral-600")}>
                  {message.trim().length}/{REPORT_MESSAGE_MAX}
                </span>
              }
            >
              <TextArea
                id={`report-message-${id}`}
                value={message}
                invalid={!!fieldErrors.message}
                onChange={(e) => {
                  setMessage(e.target.value);
                  setFieldErrors((f) => ({ ...f, message: undefined }));
                }}
                className="min-h-[100px]"
              />
            </Field>

            {formError && (
              <p role="alert" className="rounded-[10px] border border-red-500/30 bg-red-500/10 px-3 py-2 text-[13px] text-red-300">
                {t(`${errors}.${formError}`)}
              </p>
            )}

            <div className="flex justify-end gap-2">
              <button type="button" disabled={pending} onClick={() => dialog.current?.close()} className={ghostButton}>
                {t("cancel")}
              </button>
              <button
                type="submit"
                disabled={pending}
                aria-busy={pending}
                className="inline-flex h-9 items-center gap-1.5 rounded-[9px] border border-red-500/40 bg-red-500/10 px-3 text-[13px] font-semibold text-red-400 transition-all hover:bg-red-500/20 active:scale-[0.97] disabled:opacity-70"
              >
                {pending ? <Loader2Icon className="h-3.5 w-3.5 animate-spin" /> : <FlagIcon className="h-3.5 w-3.5" />}
                {pending ? t("sending") : t("submit")}
              </button>
            </div>
          </form>
        )}
      </dialog>
    </>
  );
}
