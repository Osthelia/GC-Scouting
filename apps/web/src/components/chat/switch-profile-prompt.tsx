/**
 * GC-Scouting - switch-profile-prompt
 *
 * Prompt that offers to switch to the profile a conversation belongs to.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

"use client";

import { useTranslations } from "next-intl";
import { Loader2Icon, UsersRoundIcon } from "lucide-react";
import { useSwitchProfile } from "@/components/auth/user-menu";

/** Shown on a conversation of another profile the account can act as. `ownerId` is null for the account's own profile. */
export function SwitchProfilePrompt({ ownerId, name }: { ownerId: string | null; name: string }) {
  const t = useTranslations("chat.switch");
  const switcher = useSwitchProfile();

  return (
    <div className="flex h-full flex-col items-center justify-center px-6 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-xl border border-neutral-800 bg-[var(--sc-surface)] text-[var(--sc-accent)]">
        <UsersRoundIcon className="h-5 w-5" />
      </span>
      <p className="mt-4 text-[16px] font-bold text-neutral-50">{t("title", { name })}</p>
      <p className="mt-1.5 max-w-sm text-[13.5px] leading-relaxed text-neutral-500">{ownerId ? t("managedText") : t("selfText")}</p>
      <button
        type="button"
        onClick={() => switcher.run(ownerId)}
        disabled={switcher.pending}
        aria-busy={switcher.pending}
        className="mt-5 inline-flex h-[38px] items-center gap-2 rounded-[10px] bg-[var(--sc-accent)] px-3.5 text-[13px] font-bold text-[var(--sc-accent-ink)] transition-all hover:brightness-110 active:scale-[0.97] disabled:opacity-70"
      >
        {switcher.pending && <Loader2Icon className="h-4 w-4 animate-spin" />}
        {t("button", { name })}
      </button>
      {switcher.failed && (
        <p role="alert" className="mt-2 text-[12.5px] font-medium text-red-400">
          {t("error")}
        </p>
      )}
    </div>
  );
}
