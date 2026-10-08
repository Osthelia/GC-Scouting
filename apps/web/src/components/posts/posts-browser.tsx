/**
 * GC-Scouting - posts-browser
 *
 * Post list with filters, active filter chips and paging.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { POST_SORTS, type PostType, type Region } from "@scouting/db/constants";
import { comparePosts, countActiveFilters, matchesFilters, type PostFilters } from "@scouting/db/filters";
import type { PostCardView } from "@/lib/posts";
import { RANKS } from "@/lib/ranks";
import { AGENTS_BY_SLUG } from "@/lib/agents";
import { usePostFilters } from "@/lib/use-post-filters";
import { PostCard } from "@/components/post/post-card";
import { Select } from "@/components/ui/select";
import { formatTime } from "@scouting/db/derived";
import { useWeekdayNames } from "@/components/post/availability-week";
import { useDurationLabel } from "@/components/post/experience";
import { PostsFilters, useLanguageName } from "./posts-filters";

export function PostsBrowser({ type, posts, defaultRegion }: { type: PostType; posts: PostCardView[]; defaultRegion: Region | null }) {
  const t = useTranslations("posts");
  const { filters, sort, setFilters, setSort, reset } = usePostFilters(type, defaultRegion);
  const [sheetOpen, setSheetOpen] = useState(false);
  const closeSheet = useCallback(() => setSheetOpen(false), []);

  const results = useMemo(() => posts.filter((p) => matchesFilters(p, filters)).sort(comparePosts<PostCardView>(sort)), [posts, filters, sort]);
  const activeCount = countActiveFilters(filters);
  const sortOptions = POST_SORTS.map((s) => ({ value: s, label: t(`sort.${s}`) }));

  return (
    <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)] lg:gap-8">
      <aside className="hidden lg:block">
        <div className="rounded-xl border border-neutral-800 bg-[var(--sc-surface-2)] p-4">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-[15px] font-semibold tracking-tight text-neutral-50">{t("filters")}</h2>
            {activeCount > 0 && <ResetButton onClick={reset} label={t("reset")} />}
          </div>
          <PostsFilters type={type} filters={filters} onChange={setFilters} />
        </div>
      </aside>

      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setSheetOpen(true)}
            className="flex h-[38px] items-center gap-2 rounded-[10px] border border-neutral-800 bg-[var(--sc-surface)] px-3 text-[13.5px] font-semibold text-neutral-200 transition-all hover:bg-[var(--sc-hover)] active:scale-[0.97] lg:hidden"
          >
            <FilterIcon />
            {t("filters")}
            {activeCount > 0 && <CountBubble count={activeCount} />}
          </button>
          <Select label={t("sortLabel")} value={sort} onChange={setSort} options={sortOptions} align="end" className="min-w-0 flex-1 sm:ml-auto sm:w-[200px] sm:flex-none" />
        </div>

        <ActiveFilters type={type} filters={filters} onChange={setFilters} onReset={reset} />

        <p className="mt-4 mb-3 text-[13px] font-medium text-neutral-500" aria-live="polite">
          {t("count", { count: results.length })}
        </p>

        {results.length > 0 ? (
          <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
            {results.map((post) => (
              <PostCard key={post.id} post={post} />
            ))}
          </div>
        ) : (
          <EmptyState onReset={activeCount > 0 ? reset : undefined} />
        )}
      </div>

      {sheetOpen && (
        <FilterSheet title={t("filters")} closeLabel={t("close")} onClose={closeSheet}>
          <div className="flex-1 overflow-y-auto px-4 py-5">
            <PostsFilters type={type} filters={filters} onChange={setFilters} />
          </div>
          <div className="flex gap-2 border-t border-neutral-800 p-4">
            <button
              type="button"
              onClick={reset}
              disabled={activeCount === 0}
              className="h-11 rounded-[11px] border border-neutral-800 bg-[var(--sc-surface)] px-4 text-[14px] font-semibold text-neutral-300 transition-all active:scale-[0.97] disabled:opacity-40"
            >
              {t("reset")}
            </button>
            <button
              type="button"
              onClick={closeSheet}
              className="h-11 flex-1 rounded-[11px] bg-[var(--sc-accent)] text-[14px] font-bold text-[var(--sc-accent-ink)] transition-all hover:brightness-110 active:scale-[0.97]"
            >
              {t("apply")} ({results.length})
            </button>
          </div>
        </FilterSheet>
      )}
    </div>
  );
}

/** One removable chip per active filter value. */
function ActiveFilters({
  type,
  filters,
  onChange,
  onReset,
}: {
  type: PostType;
  filters: PostFilters;
  onChange: (patch: Partial<PostFilters>) => void;
  onReset: () => void;
}) {
  const t = useTranslations("posts");
  const tRoles = useTranslations("roles");
  const tIgl = useTranslations("igl");
  const tStaff = useTranslations("staffRoles");
  const tRegions = useTranslations("regions");
  const tLevels = useTranslations("levels");
  const tSpots = useTranslations("rosterSpots");
  const tCompensation = useTranslations("compensation");
  const tLan = useTranslations("lan");
  const tAge = useTranslations("ageGroups");
  const tMinors = useTranslations("minorsPolicy");
  const duration = useDurationLabel();
  const languageName = useLanguageName();
  const dayNames = useWeekdayNames("short");

  const chips: { key: string; label: string; remove: () => void }[] = [];
  const without = <T,>(list: readonly T[], value: T) => list.filter((v) => v !== value);

  filters.regions?.forEach((v) => chips.push({ key: `r-${v}`, label: tRegions(v), remove: () => onChange({ regions: without(filters.regions!, v) }) }));
  filters.languages?.forEach((v) => chips.push({ key: `l-${v}`, label: languageName(v), remove: () => onChange({ languages: without(filters.languages!, v) }) }));
  filters.roles?.forEach((v) => chips.push({ key: `ro-${v}`, label: tRoles(v), remove: () => onChange({ roles: without(filters.roles!, v) }) }));
  filters.igl?.forEach((v) => chips.push({ key: `i-${v}`, label: tIgl(v), remove: () => onChange({ igl: without(filters.igl!, v) }) }));
  filters.spots?.forEach((v) => chips.push({ key: `sp-${v}`, label: tSpots(v), remove: () => onChange({ spots: without(filters.spots!, v) }) }));
  filters.staffRoles?.forEach((v) => chips.push({ key: `s-${v}`, label: tStaff(v), remove: () => onChange({ staffRoles: without(filters.staffRoles!, v) }) }));
  if (filters.rankMin !== undefined || filters.rankMax !== undefined) {
    const from = RANKS[filters.rankMin ?? 0]!.label;
    const to = RANKS[filters.rankMax ?? RANKS.length - 1]!.label;
    chips.push({ key: "rank", label: from === to ? from : `${from} - ${to}`, remove: () => onChange({ rankMin: undefined, rankMax: undefined }) });
  }
  filters.agents?.forEach((v) => chips.push({ key: `a-${v}`, label: AGENTS_BY_SLUG[v]?.name ?? v, remove: () => onChange({ agents: without(filters.agents!, v) }) }));
  filters.compensation?.forEach((v) => chips.push({ key: `c-${v}`, label: tCompensation(v), remove: () => onChange({ compensation: without(filters.compensation!, v) }) }));
  filters.lan?.forEach((v) => chips.push({ key: `lan-${v}`, label: tLan(v), remove: () => onChange({ lan: without(filters.lan!, v) }) }));
  filters.ages?.forEach((v) =>
    chips.push({ key: `ag-${v}`, label: type === "lft" ? tAge(v) : tMinors(v === "minor" ? "accepted" : "adultsOnly"), remove: () => onChange({ ages: without(filters.ages!, v) }) }),
  );
  filters.levels?.forEach((v) => chips.push({ key: `lv-${v}`, label: tLevels(v), remove: () => onChange({ levels: without(filters.levels!, v) }) }));
  if (filters.minMonths) chips.push({ key: "months", label: t("minDuration", { duration: duration(filters.minMonths) }), remove: () => onChange({ minMonths: undefined }) });
  if (filters.minHours) chips.push({ key: "hours", label: t("minHours", { count: filters.minHours }), remove: () => onChange({ minHours: undefined }) });
  if (filters.minDays) chips.push({ key: "days", label: t("minDays", { count: filters.minDays }), remove: () => onChange({ minDays: undefined }) });
  if (filters.slot) {
    const { days, from, to } = filters.slot;
    const dayLabel = days.length ? days.map((d) => dayNames[d]).join(", ") : t("slot.everyDay");
    chips.push({ key: "slot", label: `${dayLabel}, ${formatTime(from)} - ${formatTime(to)}`, remove: () => onChange({ slot: undefined }) });
  }
  if (filters.week) {
    const label = filters.week.days.map((d) => `${dayNames[d.day]} ${formatTime(d.from)} - ${formatTime(d.to)}`).join(", ");
    chips.push({ key: "week", label, remove: () => onChange({ week: undefined }) });
  }

  if (chips.length === 0) return null;

  return (
    <div className="mt-3 flex flex-wrap items-center gap-1.5">
      {chips.map((chip) => (
        <button
          key={chip.key}
          type="button"
          onClick={chip.remove}
          aria-label={`${t("removeFilter")} : ${chip.label}`}
          className="inline-flex h-7 items-center gap-1.5 rounded-lg bg-[color-mix(in_oklab,var(--sc-accent)_14%,transparent)] pr-1.5 pl-2.5 text-[12.5px] font-semibold text-[var(--sc-accent)] transition-all hover:bg-[color-mix(in_oklab,var(--sc-accent)_22%,transparent)] active:scale-[0.95]"
        >
          {chip.label}
          <CloseIcon />
        </button>
      ))}
      {chips.length > 1 && <ResetButton onClick={onReset} label={t("resetAll")} />}
    </div>
  );
}

function ResetButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-md px-2 py-1 text-[12.5px] font-semibold text-neutral-400 transition-all hover:bg-[var(--sc-hover)] hover:text-neutral-100 active:scale-[0.96]"
    >
      {label}
    </button>
  );
}

function EmptyState({ onReset }: { onReset?: () => void }) {
  const t = useTranslations("posts");
  return (
    <div className="flex flex-col items-center rounded-xl border border-dashed border-neutral-800 px-6 py-14 text-center">
      <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--sc-surface)] text-neutral-500">
        <FilterIcon />
      </span>
      <p className="mt-4 text-[15px] font-semibold text-neutral-100">{t("empty")}</p>
      <p className="mt-1.5 max-w-sm text-[13.5px] text-neutral-500">{t("emptyHint")}</p>
      {onReset && (
        <button
          type="button"
          onClick={onReset}
          className="mt-5 h-10 rounded-[10px] border border-neutral-800 bg-[var(--sc-surface)] px-4 text-[13.5px] font-semibold text-neutral-200 transition-all hover:bg-[var(--sc-hover)] active:scale-[0.97]"
        >
          {t("resetAll")}
        </button>
      )}
    </div>
  );
}

/** Full screen filter panel below `lg`. */
function FilterSheet({ title, closeLabel, onClose, children }: { title: string; closeLabel: string; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return (
    <div role="dialog" aria-modal="true" aria-label={title} className="fixed inset-0 z-[80] flex flex-col bg-[var(--sc-bg)] lg:hidden">
      <div className="flex h-[62px] items-center justify-between border-b border-neutral-800 px-4">
        <h2 className="text-[16px] font-semibold tracking-tight text-neutral-50">{title}</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label={closeLabel}
          className="flex h-[38px] w-[38px] items-center justify-center rounded-[10px] border border-neutral-800 bg-[var(--sc-surface)] text-neutral-300 transition-all active:scale-[0.95]"
        >
          <CloseIcon />
        </button>
      </div>
      {children}
    </div>
  );
}

function CountBubble({ count }: { count: number }) {
  return <span className="flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[var(--sc-accent)] px-1 text-[10.5px] font-black text-[var(--sc-accent-ink)]">{count}</span>;
}

function FilterIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
      <path d="M4 6h16M7 12h10M11 18h2" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}
