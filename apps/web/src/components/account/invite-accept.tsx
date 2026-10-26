/**
 * GC-Scouting - invite-accept
 *
 * Button that accepts a delegation invite.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { CheckIcon, Loader2Icon, UserPlusIcon } from "lucide-react";
import { Link, useRouter } from "@/i18n/navigation";
import { acceptDelegationInvite, type AcceptInviteResult } from "@/actions/account";

/** Accept button of an invite link: nothing happens until it is clicked. */
export function InviteAccept({ token, owner }: { token: string; owner: string }) {
  const t = useTranslations("invite");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<AcceptInviteResult | null>(null);

  if (result?.ok) {
    return (
      <div className="flex flex-col items-center gap-5">
        <p role="status" className="inline-flex items-center gap-2 text-[14.5px] font-semibold text-[var(--sc-accent)]">
          <CheckIcon className="h-4 w-4" />
          {t("done", { name: owner })}
        </p>
        <div className="flex flex-wrap justify-center gap-2.5">
          <Link
            href="/posts/new"
            className="inline-flex h-11 items-center rounded-[11px] bg-[var(--sc-accent)] px-5 text-[14.5px] font-bold text-[var(--sc-accent-ink)] transition-all hover:brightness-110 active:scale-[0.97]"
          >
            {t("newPost")}
          </Link>
          <Link
            href="/account"
            className="inline-flex h-11 items-center rounded-[11px] border border-neutral-800 bg-[var(--sc-surface)] px-5 text-[14.5px] font-semibold text-neutral-200 transition-all hover:bg-[var(--sc-hover)] active:scale-[0.97]"
          >
            {t("settings")}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <button
        type="button"
        disabled={pending}
        aria-busy={pending}
        onClick={() =>
          startTransition(async () => {
            const next = await acceptDelegationInvite(token).catch((): AcceptInviteResult => ({ ok: false, error: "server" }));
            setResult(next);
            if (next.ok) router.refresh();
          })
        }
        className="inline-flex h-11 items-center gap-2 rounded-[11px] bg-[var(--sc-accent)] px-5 text-[14.5px] font-bold text-[var(--sc-accent-ink)] transition-all hover:brightness-110 active:scale-[0.97] disabled:cursor-wait disabled:opacity-70"
      >
        {pending ? <Loader2Icon className="h-4 w-4 animate-spin" /> : <UserPlusIcon className="h-4 w-4" />}
        {t(pending ? "accepting" : "accept")}
      </button>
      {result && !result.ok && (
        <p role="alert" className="text-[13px] text-red-400">
          {t(`errors.${result.error}`)}
        </p>
      )}
    </div>
  );
}
