/**
 * GC-Scouting - peer-badges
 *
 * Badges and notices about the other person of a conversation.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

import { useTranslations } from "next-intl";
import { AlertTriangleIcon, SparklesIcon } from "lucide-react";
import { RECENT_ACCOUNT_DAYS } from "@scouting/db/constants";
import type { ChatPeer } from "@/lib/chat/queries";

/** Recent GC Stats account and active GC Stats warning of the other member. */
export function PeerBadges({ peer, compact }: { peer: ChatPeer; compact?: boolean }) {
  const t = useTranslations("chat.peer");
  if (!peer.recentAccount && !peer.warned) return null;
  const chip = "inline-flex h-5 flex-none items-center gap-1 rounded-md px-1.5 text-[11px] font-semibold";

  return (
    <>
      {peer.recentAccount && (
        <span title={t("recentHint", { days: RECENT_ACCOUNT_DAYS })} className={`${chip} bg-sky-500/15 text-sky-300`}>
          <SparklesIcon className="h-3 w-3" />
          {!compact && t("recent")}
        </span>
      )}
      {peer.warned && (
        <span title={t("warnedHint")} className={`${chip} bg-amber-500/15 text-amber-300`}>
          <AlertTriangleIcon className="h-3 w-3" />
          {!compact && t("warned")}
        </span>
      )}
    </>
  );
}

/** Explains the badges at the top of a conversation. */
export function PeerNotices({ peer }: { peer: ChatPeer }) {
  const t = useTranslations("chat.peer");
  if (!peer.recentAccount && !peer.warned) return null;
  return (
    <div className="flex flex-col gap-2">
      {peer.warned && (
        <p className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[12.5px] leading-snug text-amber-100">
          <AlertTriangleIcon className="mt-0.5 h-3.5 w-3.5 flex-none text-amber-400" />
          {t("warnedNotice", { name: peer.username })}
        </p>
      )}
      {peer.recentAccount && (
        <p className="flex items-start gap-2 rounded-lg border border-sky-500/30 bg-sky-500/10 px-3 py-2 text-[12.5px] leading-snug text-sky-100">
          <SparklesIcon className="mt-0.5 h-3.5 w-3.5 flex-none text-sky-400" />
          {t("recentNotice", { name: peer.username, days: RECENT_ACCOUNT_DAYS })}
        </p>
      )}
    </div>
  );
}
