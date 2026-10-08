/**
 * GC-Scouting - data-panel
 *
 * Account panel to export or delete the account data.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

"use client";

import { useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { DownloadIcon, Loader2Icon, Trash2Icon } from "lucide-react";
import { deleteAccount, type DeleteAccountResult } from "@/actions/account";
import { Field, TextInput } from "@/components/ui/field";
import { AccountCard } from "./account-card";

/** Export of the account data, and account deletion confirmed by typing the username. */
export function DataPanel({ username }: { username: string }) {
  const t = useTranslations("account");
  const locale = useLocale();
  const [exporting, setExporting] = useState(false);
  const [exportFailed, setExportFailed] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [deleting, startDelete] = useTransition();
  const [deleteError, setDeleteError] = useState<Exclude<DeleteAccountResult, { ok: true }>["error"] | null>(null);

  const download = async () => {
    setExporting(true);
    setExportFailed(false);
    try {
      const res = await fetch("/api/account/export", { cache: "no-store" });
      if (!res.ok) throw new Error(`http_${res.status}`);
      const name = res.headers.get("content-disposition")?.match(/filename="([^"]+)"/)?.[1] ?? "gc-scouting-data.json";
      const url = URL.createObjectURL(await res.blob());
      const link = Object.assign(document.createElement("a"), { href: url, download: name });
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      setExportFailed(true);
    } finally {
      setExporting(false);
    }
  };

  const remove = () => {
    setDeleteError(null);
    startDelete(async () => {
      const result = await deleteAccount(confirmation).catch((): DeleteAccountResult => ({ ok: false, error: "server" }));
      // Full reload: the session is gone.
      if (result.ok) window.location.assign(`/${locale}`);
      else setDeleteError(result.error);
    });
  };

  return (
    <>
      <AccountCard title={t("data.title")} description={t("data.hint")}>
        <button
          type="button"
          onClick={download}
          disabled={exporting}
          aria-busy={exporting}
          className="inline-flex h-10 items-center gap-2 rounded-[10px] border border-neutral-800 bg-[var(--sc-surface-2)] px-4 text-[13.5px] font-semibold text-neutral-200 transition-all hover:bg-[var(--sc-hover)] active:scale-[0.97] disabled:opacity-70"
        >
          {exporting ? <Loader2Icon className="h-4 w-4 animate-spin" /> : <DownloadIcon className="h-4 w-4" />}
          {t(exporting ? "data.exporting" : "data.export")}
        </button>
        {exportFailed && (
          <p role="alert" className="mt-3 text-[13px] font-medium text-red-400">
            {t("data.exportFailed")}
          </p>
        )}
      </AccountCard>

      <AccountCard title={t("delete.title")} description={t("delete.hint")} danger>
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            remove();
          }}
          className="flex flex-col gap-4 sm:flex-row sm:items-end"
        >
          <Field
            label={t("delete.confirmLabel", { name: username })}
            htmlFor="deleteConfirmation"
            required
            error={deleteError ? t(`delete.errors.${deleteError}`) : undefined}
            className="flex-1"
          >
            <TextInput
              id="deleteConfirmation"
              value={confirmation}
              onChange={(e) => {
                setConfirmation(e.target.value);
                setDeleteError(null);
              }}
              placeholder={username}
              invalid={deleteError === "confirmation"}
              autoComplete="off"
              spellCheck={false}
            />
          </Field>
          <button
            type="submit"
            disabled={deleting}
            aria-busy={deleting}
            className="inline-flex h-[38px] items-center justify-center gap-2 rounded-[10px] border border-red-500/40 bg-red-500/10 px-4 text-[13.5px] font-semibold text-red-400 transition-all hover:bg-red-500/20 active:scale-[0.97] disabled:opacity-70 sm:mb-[1px]"
          >
            {deleting ? <Loader2Icon className="h-4 w-4 animate-spin" /> : <Trash2Icon className="h-4 w-4" />}
            {t(deleting ? "delete.pending" : "delete.submit")}
          </button>
        </form>
      </AccountCard>
    </>
  );
}
