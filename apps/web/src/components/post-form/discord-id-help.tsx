/**
 * GC-Scouting - discord-id-help
 *
 * Help popover that explains how to find a Discord user ID.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronDownIcon, IdCardIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/** How to copy one's Discord user ID, with a replica of Discord's profile menu. */
export function DiscordIdHelp() {
  const t = useTranslations("newPost.discordHelp");
  const [open, setOpen] = useState(false);

  return (
    <div className="mt-1.5">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="inline-flex items-center gap-1 rounded text-[12px] font-semibold text-[var(--sc-accent)] transition-all hover:underline active:scale-[0.97]"
      >
        {t("toggle")}
        <ChevronDownIcon className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="mt-2 grid gap-4 rounded-xl border border-neutral-800 bg-[var(--sc-surface)] p-4 sm:grid-cols-[1fr_auto]">
          <ol className="flex list-decimal flex-col gap-1.5 pl-4 text-[12.5px] leading-snug text-neutral-400">
            <li>{t("step1")}</li>
            <li>{t("step2")}</li>
            <li>{t("step3")}</li>
          </ol>
          <div aria-hidden className="w-[250px] max-w-full select-none rounded-lg border border-[var(--dc-border)] bg-[var(--dc-header)] p-1.5 text-[13px] text-[var(--dc-text)] shadow-lg">
            <p className="rounded px-2 py-1.5">{t("menuProfile")}</p>
            <p className="rounded px-2 py-1.5">{t("menuMention")}</p>
            <div className="my-1 h-px bg-[var(--dc-border)]" />
            <p className="flex items-center justify-between rounded bg-[#5865f2] px-2 py-1.5 font-medium text-white">
              {t("menuCopyId")}
              <IdCardIcon className="h-4 w-4" />
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
