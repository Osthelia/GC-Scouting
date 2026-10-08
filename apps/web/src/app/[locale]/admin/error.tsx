/**
 * GC-Scouting - admin error
 *
 * Error boundary of the admin area.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

"use client";

import { useEffect, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Loader2, TriangleAlertIcon } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/admin/ui/button";

export default function AdminError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const t = useTranslations("admin");
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-center">
      <TriangleAlertIcon className="size-8 text-destructive" />
      <h1 className="text-xl font-semibold tracking-tight">{t("error.title")}</h1>
      <p className="max-w-sm text-sm text-muted-foreground">{t("error.body")}</p>
      <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
        <Button disabled={pending} onClick={() => startTransition(retry)}>
          {pending && <Loader2 className="animate-spin" />}
          {t("error.retry")}
        </Button>
        <Button variant="outline" render={<Link href="/admin" />}>
          {t("nav.dashboard")}
        </Button>
      </div>
    </div>
  );
}
