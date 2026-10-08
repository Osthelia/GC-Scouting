/**
 * GC-Scouting - post-author-actions
 *
 * Edit, renew and delete actions for the author of a post.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { LockIcon, PencilIcon } from "lucide-react";
import type { PostType } from "@scouting/db/constants";
import { closePost, type ClosePostResult } from "@/actions/posts";
import { Link, useRouter } from "@/i18n/navigation";
import { ConfirmButton } from "@/components/ui/confirm-button";

/** Edit and close buttons of an active post, for its author. */
export function PostAuthorActions({ postId, type }: { postId: number; type: PostType }) {
  const t = useTranslations("postAuthor");
  const router = useRouter();
  const [error, setError] = useState<Exclude<ClosePostResult, { ok: true }>["error"] | null>(null);

  async function close() {
    setError(null);
    const result = await closePost(postId).catch((): ClosePostResult => ({ ok: false, error: "server" }));
    if (result.ok) router.refresh();
    else setError(result.error);
  }

  return (
    <div className="flex flex-col items-start gap-1.5 sm:items-end">
      <div className="flex flex-wrap items-center gap-1.5">
        <Link
          href={`/posts/${type}/${postId}/edit`}
          className="inline-flex h-9 items-center gap-1.5 rounded-[9px] border border-neutral-800 bg-[var(--sc-surface)] px-3 text-[13px] font-semibold text-neutral-300 transition-all hover:bg-[var(--sc-hover)] hover:text-neutral-100 active:scale-[0.97]"
        >
          <PencilIcon className="h-3.5 w-3.5" />
          {t("edit")}
        </Link>
        <ConfirmButton
          label={t("close")}
          confirmLabel={t("closeConfirm")}
          cancelLabel={t("cancel")}
          icon={<LockIcon className="h-3.5 w-3.5" />}
          danger
          onConfirm={close}
        />
      </div>
      {error && (
        <span role="alert" className="text-[12.5px] text-red-400">
          {t(`errors.${error}`)}
        </span>
      )}
    </div>
  );
}
