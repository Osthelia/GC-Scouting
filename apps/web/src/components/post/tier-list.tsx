/**
 * GC-Scouting - tier-list
 *
 * Read only tier list.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

import { useTranslations } from "next-intl";
import { TIERS, groupByTier, type TierList } from "@/lib/tiers";
import { AgentIcon } from "./agent-icon";
import { cn } from "@/lib/utils";

/** Read only tierlist, same layout as the classic tiermaker grid. */
export function TierListView({ tierList, iconSize = 36, className }: { tierList: TierList; iconSize?: number; className?: string }) {
  const t = useTranslations("tiers");
  const rows = groupByTier(tierList);

  return (
    <div className={cn("overflow-hidden rounded-xl border border-neutral-800 bg-[var(--sc-surface-2)]", className)}>
      {TIERS.map((tier, i) => (
        <div key={tier.key} className="flex border-b border-neutral-800 last:border-b-0">
          <div
            className="flex w-[88px] flex-none items-center justify-center px-2 py-1.5 text-center text-[11.5px] leading-tight font-bold text-[#141414] sm:w-[104px]"
            style={{ background: tier.color }}
          >
            {t(tier.key)}
          </div>
          <div className="flex min-h-[44px] flex-1 flex-wrap content-center gap-1 p-1.5">
            {rows[i]!.map((slug) => (
              <AgentIcon key={slug} slug={slug} size={iconSize} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
