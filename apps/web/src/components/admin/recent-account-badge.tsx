/**
 * GC-Scouting - recent-account-badge
 *
 * Badge shown on accounts created in the last days.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

import { useTranslations } from "next-intl";
import { RECENT_ACCOUNT_DAYS } from "@scouting/db/constants";
import { Badge } from "@/components/admin/ui/badge";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Same rule as the chat badge: a GC Stats account younger than RECENT_ACCOUNT_DAYS. */
export function RecentAccountBadge({ createdAt }: { createdAt: Date }) {
  const t = useTranslations("chat.peer");
  if (Date.now() - createdAt.getTime() >= RECENT_ACCOUNT_DAYS * DAY_MS) return null;
  return <Badge className="bg-sky-400/15 text-sky-400">{t("recent")}</Badge>;
}
