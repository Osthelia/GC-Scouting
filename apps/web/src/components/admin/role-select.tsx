/**
 * GC-Scouting - role-select
 *
 * Select that changes the role of a user.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Check, Loader2 } from "lucide-react";
import { USER_ROLES, type UserRole } from "@scouting/db/constants";
import { useRouter } from "@/i18n/navigation";
import { setUserRole, type AdminActionResult } from "@/actions/admin";
import { Button } from "@/components/admin/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/admin/ui/select";

/** Role of an account, changed by an admin. */
export function RoleSelect({ userId, role, disabled }: { userId: string; role: UserRole; disabled?: boolean }) {
  const t = useTranslations("admin");
  const router = useRouter();
  const [value, setValue] = useState<UserRole>(role);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  const save = () =>
    startTransition(async () => {
      setError(null);
      setSaved(false);
      const result = await setUserRole(userId, value).catch((): AdminActionResult => ({ ok: false, error: "server" }));
      if (result.ok) {
        setSaved(true);
        router.refresh();
      } else setError(t(`errors.${result.error}`));
    });

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <Select
          items={Object.fromEntries(USER_ROLES.map((r) => [r, t(`roles.${r}`)]))}
          value={value}
          disabled={disabled || pending}
          onValueChange={(v) => {
            if (v) setValue(v as UserRole);
            setSaved(false);
          }}
        >
          <SelectTrigger aria-label={t("access.role")} className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {USER_ROLES.map((r) => (
              <SelectItem key={r} value={r}>
                {t(`roles.${r}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button size="sm" variant="outline" disabled={disabled || pending || value === role} onClick={save}>
          {pending ? <Loader2 className="animate-spin" /> : saved && <Check />}
          {t("access.save")}
        </Button>
      </div>
      {error && (
        <span role="alert" className="text-xs text-destructive">
          {error}
        </span>
      )}
    </div>
  );
}
