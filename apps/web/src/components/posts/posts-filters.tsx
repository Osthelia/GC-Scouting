/**
 * GC-Scouting - posts-filters
 *
 * Filter panel of the post list.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

"use client";

import { useMemo, useState, type ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  AGENT_ROLES,
  AVAILABILITY_STEP_MINUTES,
  AGE_GROUPS,
  COMPENSATIONS,
  LAN_OPTIONS,
  EXPERIENCE_MONTHS,
  FILTER_AGENTS_MAX,
  FILTER_DAY_STEPS,
  FILTER_HOUR_STEPS,
  IGL_ROLES,
  LANGUAGES,
  REGIONS,
  ROSTER_SPOTS,
  STAFF_ROLES,
  TOURNAMENT_LEVELS,
  type PostType,
} from "@scouting/db/constants";
import type { PostFilters, SlotFilter, WeekFilter } from "@scouting/db/filters";
import { formatTime } from "@scouting/db/derived";
import { FILTER_GROUPS } from "@/lib/post-types";
import { RANKS } from "@/lib/ranks";
import { LanguageFlag } from "@/components/post/language-flags";
import { VALORANT_AGENTS } from "@/lib/agents";
import { MultiSelect, Select, type SelectOption } from "@/components/ui/select";
import { ToggleChip } from "@/components/ui/toggle-chip";
import { AgentIcon } from "@/components/post/agent-icon";
import { RankIcon } from "@/components/post/rank-icon";
import { useWeekdayNames } from "@/components/post/availability-week";
import { useDurationLabel } from "@/components/post/experience";
import { useViewerTimezone } from "@/lib/preferences";
import { cn } from "@/lib/utils";

const DAY = 1440;
const TIME_STEPS = Array.from({ length: DAY / AVAILABILITY_STEP_MINUTES + 1 }, (_, i) => i * AVAILABILITY_STEP_MINUTES);

export function useLanguageName() {
  const locale = useLocale();
  return useMemo(() => {
    const names = new Intl.DisplayNames([locale], { type: "language" });
    return (code: string) => {
      const name = names.of(code) ?? code;
      return name.charAt(0).toLocaleUpperCase(locale) + name.slice(1);
    };
  }, [locale]);
}

function toggle<T>(list: readonly T[] | undefined, value: T): T[] {
  const current = list ?? [];
  return current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
}

export function PostsFilters({ type, filters, onChange }: { type: PostType; filters: PostFilters; onChange: (patch: Partial<PostFilters>) => void }) {
  const t = useTranslations("posts");
  const tRoles = useTranslations("roles");
  const tIgl = useTranslations("igl");
  const tSpots = useTranslations("rosterSpots");
  const tStaff = useTranslations("staffRoles");
  const tRegions = useTranslations("regions");
  const tLevels = useTranslations("levels");
  const tCompensation = useTranslations("compensation");
  const tLan = useTranslations("lan");
  const tAge = useTranslations("ageGroups");
  const tMinors = useTranslations("minorsPolicy");
  const duration = useDurationLabel();
  const languageName = useLanguageName();
  const groups = FILTER_GROUPS[type];

  const common = {
    placeholder: t("any"),
    summary: (count: number) => t("selected", { count }),
    clearLabel: t("reset"),
    emptyLabel: t("noOption"),
    searchPlaceholder: t("search"),
  };

  const regionOptions = REGIONS.map((r) => ({ value: r, label: tRegions(r) }));
  const languageOptions = LANGUAGES.map((code) => ({ value: code, label: languageName(code), icon: <LanguageFlag code={code} /> })).sort((a, b) => a.label.localeCompare(b.label));
  const agentOptions = VALORANT_AGENTS.map((a) => ({ value: a.slug, label: a.name, icon: <AgentIcon slug={a.slug} size={20} className="rounded" /> }));

  const rankOptions: SelectOption<string>[] = [{ value: "", label: t("any") }, ...RANKS.map((r, i) => ({ value: String(i), label: r.label, icon: <RankIcon rank={r.key} size={18} /> }))];
  const durationOptions: SelectOption<string>[] = [{ value: "", label: t("any") }, ...EXPERIENCE_MONTHS.map((m) => ({ value: String(m), label: t("minDuration", { duration: duration(m) }) }))];
  const hourOptions = FILTER_HOUR_STEPS.map((n) => ({ value: String(n), label: t("minHours", { count: n }) }));
  const dayOptions = FILTER_DAY_STEPS.map((n) => ({ value: String(n), label: t("minDays", { count: n }) }));

  const setRank = (key: "rankMin" | "rankMax", value: string) => {
    const index = value === "" ? undefined : Number(value);
    const patch: Partial<PostFilters> = { [key]: index };
    // Keep the range valid by moving the other bound.
    if (index !== undefined) {
      if (key === "rankMin" && filters.rankMax !== undefined && filters.rankMax < index) patch.rankMax = index;
      if (key === "rankMax" && filters.rankMin !== undefined && filters.rankMin > index) patch.rankMin = index;
    }
    onChange(patch);
  };

  return (
    <div className="flex flex-col divide-y divide-neutral-800/70">
      <Section label={t("group.region")}>
        <MultiSelect {...common} label={t("group.region")} values={filters.regions ?? []} onChange={(regions) => onChange({ regions })} options={regionOptions} />
      </Section>

      <Section label={t("group.language")}>
        <MultiSelect {...common} searchable label={t("group.language")} values={filters.languages ?? []} onChange={(languages) => onChange({ languages })} options={languageOptions} />
      </Section>

      {groups.includes("spot") && (
        <Section label={t(type === "lft" ? "group.spot" : "group.spotWanted")}>
          <div className="flex flex-wrap gap-1.5">
            {ROSTER_SPOTS.map((spot) => (
              <ToggleChip key={spot} active={!!filters.spots?.includes(spot)} onClick={() => onChange({ spots: toggle(filters.spots, spot) })}>
                {tSpots(spot)}
              </ToggleChip>
            ))}
          </div>
        </Section>
      )}

      {groups.includes("role") && (
        <Section label={t("group.role")}>
          <div className="flex flex-wrap gap-1.5">
            {AGENT_ROLES.map((role) => (
              <ToggleChip key={role} active={!!filters.roles?.includes(role)} onClick={() => onChange({ roles: toggle(filters.roles, role) })}>
                {tRoles(role)}
              </ToggleChip>
            ))}
            {IGL_ROLES.map((role) => (
              <ToggleChip key={role} color="var(--sc-accent-2)" active={!!filters.igl?.includes(role)} onClick={() => onChange({ igl: toggle(filters.igl, role) })}>
                {tIgl(role)}
              </ToggleChip>
            ))}
          </div>
        </Section>
      )}

      {groups.includes("staffRole") && (
        <Section label={t("group.staffRole")}>
          <div className="flex flex-wrap gap-1.5">
            {STAFF_ROLES.map((role) => (
              <ToggleChip key={role} active={!!filters.staffRoles?.includes(role)} onClick={() => onChange({ staffRoles: toggle(filters.staffRoles, role) })}>
                {tStaff(role)}
              </ToggleChip>
            ))}
          </div>
        </Section>
      )}

      {groups.includes("compensation") && (
        <Section label={t("group.compensation")}>
          <div className="flex flex-wrap gap-1.5">
            {COMPENSATIONS.map((value) => (
              <ToggleChip key={value} active={!!filters.compensation?.includes(value)} onClick={() => onChange({ compensation: toggle(filters.compensation, value) })}>
                {tCompensation(value)}
              </ToggleChip>
            ))}
          </div>
        </Section>
      )}

      {groups.includes("lan") && (
        <Section label={t("group.lan")}>
          <div className="flex flex-wrap gap-1.5">
            {LAN_OPTIONS.map((value) => (
              <ToggleChip key={value} active={!!filters.lan?.includes(value)} onClick={() => onChange({ lan: toggle(filters.lan, value) })}>
                {tLan(value)}
              </ToggleChip>
            ))}
          </div>
        </Section>
      )}

      {groups.includes("age") && (
        <Section label={t("group.age")}>
          <div className="flex flex-wrap gap-1.5">
            {/* Adults are welcome on every team post: only "minors accepted" filters there. */}
            {(type === "lft" ? AGE_GROUPS : (["minor"] as const)).map((value) => (
              <ToggleChip key={value} active={!!filters.ages?.includes(value)} onClick={() => onChange({ ages: toggle(filters.ages, value) })}>
                {type === "lft" ? tAge(value) : tMinors("accepted")}
              </ToggleChip>
            ))}
          </div>
        </Section>
      )}

      {groups.includes("rank") && (
        <Section label={t("group.rank")}>
          <div className="grid grid-cols-2 gap-2">
            <LabeledField label={t("rankFrom")}>
              <Select label={`${t("group.rank")} ${t("rankFrom")}`} value={filters.rankMin === undefined ? "" : String(filters.rankMin)} onChange={(v) => setRank("rankMin", v)} options={rankOptions} />
            </LabeledField>
            <LabeledField label={t("rankTo")}>
              <Select
                align="end"
                label={`${t("group.rank")} ${t("rankTo")}`}
                value={filters.rankMax === undefined ? "" : String(filters.rankMax)}
                onChange={(v) => setRank("rankMax", v)}
                options={rankOptions}
              />
            </LabeledField>
          </div>
        </Section>
      )}

      {groups.includes("agents") && (
        <Section label={t("group.agents")} hint={t("agentsHint")}>
          <MultiSelect
            {...common}
            searchable
            label={t("group.agents")}
            values={filters.agents ?? []}
            onChange={(agents) => onChange({ agents })}
            options={agentOptions}
            max={FILTER_AGENTS_MAX}
            maxHint={t("agentsMax")}
          />
        </Section>
      )}

      {groups.includes("experience") && (
        <Section label={t("group.experience")} hint={t("experienceHint")}>
          <div className="flex flex-wrap gap-1.5">
            {TOURNAMENT_LEVELS.map((level) => (
              <ToggleChip key={level} active={!!filters.levels?.includes(level)} onClick={() => onChange({ levels: toggle(filters.levels, level) })}>
                {tLevels(level)}
              </ToggleChip>
            ))}
          </div>
          <div className="mt-2">
            <Select
              label={t("group.experience")}
              value={filters.minMonths === undefined ? "" : String(filters.minMonths)}
              onChange={(v) => onChange({ minMonths: v === "" ? undefined : Number(v) })}
              options={durationOptions}
            />
          </div>
        </Section>
      )}

      {groups.includes("availability") && (
        <Section label={t("group.rhythm")} hint={t("rhythmHint")}>
          <div className="grid grid-cols-2 gap-2">
            <LabeledField label={t("rhythmHours")}>
              <Select label={`${t("group.rhythm")} ${t("rhythmHours")}`} value={String(filters.minHours ?? 0)} onChange={(v) => onChange({ minHours: Number(v) || undefined })} options={hourOptions} />
            </LabeledField>
            <LabeledField label={t("rhythmDays")}>
              <Select
                align="end"
                label={`${t("group.rhythm")} ${t("rhythmDays")}`}
                value={String(filters.minDays ?? 0)}
                onChange={(v) => onChange({ minDays: Number(v) || undefined })}
                options={dayOptions}
              />
            </LabeledField>
          </div>
        </Section>
      )}

      {groups.includes("availability") && (
        <Section label={t("group.availability")}>
          <AvailabilityFilter slot={filters.slot} week={filters.week} onChange={onChange} />
        </Section>
      )}
    </div>
  );
}

type SlotPatch = { slot?: SlotFilter; week?: WeekFilter };

const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];
const DEFAULT_RANGE = { from: 18 * 60, to: 23 * 60 };

const timeOptions = (steps: number[]): SelectOption<string>[] => steps.map((m) => ({ value: String(m), label: formatTime(m) }));
const FROM_OPTIONS = timeOptions(TIME_STEPS.slice(0, -1));
/** "To" choices, every step but the start. */
const toOptions = (from: number) => timeOptions(TIME_STEPS.slice(1).filter((m) => m !== from));
/** Moves the end away when the start lands on it. */
const keepApart = (from: number, to: number) => (from === to ? Math.min(from + 120, DAY) : to);

/** Hours the visitor wants to play, in their timezone: same hours on some days, or day by day. A post matches with any common half hour. */
function AvailabilityFilter({ slot, week, onChange }: { slot: SlotFilter | undefined; week: WeekFilter | undefined; onChange: (patch: SlotPatch) => void }) {
  const t = useTranslations("posts");
  const viewerTz = useViewerTimezone();
  const [mode, setMode] = useState<"simple" | "advanced">(week ? "advanced" : "simple");
  const timezone = (week ?? slot)?.timezone ?? viewerTz ?? "UTC";

  // The current search is carried over to the other mode.
  const switchMode = (next: "simple" | "advanced") => {
    setMode(next);
    if (next === "advanced" && slot) {
      const days = slot.days.length ? slot.days : ALL_DAYS;
      onChange({ slot: undefined, week: { days: days.map((day) => ({ day, from: slot.from, to: slot.to })), timezone: slot.timezone } });
    }
    if (next === "simple" && week) {
      const first = week.days[0]!;
      onChange({ week: undefined, slot: { days: week.days.length === 7 ? [] : week.days.map((d) => d.day), from: first.from, to: first.to, timezone: week.timezone } });
    }
  };

  return (
    <div>
      <div role="radiogroup" aria-label={t("slot.mode")} className="mb-3 grid grid-cols-2 rounded-[10px] border border-neutral-800 bg-[var(--sc-surface-2)] p-0.5">
        {(["simple", "advanced"] as const).map((value) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={mode === value}
            onClick={() => switchMode(value)}
            className={cn(
              "h-[28px] rounded-lg text-[12.5px] font-semibold transition-all active:scale-[0.96]",
              mode === value ? "bg-[var(--sc-hover-2)] text-neutral-50" : "text-neutral-500 hover:text-neutral-200"
            )}
          >
            {t(`slot.${value}`)}
          </button>
        ))}
      </div>
      {mode === "simple" ? (
        <SimpleSlot slot={slot} timezone={timezone} onChange={(next) => onChange({ slot: next, week: undefined })} />
      ) : (
        <WeekSlots week={week} timezone={timezone} onChange={(next) => onChange({ week: next, slot: undefined })} />
      )}
      <p className="mt-1.5 text-[12px] leading-snug text-neutral-600">
        {slot || week ? t("slot.hintTimezone", { timezone: timezone.replace(/_/g, " ") }) : t(mode === "simple" ? "slot.hint" : "slot.hintAdvanced")}
      </p>
    </div>
  );
}

function SimpleSlot({ slot, timezone, onChange }: { slot: SlotFilter | undefined; timezone: string; onChange: (slot: SlotFilter | undefined) => void }) {
  const t = useTranslations("posts");
  const dayNames = useWeekdayNames("short");
  const days = slot?.days ?? [];
  const from = slot?.from ?? 0;
  const to = slot?.to ?? DAY;

  const update = (patch: Partial<SlotFilter>) => {
    const next = { days, from, to, timezone, ...patch };
    // A full day on every day filters nothing.
    const empty = next.days.length === 0 && next.from === 0 && next.to === DAY;
    onChange(empty || next.from === next.to ? undefined : next);
  };

  return (
    <div>
      <p className="mb-1.5 text-[12px] font-medium text-neutral-500">{t("slot.days")}</p>
      <div className="grid grid-cols-7 gap-1">
        {dayNames.map((name, day) => (
          <DayToggle key={day} active={days.includes(day)} onClick={() => update({ days: toggle(days, day).sort((a, b) => a - b) })}>
            {name.slice(0, 3)}
          </DayToggle>
        ))}
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <LabeledField label={t("slot.from")}>
          <Select label={t("slot.from")} value={String(from)} onChange={(v) => update({ from: Number(v), to: keepApart(Number(v), to) })} options={FROM_OPTIONS} />
        </LabeledField>
        <LabeledField label={t("slot.to")}>
          <Select align="end" label={t("slot.to")} value={String(to)} onChange={(v) => update({ to: Number(v) })} options={toOptions(from)} />
        </LabeledField>
      </div>
    </div>
  );
}

/** One range per searched day, days left off are not searched. */
function WeekSlots({ week, timezone, onChange }: { week: WeekFilter | undefined; timezone: string; onChange: (week: WeekFilter | undefined) => void }) {
  const t = useTranslations("posts");
  const dayNames = useWeekdayNames("short");
  const days = week?.days ?? [];

  const update = (next: WeekFilter["days"]) => onChange(next.length ? { days: [...next].sort((a, b) => a.day - b.day), timezone } : undefined);
  const setRange = (day: number, from: number, to: number) => update(days.map((d) => (d.day === day ? { day, from, to } : d)));
  // A new day starts with the hours of the last one picked.
  const addDay = (day: number) => {
    const last = days.at(-1);
    update([...days, { day, from: last?.from ?? DEFAULT_RANGE.from, to: last?.to ?? DEFAULT_RANGE.to }]);
  };

  return (
    <div className="flex flex-col gap-1.5">
      {dayNames.map((name, day) => {
        const entry = days.find((d) => d.day === day);
        return (
          <div key={day} className="grid grid-cols-[48px_minmax(0,1fr)_minmax(0,1fr)] items-center gap-1.5">
            <DayToggle active={!!entry} onClick={() => (entry ? update(days.filter((d) => d.day !== day)) : addDay(day))}>
              {name.slice(0, 3)}
            </DayToggle>
            {entry ? (
              <>
                <Select label={`${name} ${t("slot.from")}`} value={String(entry.from)} onChange={(v) => setRange(day, Number(v), keepApart(Number(v), entry.to))} options={FROM_OPTIONS} />
                <Select align="end" label={`${name} ${t("slot.to")}`} value={String(entry.to)} onChange={(v) => setRange(day, entry.from, Number(v))} options={toOptions(entry.from)} />
              </>
            ) : (
              <span className="col-span-2 text-[12px] text-neutral-600">{t("slot.notSearched")}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

function DayToggle({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={
        active
          ? "h-[30px] rounded-lg border border-[color-mix(in_oklab,var(--sc-accent)_45%,transparent)] bg-[color-mix(in_oklab,var(--sc-accent)_14%,transparent)] text-[11.5px] font-semibold text-[var(--sc-accent)] transition-all active:scale-[0.93]"
          : "h-[30px] rounded-lg border border-neutral-800 bg-[var(--sc-surface)] text-[11.5px] font-medium text-neutral-400 transition-all hover:bg-[var(--sc-hover)] hover:text-neutral-100 active:scale-[0.93]"
      }
    >
      {children}
    </button>
  );
}

function Section({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="py-4 first:pt-0 last:pb-0">
      <p className="mb-2 text-[11px] font-semibold tracking-[0.12em] text-neutral-500 uppercase">{label}</p>
      {children}
      {hint && <p className="mt-1.5 text-[12px] leading-snug text-neutral-600">{hint}</p>}
    </div>
  );
}

function LabeledField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className="mb-1 text-[12px] font-medium text-neutral-500">{label}</p>
      {children}
    </div>
  );
}
