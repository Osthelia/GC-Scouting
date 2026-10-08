/**
 * GC-Scouting - availability-week
 *
 * Read only weekly availability chart.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

"use client";

import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { formatTime, shiftRanges, slotsToRanges, slotsToUtc, timezoneOffset, type AvailabilitySlot, type WeekRange } from "@scouting/db/derived";
import { useViewerTimezone } from "@/lib/preferences";
import { cn } from "@/lib/utils";

const DAY = 1440;
const TICKS = [0, 6, 12, 18, 24];

export { formatTime };

/** Week ranges cut at midnight, one list per day (0 = Monday). */
function byDay(ranges: WeekRange[]): [number, number][][] {
  const days: [number, number][][] = Array.from({ length: 7 }, () => []);
  for (const [s, e] of ranges) {
    for (let day = Math.floor(s / DAY); day * DAY < e && day < 7; day++) {
      days[day]!.push([Math.max(s, day * DAY) - day * DAY, Math.min(e, (day + 1) * DAY) - day * DAY]);
    }
  }
  return days;
}

/** Weekday names of the current locale, Monday first. */
export function useWeekdayNames(width: "short" | "long"): string[] {
  const locale = useLocale();
  return useMemo(() => {
    const format = new Intl.DateTimeFormat(locale, { weekday: width, timeZone: "UTC" });
    // 2024-01-01 is a Monday.
    return Array.from({ length: 7 }, (_, i) => format.format(new Date(Date.UTC(2024, 0, 1 + i))));
  }, [locale, width]);
}

/** Weekly availability grid, in the author's timezone or converted to the visitor's. */
export function AvailabilityWeek({ slots, timezone }: { slots: AvailabilitySlot[]; timezone: string }) {
  const t = useTranslations("postPage");
  // Only known in the browser, the grid starts in the author's timezone to match the server render.
  const preferredTz = useViewerTimezone();
  const viewerTz = preferredTz && timezoneOffset(preferredTz) !== timezoneOffset(timezone) ? preferredTz : null;
  const [mode, setMode] = useState<"viewer" | "author">("viewer");

  const shownTz = viewerTz && mode === "viewer" ? viewerTz : timezone;
  const days = useMemo(() => {
    const ranges = shownTz === timezone ? slotsToRanges(slots) : shiftRanges(slotsToUtc(slots, timezone), timezoneOffset(shownTz));
    return byDay(ranges);
  }, [slots, timezone, shownTz]);

  const dayNames = useWeekdayNames("short");

  if (slots.length === 0) return <p className="text-[13.5px] text-neutral-500">{t("noAvailability")}</p>;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {viewerTz && (
          <div role="radiogroup" className="inline-flex rounded-[10px] border border-neutral-800 bg-[var(--sc-surface-2)] p-0.5">
            {(["viewer", "author"] as const).map((value) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={mode === value}
                onClick={() => setMode(value)}
                className={cn(
                  "h-[30px] rounded-lg px-3 text-[12.5px] font-semibold transition-all active:scale-[0.96]",
                  mode === value ? "bg-[var(--sc-hover-2)] text-neutral-50" : "text-neutral-500 hover:text-neutral-200"
                )}
              >
                {t(value === "viewer" ? "yourTime" : "authorTime")}
              </button>
            ))}
          </div>
        )}
        <span className="text-[12.5px] text-neutral-500">{t("timezoneNote", { timezone: shownTz.replace(/_/g, " ") })}</span>
      </div>

      <div className="grid grid-cols-[44px_minmax(0,1fr)] gap-x-3 gap-y-1.5 sm:grid-cols-[48px_minmax(0,1fr)_132px]">
        <span />
        <div className="relative h-4 text-[11px] text-neutral-600">
          {TICKS.map((h) => (
            <span key={h} className={cn("absolute", h === 0 ? "" : h === 24 ? "-translate-x-full" : "-translate-x-1/2")} style={{ left: `${(h / 24) * 100}%` }}>
              {h}h
            </span>
          ))}
        </div>
        <span className="hidden sm:block" />

        {days.map((ranges, day) => (
          <div key={day} className="contents">
            <span className={cn("self-center text-[12.5px] font-semibold capitalize", ranges.length ? "text-neutral-200" : "text-neutral-600")}>{dayNames[day]}</span>
            <div className="relative h-7 overflow-hidden rounded-md bg-[var(--sc-surface-2)]">
              {TICKS.slice(1, -1).map((h) => (
                <span key={h} className="absolute inset-y-0 w-px bg-neutral-800/70" style={{ left: `${(h / 24) * 100}%` }} />
              ))}
              {ranges.map(([s, e]) => (
                <span
                  key={s}
                  title={`${formatTime(s)} - ${formatTime(e)}`}
                  className="absolute inset-y-1 rounded bg-[var(--sc-accent)]/80"
                  style={{ left: `${(s / DAY) * 100}%`, width: `${((e - s) / DAY) * 100}%` }}
                />
              ))}
            </div>
            <span className={cn("col-start-2 -mt-1 mb-1 text-[11.5px] text-neutral-500 tabular-nums sm:col-start-auto sm:m-0 sm:block sm:self-center sm:text-[12px]", !ranges.length && "hidden")}>
              {ranges.length ? ranges.map(([s, e]) => `${formatTime(s)} - ${formatTime(e)}`).join(", ") : "-"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
