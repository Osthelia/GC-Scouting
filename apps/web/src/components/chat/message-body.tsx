/**
 * GC-Scouting - message-body
 *
 * Message text with safe link rendering.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { AlertTriangleIcon, EyeIcon, LinkIcon } from "lucide-react";
import { tokenizeMessage, type ChatToken } from "@/lib/chat/links";
import { cn } from "@/lib/utils";

/** Message text: trusted links are clickable, the others stay hidden until the reader confirms. */
export function MessageBody({ body, className }: { body: string; className?: string }) {
  const tokens = useMemo(() => tokenizeMessage(body), [body]);
  return (
    <p className={cn("break-words whitespace-pre-wrap", className)}>
      {tokens.map((token, i) =>
        token.kind === "text" ? (
          token.value
        ) : token.trusted ? (
          <a key={i} href={token.href} target="_blank" rel="noopener noreferrer nofollow ugc" className="font-medium underline underline-offset-2 hover:opacity-80 active:opacity-60">
            {token.label}
          </a>
        ) : (
          <HiddenLink key={i} token={token} />
        ),
      )}
    </p>
  );
}

function HiddenLink({ token }: { token: Extract<ChatToken, { kind: "link" }> }) {
  const t = useTranslations("chat.link");
  const [state, setState] = useState<"hidden" | "confirm" | "shown">("hidden");

  if (state === "shown") {
    return (
      <a
        href={token.href}
        target="_blank"
        rel="noopener noreferrer nofollow ugc"
        className="inline-flex items-center gap-1 font-medium text-amber-300 underline underline-offset-2 hover:opacity-80 active:opacity-60"
      >
        <AlertTriangleIcon className="h-3.5 w-3.5 flex-none" />
        {token.label}
      </a>
    );
  }

  if (state === "confirm") {
    return (
      <span className="my-1 block rounded-lg border border-amber-500/40 bg-amber-500/10 px-2.5 py-2 text-[12.5px] leading-snug text-amber-100">
        <span className="flex items-start gap-1.5">
          <AlertTriangleIcon className="mt-0.5 h-3.5 w-3.5 flex-none text-amber-400" />
          {t("warning")}
        </span>
        <span className="mt-2 flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setState("shown")}
            className="inline-flex h-7 items-center gap-1 rounded-md bg-amber-500/20 px-2 font-semibold text-amber-200 transition-all hover:bg-amber-500/30 active:scale-[0.97]"
          >
            <EyeIcon className="h-3.5 w-3.5" />
            {t("show")}
          </button>
          <button
            type="button"
            onClick={() => setState("hidden")}
            className="inline-flex h-7 items-center rounded-md px-2 font-semibold text-amber-200/80 transition-all hover:bg-amber-500/10 active:scale-[0.97]"
          >
            {t("cancel")}
          </button>
        </span>
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setState("confirm")}
      title={t("hiddenHint")}
      className="mx-0.5 inline-flex items-center gap-1 rounded-md border border-current/30 px-1.5 align-baseline text-[12.5px] font-semibold opacity-80 transition-all hover:opacity-100 active:scale-[0.97]"
    >
      <LinkIcon className="h-3 w-3" />
      {t("hidden")}
    </button>
  );
}
