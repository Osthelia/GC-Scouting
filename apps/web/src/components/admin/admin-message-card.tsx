/**
 * GC-Scouting - admin-message-card
 *
 * Card that displays a chat message in the admin views.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

import type { ReactNode } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { Check, Eye, EyeOff, X } from "lucide-react";
import type { MessageModeration, MessageStatus } from "@scouting/db";
import { reviewHeldMessage, setMessageHidden } from "@/actions/admin";
import { MessageBody } from "@/components/chat/message-body";
import { AdminActionButton } from "./admin-actions";
import { Badge } from "@/components/admin/ui/badge";
import { cn } from "@/lib/utils";

export type AdminMessageCardData = {
  id: number;
  body: string;
  status: MessageStatus;
  moderation: MessageModeration | null;
  createdAt: Date;
  /** Manager who wrote it for the sender's profile. */
  writtenBy?: string | null;
  reviewedBy?: string | null;
  reviewedAt?: Date | null;
  reportsOpen?: number;
};

/** A chat message as the staff sees it: status, automod categories, and its moderation buttons (or `actions`). */
export function AdminMessageCard({ message, sender, actions, className }: { message: AdminMessageCardData; sender: ReactNode; actions?: ReactNode; className?: string }) {
  const t = useTranslations("admin.messages");
  const format = useFormatter();
  const held = message.status === "blocked" && !message.reviewedAt;

  return (
    <div
      className={cn(
        "flex flex-col gap-2 rounded-xl border bg-card px-3.5 py-2.5",
        message.status === "blocked" && "border-dashed border-amber-400/60 bg-amber-400/5",
        message.status === "hidden" && "border-dashed opacity-75",
        className,
      )}
    >
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span className="font-semibold text-foreground">{sender}</span>
        {message.writtenBy && <span>{t("writtenBy", { name: message.writtenBy })}</span>}
        <span>{format.dateTime(message.createdAt, { dateStyle: "medium", timeStyle: "short" })}</span>
        {message.status !== "visible" && <Badge variant={message.status === "blocked" ? "secondary" : "outline"}>{t(`status.${message.status}`)}</Badge>}
        {message.moderation === null && <Badge variant="outline">{t("unchecked")}</Badge>}
        {message.moderation?.categories.map((c) => (
          <Badge key={c} className="bg-amber-400/15 text-amber-400">
            {c}
          </Badge>
        ))}
        {!!message.reportsOpen && <Badge variant="destructive">{t("reported", { count: message.reportsOpen })}</Badge>}
      </div>
      <MessageBody body={message.body} className="text-sm" />
      {message.reviewedBy && message.reviewedAt && (
        <p className="text-xs text-muted-foreground">{t("reviewedBy", { name: message.reviewedBy, date: format.relativeTime(message.reviewedAt) })}</p>
      )}
      <div className="flex flex-wrap gap-1.5">
        {actions !== undefined ? (
          actions
        ) : (
          <>
            {held && (
              <>
                <AdminActionButton label={t("approve")} icon={<Check />} action={reviewHeldMessage.bind(null, message.id, "approve")} />
                <AdminActionButton label={t("reject")} icon={<X />} variant="destructive" action={reviewHeldMessage.bind(null, message.id, "reject")} />
              </>
            )}
            {message.status === "visible" && (
              <AdminActionButton label={t("hide")} icon={<EyeOff />} confirm={t("hideConfirm")} variant="destructive" action={setMessageHidden.bind(null, message.id, true)} />
            )}
            {message.status === "hidden" && <AdminActionButton label={t("show")} icon={<Eye />} action={setMessageHidden.bind(null, message.id, false)} />}
          </>
        )}
      </div>
    </div>
  );
}
