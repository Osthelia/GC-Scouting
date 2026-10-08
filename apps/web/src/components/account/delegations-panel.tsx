/**
 * GC-Scouting - delegations-panel
 *
 * Account panel to invite, accept and remove delegates.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

"use client";

import { useState, useTransition } from "react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { LinkIcon, Loader2Icon, LogOutIcon, PlusIcon, UserMinusIcon, XIcon } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { createDelegationInvite, removeDelegation, revokeDelegationInvite, type CreateInviteResult, type DelegationActionResult } from "@/actions/account";
import type { DelegationOverview, DelegationPerson } from "@/lib/auth/delegations";
import { UserAvatar, useSwitchProfile } from "@/components/auth/user-menu";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { CopyButton } from "@/components/ui/copy-button";
import { AccountCard } from "./account-card";

type Scope = "delegates" | "managed";
type ActionError = Exclude<DelegationActionResult, { ok: true }>["error"] | Exclude<CreateInviteResult, { ok: true }>["error"];

/** Who manages the profile, which profiles the account manages, and invite links. */
export function DelegationsPanel({ overview, activeId, limits }: { overview: DelegationOverview; activeId: string; limits: { delegates: number; inviteDays: number } }) {
  const t = useTranslations("account");
  const format = useFormatter();
  const locale = useLocale();
  const router = useRouter();
  const switcher = useSwitchProfile();
  const [creating, startCreate] = useTransition();
  const [invite, setInvite] = useState<{ url: string; expiresAt: string } | null>(null);
  const [error, setError] = useState<{ scope: Scope; code: ActionError } | null>(null);

  const date = (iso: string) => format.dateTime(new Date(iso), { dateStyle: "medium" });

  /** Runs a mutation, then reloads the lists. */
  const mutate = async (scope: Scope, action: () => Promise<DelegationActionResult>) => {
    setError(null);
    const result = await action().catch((): DelegationActionResult => ({ ok: false, error: "server" }));
    if (result.ok) router.refresh();
    else setError({ scope, code: result.error });
  };

  const create = () => {
    setError(null);
    startCreate(async () => {
      const result = await createDelegationInvite(locale).catch((): CreateInviteResult => ({ ok: false, error: "server" }));
      if (result.ok) {
        setInvite({ url: `${window.location.origin}${result.path}`, expiresAt: result.expiresAt });
        router.refresh();
      } else setError({ scope: "delegates", code: result.error });
    });
  };

  const errorLine = (scope: Scope) =>
    error?.scope === scope && (
      <p role="alert" className="mt-3 text-[13px] font-medium text-red-400">
        {t(`errors.${error.code}`, { max: limits.delegates })}
      </p>
    );

  return (
    <>
      <AccountCard title={t("delegates.title")} description={t("delegates.hint", { max: limits.delegates })}>
        <div className="flex flex-col gap-2">
          {overview.delegates.length === 0 && overview.invites.length === 0 && <p className="text-[13.5px] text-neutral-500">{t("delegates.empty")}</p>}
          {overview.delegates.map((person) => (
            <PersonRow key={person.id} person={person} detail={t("since", { date: date(person.since) })}>
              <ConfirmButton
                label={t("delegates.remove")}
                confirmLabel={t("confirm")}
                cancelLabel={t("cancel")}
                icon={<UserMinusIcon className="h-3.5 w-3.5" />}
                danger
                onConfirm={() => mutate("delegates", () => removeDelegation(person.id))}
              />
            </PersonRow>
          ))}
          {overview.invites.map((pending) => (
            <div key={pending.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-dashed border-neutral-800 px-3.5 py-2.5">
              <LinkIcon className="h-4 w-4 flex-none text-neutral-500" />
              <span className="min-w-0 flex-1 text-[13px] text-neutral-400">{t("delegates.pendingInvite", { date: date(pending.expiresAt) })}</span>
              <ConfirmButton
                label={t("delegates.revokeInvite")}
                confirmLabel={t("confirm")}
                cancelLabel={t("cancel")}
                icon={<XIcon className="h-3.5 w-3.5" />}
                danger
                onConfirm={async () => {
                  await mutate("delegates", () => revokeDelegationInvite(pending.id));
                  setInvite(null);
                }}
              />
            </div>
          ))}
        </div>

        {invite && (
          <div className="mt-4 rounded-xl border border-[color-mix(in_oklab,var(--sc-accent)_35%,transparent)] bg-[color-mix(in_oklab,var(--sc-accent)_8%,transparent)] p-3.5">
            <p className="text-[13px] font-semibold text-neutral-100">{t("delegates.inviteReady")}</p>
            <p className="mt-0.5 text-[12.5px] text-neutral-400">{t("delegates.inviteHint", { days: limits.inviteDays })}</p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <code className="min-w-0 flex-1 truncate rounded-[9px] border border-neutral-800 bg-[var(--sc-surface)] px-3 py-2 font-mono text-[12.5px] text-neutral-300">{invite.url}</code>
              <CopyButton value={invite.url} label={t("delegates.copy")} copiedLabel={t("delegates.copied")} icon={<LinkIcon className="h-4 w-4" />} />
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={create}
          disabled={creating}
          aria-busy={creating}
          className="mt-4 inline-flex h-10 items-center gap-2 rounded-[10px] bg-[var(--sc-accent)] px-4 text-[13.5px] font-bold text-[var(--sc-accent-ink)] transition-all hover:brightness-110 active:scale-[0.97] disabled:opacity-70"
        >
          {creating ? <Loader2Icon className="h-4 w-4 animate-spin" /> : <PlusIcon className="h-4 w-4" />}
          {t("delegates.create")}
        </button>
        {errorLine("delegates")}
      </AccountCard>

      <AccountCard title={t("managed.title")} description={t("managed.hint")}>
        <div className="flex flex-col gap-2">
          {overview.managed.length === 0 && <p className="text-[13.5px] text-neutral-500">{t("managed.empty")}</p>}
          {overview.managed.map((person) => {
            const active = person.userId === activeId;
            return (
              <PersonRow key={person.id} person={person} detail={active ? t("managed.active") : t("since", { date: date(person.since) })}>
                {!active && (
                  <button
                    type="button"
                    onClick={() => switcher.run(person.userId)}
                    disabled={switcher.pending}
                    className="inline-flex h-9 items-center gap-1.5 rounded-[9px] border border-neutral-800 bg-[var(--sc-surface)] px-3 text-[13px] font-semibold text-neutral-200 transition-all hover:bg-[var(--sc-hover)] active:scale-[0.97] disabled:opacity-70"
                  >
                    {switcher.target === person.userId && <Loader2Icon className="h-3.5 w-3.5 animate-spin" />}
                    {t("managed.use")}
                  </button>
                )}
                <ConfirmButton
                  label={t("managed.leave")}
                  confirmLabel={t("confirm")}
                  cancelLabel={t("cancel")}
                  icon={<LogOutIcon className="h-3.5 w-3.5" />}
                  danger
                  onConfirm={() => mutate("managed", () => removeDelegation(person.id))}
                />
              </PersonRow>
            );
          })}
        </div>
        {errorLine("managed")}
        {switcher.failed && (
          <p role="alert" className="mt-3 text-[13px] font-medium text-red-400">
            {t("errors.notFound")}
          </p>
        )}
      </AccountCard>
    </>
  );
}

function PersonRow({ person, detail, children }: { person: DelegationPerson; detail: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-neutral-800 bg-[var(--sc-surface-2)] px-3.5 py-2.5">
      <UserAvatar user={person} size={32} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[14px] font-semibold text-neutral-100">{person.username}</p>
        <p className="text-[12px] text-neutral-500">{detail}</p>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">{children}</div>
    </div>
  );
}
