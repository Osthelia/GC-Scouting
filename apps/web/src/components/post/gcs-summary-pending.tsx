/**
 * GC-Scouting - gcs-summary-pending
 *
 * Placeholder that polls until the GC Stats summary is ready.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2Icon } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { isGcsSummarySynced } from "@/actions/posts";

const POLL_MS = 2500;
const TIMEOUT_MS = 60_000;

/** Shown while the GC Stats history of a new post is fetched in the background, reloads the page once it is there. */
export function GcsSummaryPending({ postId }: { postId: number }) {
  const t = useTranslations("postPage.gcsPending");
  const router = useRouter();
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    const started = Date.now();
    let timer: ReturnType<typeof setTimeout>;
    let stopped = false;

    async function poll() {
      const synced = await isGcsSummarySynced(postId).catch(() => false);
      if (stopped) return;
      if (synced) return router.refresh();
      if (Date.now() - started >= TIMEOUT_MS) return setTimedOut(true);
      timer = setTimeout(poll, POLL_MS);
    }

    timer = setTimeout(poll, POLL_MS);
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [postId, router]);

  if (timedOut) return <p className="mt-3 rounded-lg bg-[var(--sc-surface-2)] px-3 py-2 text-[12.5px] text-neutral-400">{t("timeout")}</p>;

  return (
    <div role="status" className="mt-4">
      <p className="flex items-center gap-2 text-[13px] text-neutral-400">
        <Loader2Icon className="h-4 w-4 animate-spin text-[var(--sc-accent)]" />
        {t("loading")}
      </p>
      <div className="mt-3 grid gap-4 lg:grid-cols-2">
        <div className="h-[150px] animate-pulse rounded-xl border border-neutral-800 bg-[var(--sc-surface-2)]" />
        <div className="h-[150px] animate-pulse rounded-xl border border-neutral-800 bg-[var(--sc-surface-2)]" />
      </div>
    </div>
  );
}
