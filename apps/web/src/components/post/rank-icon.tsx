/**
 * GC-Scouting - rank-icon
 *
 * Rank icon with fallback.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

"use client";

import { useState } from "react";
import { RANK_BY_KEY, rankIconUrl, type Rank } from "@/lib/ranks";
import { useImageFallback } from "@/lib/use-image-fallback";

/** Rank emblem, falls back to a colored diamond if the image can't load. */
export function RankIcon({ rank, size = 20 }: { rank: Rank; size?: number }) {
  const [failed, setFailed] = useState(false);
  const fallback = useImageFallback(() => setFailed(true));
  const def = RANK_BY_KEY[rank];

  return (
    <span title={def.label} className="flex flex-none items-center justify-center" style={{ width: size, height: size }}>
      {failed ? (
        <span className="h-2 w-2 rotate-45 rounded-[2px]" style={{ background: def.color }} />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={rankIconUrl(rank)} alt={def.label} width={size} height={size} loading="lazy" {...fallback} className="h-full w-full object-contain" />
      )}
    </span>
  );
}
