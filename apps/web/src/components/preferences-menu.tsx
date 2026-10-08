/**
 * GC-Scouting - preferences-menu
 *
 * Menu for the theme, language and timezone preferences.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { MonitorIcon, MoonIcon, Settings2Icon, SunIcon } from "lucide-react";
import { Select, type SelectOption } from "@/components/ui/select";
import { useTimezoneOptions } from "@/components/post-form/availability-editor";
import { applyTheme, browserTimezone, setTimezonePreference, useTimezonePreference } from "@/lib/preferences";
import { THEMES, type ThemePreference } from "@/lib/theme";
import { cn } from "@/lib/utils";

const THEME_ICONS: Record<ThemePreference, ReactNode> = {
  system: <MonitorIcon className="h-3.5 w-3.5" />,
  light: <SunIcon className="h-3.5 w-3.5" />,
  dark: <MoonIcon className="h-3.5 w-3.5" />,
};

/** Theme and timezone of the visitor. `inline` renders the panel directly (mobile menu). */
export function PreferencesMenu({ theme: initialTheme, inline }: { theme: ThemePreference; inline?: boolean }) {
  const t = useTranslations("preferences");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const onClick = (e: MouseEvent) => {
      if (!(e.target as Element).closest?.("[data-preferences]")) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("click", onClick);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("click", onClick);
    };
  }, [open]);

  if (inline) return <PreferencesPanel initialTheme={initialTheme} />;

  return (
    <div className="relative flex-none" data-preferences>
      <button
        type="button"
        aria-label={t("title")}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex h-[38px] w-[38px] items-center justify-center rounded-[10px] border border-neutral-800 bg-[var(--sc-surface)] text-neutral-300 transition-all hover:bg-[var(--sc-hover)] hover:text-neutral-50 active:scale-[0.95]"
      >
        <Settings2Icon className="h-[17px] w-[17px]" />
      </button>
      {open && (
        <div className="absolute top-[46px] right-0 z-[70] w-[300px] rounded-xl border border-neutral-800 bg-[var(--sc-surface-3)] p-3 shadow-[0_20px_48px_rgba(0,0,0,.35)]">
          <PreferencesPanel initialTheme={initialTheme} />
        </div>
      )}
    </div>
  );
}

function PreferencesPanel({ initialTheme }: { initialTheme: ThemePreference }) {
  const t = useTranslations("preferences");
  const [theme, setTheme] = useState(initialTheme);
  const timezone = useTimezonePreference();
  const zones = useTimezoneOptions(timezone);
  const [detected, setDetected] = useState("");

  // The browser timezone is only known on the client.
  useEffect(() => setDetected(browserTimezone()), []);

  const timezoneOptions: SelectOption<string>[] = [{ value: "", label: t("timezoneAuto", { timezone: detected.replace(/_/g, " ") }) }, ...zones];

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="mb-1.5 text-[11px] font-semibold tracking-[0.12em] text-neutral-500 uppercase">{t("theme")}</p>
        <div role="radiogroup" aria-label={t("theme")} className="grid grid-cols-3 rounded-[10px] border border-neutral-800 bg-[var(--sc-surface-2)] p-0.5">
          {THEMES.map((value) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={theme === value}
              onClick={() => {
                setTheme(value);
                applyTheme(value);
              }}
              className={cn(
                "inline-flex h-[30px] items-center justify-center gap-1.5 rounded-lg text-[12.5px] font-semibold transition-all active:scale-[0.96]",
                theme === value ? "bg-[var(--sc-hover-2)] text-neutral-50" : "text-neutral-500 hover:text-neutral-200"
              )}
            >
              {THEME_ICONS[value]}
              {t(`themes.${value}`)}
            </button>
          ))}
        </div>
      </div>
      <div>
        <p className="mb-1.5 text-[11px] font-semibold tracking-[0.12em] text-neutral-500 uppercase">{t("timezone")}</p>
        <Select
          searchable
          align="end"
          label={t("timezone")}
          searchPlaceholder={t("search")}
          emptyLabel={t("noOption")}
          value={timezone}
          onChange={setTimezonePreference}
          options={timezoneOptions}
        />
        <p className="mt-1.5 text-[12px] leading-snug text-neutral-500">{t("timezoneHint")}</p>
      </div>
    </div>
  );
}
