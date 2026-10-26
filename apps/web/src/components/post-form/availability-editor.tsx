/**
 * GC-Scouting - availability-editor
 *
 * Weekly availability editor with drag selection.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

"use client";

import { useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import { CopyIcon, EraserIcon } from "lucide-react";
import { AVAILABILITY_STEP_MINUTES } from "@scouting/db/constants";
import { slotsToRanges, timezoneOffset, type AvailabilitySlot } from "@scouting/db/derived";
import { Select, type SelectOption } from "@/components/ui/select";
import { formatTime, useWeekdayNames } from "@/components/post/availability-week";
import { cn } from "@/lib/utils";

const DAY = 1440;
const STEP = AVAILABILITY_STEP_MINUTES;
const CELLS = DAY / STEP;
const HOURS = Array.from({ length: 25 }, (_, h) => h);
const DAYS = [0, 1, 2, 3, 4, 5, 6];
const NARROW = "(max-width: 639px)";

type Grid = boolean[][];
type Cell = { day: number; cell: number };
type Drag = { fill: boolean; from: Cell; to: Cell };

function formatOffset(minutes: number): string {
  const sign = minutes < 0 ? "-" : "+";
  return `UTC${sign}${formatTime(Math.abs(minutes))}`;
}

/** Timezones known by the browser, with their current UTC offset. */
export function useTimezoneOptions(current: string): SelectOption<string>[] {
  return useMemo(() => {
    const zones = typeof Intl.supportedValuesOf === "function" ? Intl.supportedValuesOf("timeZone") : [];
    const list = zones.includes(current) || !current ? zones : [current, ...zones];
    return list.map((zone) => ({ value: zone, label: `${zone.replace(/_/g, " ")} (${formatOffset(timezoneOffset(zone))})` }));
  }, [current]);
}

/** Below `sm`, the grid turns vertical: days as columns, hours going down. */
function useIsNarrow(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const query = window.matchMedia(NARROW);
      query.addEventListener("change", onChange);
      return () => query.removeEventListener("change", onChange);
    },
    () => window.matchMedia(NARROW).matches,
    () => false
  );
}

function toGrid(slots: AvailabilitySlot[]): Grid {
  const grid: Grid = Array.from({ length: 7 }, () => Array<boolean>(CELLS).fill(false));
  for (const s of slots) for (let c = Math.floor(s.start / STEP); c < Math.ceil(s.end / STEP); c++) grid[s.day]![c] = true;
  return grid;
}

/** Runs of filled cells, as [start, end] minutes. */
function runs(row: boolean[]): [number, number][] {
  const out: [number, number][] = [];
  row.forEach((on, c) => {
    if (!on) return;
    const last = out.at(-1);
    if (last && last[1] === c * STEP) last[1] += STEP;
    else out.push([c * STEP, (c + 1) * STEP]);
  });
  return out;
}

function toSlots(grid: Grid): AvailabilitySlot[] {
  return grid.flatMap((row, day) => runs(row).map(([start, end]) => ({ day, start, end })));
}

function applyDrag(grid: Grid, drag: Drag | null): Grid {
  if (!drag) return grid;
  const [d1, d2] = [Math.min(drag.from.day, drag.to.day), Math.max(drag.from.day, drag.to.day)];
  const [c1, c2] = [Math.min(drag.from.cell, drag.to.cell), Math.max(drag.from.cell, drag.to.cell)];
  return grid.map((row, day) => (day < d1 || day > d2 ? row : row.map((on, c) => (c >= c1 && c <= c2 ? drag.fill : on))));
}

/** Readable ranges of a day, a session running past midnight is shown whole with "+1". */
function dayLabels(rows: [number, number][][], day: number): string[] {
  const prev = rows[(day + 6) % 7]!;
  const next = rows[(day + 1) % 7]!;
  return rows[day]!.flatMap(([s, e]) => {
    if (s === 0 && e < DAY && prev.at(-1)?.[1] === DAY) return [];
    const carry = next[0];
    if (e === DAY && carry && carry[0] === 0 && carry[1] < DAY) return [`${formatTime(s)} - ${formatTime(carry[1])} (+1)`];
    return [`${formatTime(s)} - ${formatTime(e)}`];
  });
}

/** Weekly availability painted on the same grid as the post page, in the author's timezone. */
export function AvailabilityEditor({ value, onChange, invalid }: { value: AvailabilitySlot[]; onChange: (value: AvailabilitySlot[]) => void; invalid?: boolean }) {
  const t = useTranslations("newPost.availability");
  const dayNames = useWeekdayNames("short");
  const vertical = useIsNarrow();
  const bars = useRef<(HTMLDivElement | null)[]>([]);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [hover, setHover] = useState<Cell | null>(null);

  const grid = useMemo(() => toGrid(value), [value]);
  const shown = useMemo(() => applyDrag(grid, drag), [grid, drag]);
  const rows = useMemo(() => shown.map(runs), [shown]);
  const weeklyMinutes = slotsToRanges(value).reduce((sum, [s, e]) => sum + e - s, 0);
  const activeDays = grid.filter((row) => row.some(Boolean)).length;

  /** Cell under the pointer, clamped to the grid so a drag can leave it. */
  const cellAt = (x: number, y: number): Cell | null => {
    const rects = bars.current.map((el) => el?.getBoundingClientRect());
    if (rects.some((r) => !r)) return null;
    const first = rects[0]!;
    let day = rects.findIndex((r) => (vertical ? x < r!.right + 2 : y < r!.bottom + 3));
    if (day === -1) day = 6;
    const ratio = vertical ? (y - first.top) / first.height : (x - first.left) / first.width;
    return { day, cell: Math.min(CELLS - 1, Math.max(0, Math.floor(ratio * CELLS))) };
  };

  /** Position of a part of the day along the bar. */
  const place = (start: number, length: number): React.CSSProperties =>
    vertical
      ? { top: `${(start / DAY) * 100}%`, height: `${(length / DAY) * 100}%` }
      : { left: `${(start / DAY) * 100}%`, width: `${(length / DAY) * 100}%` };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const at = cellAt(e.clientX, e.clientY);
    if (!at) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setDrag({ fill: !grid[at.day]![at.cell], from: at, to: at });
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const at = cellAt(e.clientX, e.clientY);
    if (drag && at && (at.day !== drag.to.day || at.cell !== drag.to.cell)) setDrag({ ...drag, to: at });
    if (!drag && e.pointerType === "mouse") setHover(at);
  };

  const commit = () => {
    if (!drag) return;
    onChange(toSlots(shown));
    setDrag(null);
  };

  const setRow = (days: number[], row: boolean[]) => onChange(toSlots(grid.map((r, d) => (days.includes(d) ? [...row] : r))));
  const empty = Array<boolean>(CELLS).fill(false);

  const bar = (day: number) => {
    const ranges = rows[day]!;
    const hovered = hover?.day === day && !drag ? hover.cell : null;
    const selecting = drag && day >= Math.min(drag.from.day, drag.to.day) && day <= Math.max(drag.from.day, drag.to.day);
    const across = vertical ? "inset-x-0" : "inset-y-0";
    return (
      <div
        key={`bar-${day}`}
        ref={(el) => {
          bars.current[day] = el;
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={commit}
        onPointerCancel={() => setDrag(null)}
        onPointerLeave={() => setHover(null)}
        className={cn("relative cursor-pointer touch-none select-none overflow-hidden rounded-md bg-[var(--sc-surface)]", vertical ? "h-[432px]" : "h-8")}
      >
        {HOURS.slice(1, -1).map((h) => (
          <span
            key={h}
            className={cn("pointer-events-none absolute", across, vertical ? "h-px" : "w-px", h % 6 === 0 ? "bg-neutral-700/80" : "bg-neutral-800/60")}
            style={vertical ? { top: `${(h / 24) * 100}%` } : { left: `${(h / 24) * 100}%` }}
          />
        ))}
        {hovered !== null && <span className={cn("pointer-events-none absolute bg-[var(--sc-hover-2)]", across)} style={place(hovered * STEP, STEP)} />}
        {ranges.map(([s, e]) => (
          <span
            key={s}
            className={cn(
              "pointer-events-none absolute rounded transition-colors",
              vertical ? "inset-x-1" : "inset-y-1",
              selecting && drag.fill ? "bg-[var(--sc-accent)]" : "bg-[var(--sc-accent)]/80"
            )}
            style={place(s, e - s)}
          />
        ))}
        {selecting && !drag.fill && (
          <span
            className={cn("pointer-events-none absolute bg-red-500/25 ring-1 ring-inset ring-red-400/60", across)}
            style={place(Math.min(drag.from.cell, drag.to.cell) * STEP, (Math.abs(drag.to.cell - drag.from.cell) + 1) * STEP)}
          />
        )}
      </div>
    );
  };

  /** Readable ranges of the day and its actions. */
  const details = (day: number) => {
    const labels = dayLabels(rows, day);
    const filled = rows[day]!.length > 0;
    return (
      <div className="flex min-w-0 items-center gap-1.5">
        <span className="min-w-0 flex-1 truncate text-[12px] text-neutral-500 tabular-nums" title={labels.join(", ")}>
          {labels.length ? labels.join(", ") : filled ? "" : "-"}
        </span>
        {filled && (
          <>
            <IconButton label={t("copyAll")} onClick={() => setRow(DAYS, grid[day]!)}>
              <CopyIcon className="h-3.5 w-3.5" />
            </IconButton>
            <IconButton label={t("clearDay")} danger onClick={() => setRow([day], empty)}>
              <EraserIcon className="h-3.5 w-3.5" />
            </IconButton>
          </>
        )}
      </div>
    );
  };

  const dayLabel = (day: number, className?: string) => (
    <span key={`label-${day}`} className={cn("text-[12.5px] font-semibold capitalize", rows[day]!.length ? "text-neutral-200" : "text-neutral-600", className)}>
      {dayNames[day]}
    </span>
  );

  return (
    <div>
      <p className="mb-3 text-[12.5px] text-neutral-500">{t("hint")}</p>
      <div className={cn("rounded-xl border bg-[var(--sc-surface-2)] p-3 sm:p-4", invalid ? "border-red-500/70" : "border-neutral-800")}>
        {vertical ? (
          <>
            <div className="grid grid-cols-[30px_repeat(7,minmax(0,1fr))] gap-x-1 gap-y-1.5">
              <span />
              {DAYS.map((day) => dayLabel(day, "truncate text-center text-[11.5px]"))}
              <div className="relative text-[10.5px] text-neutral-600">
                {HOURS.filter((h) => h % 3 === 0).map((h) => (
                  <span
                    key={h}
                    className={cn("absolute right-0 tabular-nums", h === 0 ? "" : h === 24 ? "-translate-y-full" : "-translate-y-1/2")}
                    style={{ top: `${(h / 24) * 100}%` }}
                  >
                    {h}h
                  </span>
                ))}
              </div>
              {DAYS.map(bar)}
            </div>
            {rows.some((r) => r.length) && (
              <div className="mt-3 flex flex-col gap-1 border-t border-neutral-800/80 pt-3">
                {DAYS.filter((day) => rows[day]!.length).map((day) => (
                  <div key={day} className="grid grid-cols-[44px_minmax(0,1fr)] items-center gap-x-2">
                    {dayLabel(day)}
                    {details(day)}
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="grid grid-cols-[44px_minmax(0,1fr)_minmax(0,190px)] gap-x-3 gap-y-1.5">
            <span />
            <div className="relative h-4 text-[11px] text-neutral-600">
              {HOURS.filter((h) => h % 3 === 0).map((h) => (
                <span key={h} className={cn("absolute tabular-nums", h === 0 ? "" : h === 24 ? "-translate-x-full" : "-translate-x-1/2")} style={{ left: `${(h / 24) * 100}%` }}>
                  {h}h
                </span>
              ))}
            </div>
            <span />
            {DAYS.map((day) => (
              <div key={day} className="contents">
                {dayLabel(day, "self-center")}
                {bar(day)}
                {details(day)}
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="mt-2 flex items-center justify-between gap-3">
        <p className="text-[12.5px] text-neutral-500">{t("summary", { hours: Math.round((weeklyMinutes / 60) * 10) / 10, days: activeDays })}</p>
        {value.length > 0 && (
          <button
            type="button"
            onClick={() => onChange([])}
            className="rounded-lg px-2 py-1 text-[12.5px] font-semibold text-neutral-500 transition-all hover:bg-[var(--sc-hover)] hover:text-red-400 active:scale-[0.95]"
          >
            {t("clearAll")}
          </button>
        )}
      </div>
    </div>
  );
}

function IconButton({ label, onClick, danger, children }: { label: string; onClick: () => void; danger?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={cn(
        "flex h-[26px] w-[26px] flex-none items-center justify-center rounded-md text-neutral-500 transition-all hover:bg-[var(--sc-hover)] active:scale-[0.88]",
        danger ? "hover:text-red-400" : "hover:text-neutral-100"
      )}
    >
      {children}
    </button>
  );
}
