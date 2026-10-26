/**
 * GC-Scouting - admin-actions
 *
 * Staff action buttons and the remove post dialog.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

"use client";

import { useState, useTransition, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import { useRouter, usePathname } from "@/i18n/navigation";
import type { AdminActionResult } from "@/actions/admin";
import { REMOVAL_REASON_MAX, REMOVAL_REASON_MIN } from "@/lib/admin/constants";
import { Button } from "@/components/admin/ui/button";
import { Input } from "@/components/admin/ui/input";
import { Textarea } from "@/components/admin/ui/textarea";
import { Label } from "@/components/admin/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/admin/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/admin/ui/dialog";

type Variant = "default" | "outline" | "secondary" | "ghost" | "destructive";

/** Runs an admin action, shows its error, then reloads the server data. `confirm` asks once more in place. */
export function AdminActionButton({
  label,
  icon,
  variant = "outline",
  confirm,
  action,
}: {
  label: string;
  icon?: ReactNode;
  variant?: Variant;
  confirm?: string;
  action: () => Promise<AdminActionResult>;
}) {
  const t = useTranslations("admin");
  const router = useRouter();
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const runAction = () =>
    startTransition(async () => {
      setError(null);
      const result = await action().catch((): AdminActionResult => ({ ok: false, error: "server" }));
      setAsking(false);
      if (result.ok) router.refresh();
      else setError(t(`errors.${result.error}`));
    });

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <span className="inline-flex flex-wrap gap-1.5">
        {asking ? (
          <>
            <Button size="sm" variant={variant === "outline" ? "default" : variant} disabled={pending} onClick={runAction}>
              {pending && <Loader2 className="animate-spin" />}
              {confirm}
            </Button>
            <Button size="sm" variant="ghost" disabled={pending} onClick={() => setAsking(false)}>
              {t("common.cancel")}
            </Button>
          </>
        ) : (
          <Button size="sm" variant={variant} disabled={pending} onClick={() => (confirm ? setAsking(true) : runAction())}>
            {pending ? <Loader2 className="animate-spin" /> : icon}
            {label}
          </Button>
        )}
      </span>
      {error && (
        <span role="alert" className="text-xs text-destructive">
          {error}
        </span>
      )}
    </span>
  );
}

/** Removal of a post with its reason (required, shown to moderators on Discord too). */
export function RemovePostDialog({ postName, trigger, action }: { postName: string; trigger: string; action: (reason: string) => Promise<AdminActionResult> }) {
  const t = useTranslations("admin");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = () => {
    const trimmed = reason.trim();
    if (trimmed.length < REMOVAL_REASON_MIN || trimmed.length > REMOVAL_REASON_MAX) {
      setError(t("errors.reasonLength", { min: REMOVAL_REASON_MIN, max: REMOVAL_REASON_MAX }));
      return;
    }
    startTransition(async () => {
      const result = await action(trimmed).catch((): AdminActionResult => ({ ok: false, error: "server" }));
      if (!result.ok) {
        setError(t(`errors.${result.error}`, { min: REMOVAL_REASON_MIN, max: REMOVAL_REASON_MAX }));
        return;
      }
      setOpen(false);
      setReason("");
      router.refresh();
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        setError(null);
      }}
    >
      <DialogTrigger render={<Button size="sm" variant="destructive" />}>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("posts.removeTitle", { name: postName })}</DialogTitle>
          <DialogDescription>{t("posts.removeHint")}</DialogDescription>
        </DialogHeader>
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
          className="flex flex-col gap-2"
        >
          <Label htmlFor="removal-reason">
            {t("posts.reason")}
            <span className="text-red-500">*</span>
          </Label>
          <Textarea
            id="removal-reason"
            value={reason}
            aria-invalid={!!error || undefined}
            onChange={(e) => {
              setReason(e.target.value);
              setError(null);
            }}
            className="min-h-24"
          />
          <div className="flex justify-between gap-3 text-xs">
            <span role="alert" className="text-destructive">
              {error}
            </span>
            <span className="text-muted-foreground tabular-nums">
              {reason.trim().length}/{REMOVAL_REASON_MAX}
            </span>
          </div>
          <DialogFooter>
            <Button type="submit" variant="destructive" disabled={pending}>
              {pending && <Loader2 className="animate-spin" />}
              {t("posts.remove")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export type FilterOption = { value: string; label: string };
const ANY = "any";

/** Search field and filters of an admin list, written to the URL. */
export function AdminFilterBar({
  search,
  searchPlaceholder,
  filters = [],
}: {
  search?: string;
  searchPlaceholder?: string;
  filters?: { name: string; value: string; label: string; options: FilterOption[] }[];
}) {
  const t = useTranslations("admin.common");
  const router = useRouter();
  const pathname = usePathname();
  const [q, setQ] = useState(search ?? "");
  const [pending, startTransition] = useTransition();

  const push = (next: Record<string, string>) => {
    const current = Object.fromEntries(filters.map((f) => [f.name, f.value]));
    const merged = { ...(search !== undefined && { q }), ...current, ...next };
    startTransition(() => router.push({ pathname, query: Object.fromEntries(Object.entries(merged).filter(([, v]) => v !== "")) }));
  };

  return (
    <form
      className="flex flex-wrap items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        push({ q });
      }}
    >
      {search !== undefined && (
        <>
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={searchPlaceholder} aria-label={searchPlaceholder} className="w-64" maxLength={100} />
          <Button type="submit" variant="outline" size="sm" disabled={pending}>
            {pending && <Loader2 className="animate-spin" />}
            {t("search")}
          </Button>
        </>
      )}
      {filters.map((filter) => (
        <Select
          key={filter.name}
          items={Object.fromEntries(filter.options.map((o) => [o.value || ANY, o.label]))}
          value={filter.value || ANY}
          onValueChange={(v) => push({ [filter.name]: v && v !== ANY ? String(v) : "" })}
        >
          <SelectTrigger aria-label={filter.label} className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {filter.options.map((o) => (
              <SelectItem key={o.value || ANY} value={o.value || ANY}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ))}
    </form>
  );
}
