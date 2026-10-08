/**
 * GC-Scouting - post-type-tabs
 *
 * Tabs to switch between post types.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

"use client";

import { useLinkStatus } from "next/link";
import { useTranslations } from "next-intl";
import { Loader2Icon } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { POST_TYPES, type PostType } from "@/lib/post-types";
import { cn } from "@/lib/utils";

/** Type switch at the top of the post form, one tab per post type. */
export function PostTypeTabs({ active }: { active: PostType }) {
  const t = useTranslations("newPost");
  const tTypes = useTranslations("home.types");

  return (
    <nav aria-label={t("typeTabs")} className="grid grid-cols-5 gap-1 rounded-xl border border-neutral-800 bg-[var(--sc-surface)] p-1">
      {POST_TYPES.map((type) => {
        const selected = type.key === active;
        return (
          <Link
            key={type.key}
            href={`/posts/new?type=${type.key}`}
            scroll={false}
            aria-current={selected ? "page" : undefined}
            title={tTypes(`${type.key}.label`)}
            className={cn(
              "flex min-w-0 flex-col items-center justify-center rounded-[9px] px-1 py-2 text-center transition-all active:scale-[0.97]",
              selected ? "bg-[var(--sc-surface-2)] shadow-[inset_0_0_0_1px_var(--tab-color)]" : "hover:bg-[var(--sc-hover)]"
            )}
            style={{ "--tab-color": `color-mix(in oklab, ${type.color} 55%, transparent)` } as React.CSSProperties}
          >
            <TabCode code={type.code} color={type.color} selected={selected} />
            <span className={cn("mt-0.5 hidden w-full truncate text-[11.5px] sm:block", selected ? "text-neutral-300" : "text-neutral-500")}>{tTypes(`${type.key}.label`)}</span>
          </Link>
        );
      })}
    </nav>
  );
}

function TabCode({ code, color, selected }: { code: string; color: string; selected: boolean }) {
  // Only works inside the Link, shows the tab is loading.
  const { pending } = useLinkStatus();
  return (
    <span className="inline-flex items-center gap-1.5 font-mono text-[13.5px] font-black tracking-wider" style={{ color: selected || pending ? color : undefined }}>
      {pending && <Loader2Icon className="h-3.5 w-3.5 animate-spin" />}
      <span className={cn(!selected && !pending && "text-neutral-400")}>{code}</span>
    </span>
  );
}
