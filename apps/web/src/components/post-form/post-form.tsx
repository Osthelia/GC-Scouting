/**
 * GC-Scouting - post-form
 *
 * Create and edit form of every post type, with server side error display.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

"use client";

import { useEffect, useState, useTransition, type ReactNode } from "react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { AlertTriangleIcon, BellIcon, BriefcaseIcon, Loader2Icon, MegaphoneIcon, MessageSquareIcon, Repeat2Icon, SaveIcon, SendIcon } from "lucide-react";
import {
  AGE_GROUPS,
  ACTIVE_POSTS_MAX,
  AGENT_ROLES,
  COMPENSATIONS,
  LAN_OPTIONS,
  EXPERIENCE_MONTHS,
  IGL_ROLES,
  LANGUAGES,
  PLAYERS_WANTED_MAX,
  REGIONS,
  RHYTHM_HOURS_MAX,
  ROSTER_SPOTS,
  STAFF_ROLES,
  SUBS_WANTED_MAX,
  TOURNAMENT_LEVELS,
  type PostType,
  type Region,
} from "@scouting/db/constants";
import { availabilityTotals } from "@scouting/db/derived";
import { TRACKER_URL_MAX } from "@scouting/db/tracker";
import { DISCORD_INVITE_MAX } from "@/lib/discord-contact";
import { createPost, updatePost, updatePostAsStaff, type PostFormError } from "@/actions/posts";
import { REMOVAL_REASON_MAX, REMOVAL_REASON_MIN } from "@/lib/admin/constants";
import { Link, useRouter } from "@/i18n/navigation";
import {
  AGENCY_MAX,
  AGENT_NAME_MAX,
  AVAILABILITY_REQUIRED,
  DESCRIPTION_MAX,
  DISPLAY_NAME_MAX,
  EMAIL_MAX,
  FORM_SECTIONS,
  GCS_TEAM_URL_MAX,
  LANGUAGES_MAX,
  SLOTS_PER_DAY_MAX,
  TEAM_TYPES,
  OFFER_TYPES,
  emptyPostForm,
  type FormSection,
  type PostField,
  type PostFieldErrors,
  type PostFormValues,
} from "@/lib/post-form";
import { COUNTRY_CODES } from "@/lib/countries";
import { RANKS } from "@/lib/ranks";
import { Field, TextArea, TextInput } from "@/components/ui/field";
import { MultiSelect, Select, type SelectOption } from "@/components/ui/select";
import { ToggleChip } from "@/components/ui/toggle-chip";
import { CheckRow } from "@/components/ui/check-row";
import { RadioCards } from "@/components/ui/radio-cards";
import { RankIcon } from "@/components/post/rank-icon";
import { LanguageFlag } from "@/components/post/language-flags";
import { useLanguageName } from "@/components/posts/posts-filters";
import { useDurationLabel } from "@/components/post/experience";
import { useViewerTimezone } from "@/lib/preferences";
import { TierListEditor } from "./tier-list-editor";
import { AvailabilityEditor, useTimezoneOptions } from "./availability-editor";
import { DiscordIdHelp } from "./discord-id-help";
import { cn } from "@/lib/utils";

export type PostFormAccount = {
  username: string;
  /** Posting for a managed profile: reminders go to its owner. */
  delegated: boolean;
  defaultRegion: Region | null;
  email: string | null;
  hasDiscord: boolean;
  /** Linked Discord account of the profile, prefills the contact. */
  discordId: string | null;
  notifyEmail: boolean;
  notifyDiscord: boolean;
  /** An expired post of this type will be closed when the new one is published. */
  replacesExpired: boolean;
};

const ERROR_LIMITS: Partial<Record<PostField, number>> = {
  displayName: DISPLAY_NAME_MAX,
  agentName: AGENT_NAME_MAX,
  agentAgency: AGENCY_MAX,
  description: DESCRIPTION_MAX,
  languages: LANGUAGES_MAX,
  availability: SLOTS_PER_DAY_MAX,
};

const PROFILE_SECTIONS: readonly FormSection[] = ["spot", "wanted", "age", "minors", "roles", "staffRoles", "compensation", "lan", "rank", "tracker", "rankRange", "experience"];

function toggle<T>(list: readonly T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

/**
 * New post, or edit of `edit.postId` prefilled with `edit.values`. `edit.tweeted` locks who tweets it.
 * `edit.moderation`: staff edit of someone else's post, a reason is asked and the author's reminders are hidden.
 */
export function PostForm({
  type,
  account,
  edit,
}: {
  type: PostType;
  account: PostFormAccount;
  edit?: { postId: number; tweeted: boolean; values: PostFormValues; moderation?: boolean };
}) {
  const t = useTranslations("newPost");
  const tFilters = useTranslations("posts");
  const tRegions = useTranslations("regions");
  const tRoles = useTranslations("roles");
  const tIgl = useTranslations("igl");
  const tSpots = useTranslations("rosterSpots");
  const tStaff = useTranslations("staffRoles");
  const tLevels = useTranslations("levels");
  const tCompensation = useTranslations("compensation");
  const tLan = useTranslations("lan");
  const tAge = useTranslations("ageGroups");
  const tMinors = useTranslations("minorsPolicy");
  const duration = useDurationLabel();
  const format = useFormatter();
  const locale = useLocale();
  const router = useRouter();
  const languageName = useLanguageName();
  const [pending, startTransition] = useTransition();

  const [values, setValues] = useState<PostFormValues>(() =>
    edit?.values ?? emptyPostForm(type, {
      displayName: account.username,
      region: account.defaultRegion ?? "",
      timezone: "",
      discordId: account.discordId,
      notifyEmail: account.notifyEmail,
      notifyDiscord: account.notifyDiscord,
    })
  );
  const [errors, setErrors] = useState<PostFieldErrors>({});
  const [formError, setFormError] = useState<{ code: PostFormError; existingId?: number; sanctionEndsAt?: string | null } | null>(null);
  const moderation = !!edit?.moderation;
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState<"length" | "invalidCharacters" | null>(null);

  // The visitor timezone is only known on the client.
  const viewerTz = useViewerTimezone();
  useEffect(() => {
    if (viewerTz) setValues((v) => (v.timezone ? v : { ...v, timezone: viewerTz }));
  }, [viewerTz]);

  const set = <K extends keyof PostFormValues>(key: K, value: PostFormValues[K]) => {
    setValues((v) => ({ ...v, [key]: value }));
    // Contact errors are cleared by any of its fields.
    const cleared =
      key === "discord" || key === "discordInvite" || key === "twitter" || key === "email" || key === "chatEnabled" ? ["contact", key] : key === "agent" ? ["agent", "agentName", "agentAgency"] : [key];
    setErrors((e) => (cleared.some((k) => k in e) ? Object.fromEntries(Object.entries(e).filter(([k]) => !cleared.includes(k))) : e));
  };

  const available = availabilityTotals(values.availability);
  const limits: Partial<Record<PostField, number>> = { ...ERROR_LIMITS, rhythmHours: Math.floor(available.minutes / 60), rhythmDays: available.days };

  const err = (field: PostField) => {
    const code = errors[field];
    return code ? t(`errors.${code}`, { max: limits[field] ?? 0 }) : undefined;
  };

  const sections = FORM_SECTIONS[type];
  const isTeam = TEAM_TYPES.includes(type);
  const offer = OFFER_TYPES.includes(type);
  const searchCopy = { searchPlaceholder: tFilters("search"), emptyLabel: tFilters("noOption") };

  const regionOptions = REGIONS.map((r) => ({ value: r, label: tRegions(r) }));
  const countryOptions = (() => {
    const names = new Intl.DisplayNames([locale], { type: "region" });
    return [
      { value: "", label: t("fields.noCountry") },
      ...COUNTRY_CODES.map((code) => ({
        value: code,
        label: names.of(code) ?? code,
        icon: <span className={`fi fi-${code.toLowerCase()} flex-none rounded-[2px]`} style={{ width: 18, height: 13.5 }} />,
      })).sort((a, b) => a.label.localeCompare(b.label, locale)),
    ];
  })();
  const languageOptions = LANGUAGES.map((code) => ({ value: code, label: languageName(code), icon: <LanguageFlag code={code} /> })).sort((a, b) => a.label.localeCompare(b.label, locale));
  const rankOptions: SelectOption<string>[] = RANKS.map((r, i) => ({ value: String(i), label: r.label, icon: <RankIcon rank={r.key} size={18} /> }));
  const rankRangeOptions: SelectOption<string>[] = [{ value: "", label: tFilters("any") }, ...rankOptions];
  const durationOptions: SelectOption<string>[] = [{ value: "", label: t("fields.notPlayed") }, ...EXPERIENCE_MONTHS.map((m) => ({ value: String(m), label: duration(m) }))];
  const hourOptions: SelectOption<string>[] = Array.from({ length: RHYTHM_HOURS_MAX }, (_, i) => ({ value: String(i + 1), label: t("fields.hoursPerWeek", { count: i + 1 }) }));
  const dayOptions: SelectOption<string>[] = Array.from({ length: 7 }, (_, i) => ({ value: String(i + 1), label: t("fields.daysPerWeek", { count: i + 1 }) }));
  const numberValue = (v: number | null) => (v === null ? "" : String(v));
  const playerCountOptions: SelectOption<string>[] = Array.from({ length: PLAYERS_WANTED_MAX + 1 }, (_, i) => ({ value: String(i), label: t("fields.playersCount", { count: i }) }));
  const subCountOptions: SelectOption<string>[] = Array.from({ length: SUBS_WANTED_MAX + 1 }, (_, i) => ({ value: String(i), label: t("fields.subsCount", { count: i }) }));
  const timezoneOptions = useTimezoneOptions(values.timezone);

  const rankValue = (v: number | null) => (v === null ? "" : String(v));
  const rankFrom = (v: string) => (v === "" ? null : Number(v));

  const submit = () => {
    setFormError(null);
    startTransition(async () => {
      const result = !edit
        ? await createPost(values, { replaceExpired: account.replacesExpired })
        : moderation
          ? await updatePostAsStaff(edit.postId, values, reason)
          : await updatePost(edit.postId, values);
      if (result.ok) {
        router.push(result.href);
        router.refresh();
        return;
      }
      setErrors(result.fieldErrors);
      setReasonError(result.reasonError ?? null);
      if (result.formError) setFormError({ code: result.formError, existingId: result.existingId, sanctionEndsAt: result.sanctionEndsAt });
      requestAnimationFrame(() => {
        document.querySelector("[aria-invalid='true'], [data-form-error]")?.scrollIntoView({ behavior: "smooth", block: "center" });
      });
    });
  };

  const errorCount = Object.keys(errors).length + (reasonError ? 1 : 0);
  const noReminder = !values.notifyEmail && !values.notifyDiscord;

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="flex flex-col gap-5"
    >
      <Card title={t("sections.identity")} description={t(isTeam ? "sections.identityTeamHint" : "sections.identityHint")}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label={t(isTeam ? "fields.teamName" : "fields.displayName")}
            htmlFor="displayName"
            required
            error={err("displayName")}
            aside={<Counter value={values.displayName.length} max={DISPLAY_NAME_MAX} />}
          >
            <TextInput id="displayName" value={values.displayName} maxLength={DISPLAY_NAME_MAX} onChange={(e) => set("displayName", e.target.value)} invalid={!!errors.displayName} autoComplete="off" />
          </Field>
          <Field label={t("fields.region")} htmlFor="region" required error={err("region")}>
            <Select id="region" label={t("fields.region")} placeholder={t("fields.choose")} value={values.region} onChange={(v) => set("region", v)} options={regionOptions} invalid={!!errors.region} />
          </Field>
          <Field label={t("fields.country")} htmlFor="country" error={err("country")}>
            <Select
              id="country"
              searchable
              {...searchCopy}
              label={t("fields.country")}
              value={values.country}
              onChange={(v) => set("country", v)}
              options={countryOptions}
              invalid={!!errors.country}
            />
          </Field>
          <Field label={t("fields.languages")} htmlFor="languages" required error={err("languages")}>
            <MultiSelect
              id="languages"
              searchable
              {...searchCopy}
              label={t("fields.languages")}
              placeholder={t("fields.choose")}
              summary={(count) => tFilters("selected", { count })}
              values={values.languages}
              onChange={(v) => set("languages", v)}
              options={languageOptions}
              max={LANGUAGES_MAX}
              maxHint={t("fields.languagesMax", { max: LANGUAGES_MAX })}
              invalid={!!errors.languages}
            />
          </Field>
          {sections.includes("teamLink") && (
            <Field label={t("fields.gcsTeam")} htmlFor="gcsTeamUrl" error={err("gcsTeamUrl")} hint={t("fields.gcsTeamHint")} className="sm:col-span-2">
              <TextInput
                id="gcsTeamUrl"
                type="url"
                inputMode="url"
                value={values.gcsTeamUrl}
                maxLength={GCS_TEAM_URL_MAX}
                onChange={(e) => set("gcsTeamUrl", e.target.value)}
                placeholder={t("fields.gcsTeamPlaceholder")}
                invalid={!!errors.gcsTeamUrl}
                autoComplete="off"
                spellCheck={false}
              />
            </Field>
          )}
        </div>
      </Card>

      {PROFILE_SECTIONS.some((section) => sections.includes(section)) && (
        <Card title={t(`sections.profile.${type}`)}>
          <div className="flex flex-col gap-5">
            {sections.includes("spot") && (
              <Field label={t(type === "lft" ? "fields.rosterSpot" : "fields.rosterSpotWanted")} required error={err("rosterSpot")} hint={t("fields.rosterSpotHint")}>
                <div className="flex flex-wrap gap-1.5" aria-invalid={!!errors.rosterSpot || undefined}>
                  {ROSTER_SPOTS.map((spot) => (
                    <ToggleChip key={spot} active={values.rosterSpot === spot} onClick={() => set("rosterSpot", spot)}>
                      {tSpots(spot)}
                    </ToggleChip>
                  ))}
                </div>
              </Field>
            )}

            {sections.includes("wanted") && (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={t("fields.playersWanted")} htmlFor="playersWanted" required error={err("playersWanted")} hint={t("fields.wantedHint")}>
                  <Select
                    id="playersWanted"
                    label={t("fields.playersWanted")}
                    placeholder={t("fields.choose")}
                    value={numberValue(values.playersWanted)}
                    onChange={(v) => set("playersWanted", v === "" ? null : Number(v))}
                    options={playerCountOptions}
                    invalid={!!errors.playersWanted}
                  />
                </Field>
                <Field label={t("fields.subsWanted")} htmlFor="subsWanted" required error={err("subsWanted")}>
                  <Select
                    id="subsWanted"
                    align="end"
                    label={t("fields.subsWanted")}
                    placeholder={t("fields.choose")}
                    value={numberValue(values.subsWanted)}
                    onChange={(v) => set("subsWanted", v === "" ? null : Number(v))}
                    options={subCountOptions}
                    invalid={!!errors.subsWanted}
                  />
                </Field>
              </div>
            )}

            {sections.includes("age") && (
              <Field label={t("fields.ageGroup")} error={err("ageGroup")} hint={t("fields.ageGroupHint")}>
                <div className="flex flex-wrap gap-1.5" aria-invalid={!!errors.ageGroup || undefined}>
                  {AGE_GROUPS.map((value) => (
                    <ToggleChip key={value} active={values.ageGroup === value} onClick={() => set("ageGroup", values.ageGroup === value ? "" : value)}>
                      {tAge(value)}
                    </ToggleChip>
                  ))}
                </div>
              </Field>
            )}

            {sections.includes("minors") && (
              <Field label={t("fields.minorsAccepted")} required error={err("minorsAccepted")} hint={t("fields.minorsAcceptedHint")}>
                <div className="flex flex-wrap gap-1.5" aria-invalid={!!errors.minorsAccepted || undefined}>
                  {([true, false] as const).map((value) => (
                    <ToggleChip key={String(value)} active={values.minorsAccepted === value} onClick={() => set("minorsAccepted", value)}>
                      {tMinors(value ? "accepted" : "adultsOnly")}
                    </ToggleChip>
                  ))}
                </div>
              </Field>
            )}

            {sections.includes("roles") && (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={t(type === "lft" ? "fields.roles" : "fields.rolesWanted")} required error={err("roles")} hint={t("fields.flexHint")}>
                  <div className="flex flex-wrap gap-1.5" aria-invalid={!!errors.roles || undefined}>
                    {AGENT_ROLES.map((role) => (
                      <ToggleChip key={role} active={values.roles.includes(role)} onClick={() => set("roles", toggle(values.roles, role))}>
                        {tRoles(role)}
                      </ToggleChip>
                    ))}
                  </div>
                </Field>
                <Field label={t(type === "lft" ? "fields.igl" : "fields.iglWanted")} error={err("igl")} hint={t(type === "lft" ? "fields.iglHint" : "fields.iglWantedHint")}>
                  <div className="flex flex-wrap gap-1.5" aria-invalid={!!errors.igl || undefined}>
                    {IGL_ROLES.map((role) => (
                      <ToggleChip key={role} color="var(--sc-accent-2)" active={values.igl.includes(role)} onClick={() => set("igl", toggle(values.igl, role))}>
                        {tIgl(role)}
                      </ToggleChip>
                    ))}
                  </div>
                </Field>
              </div>
            )}

            {sections.includes("staffRoles") && (
              <Field label={t(type === "lfst" ? "fields.staffRoles" : "fields.staffRolesWanted")} required error={err("staffRoles")}>
                <div className="flex flex-wrap gap-1.5" aria-invalid={!!errors.staffRoles || undefined}>
                  {STAFF_ROLES.map((role) => (
                    <ToggleChip key={role} active={values.staffRoles.includes(role)} onClick={() => set("staffRoles", toggle(values.staffRoles, role))}>
                      {tStaff(role)}
                    </ToggleChip>
                  ))}
                </div>
              </Field>
            )}

            {(sections.includes("compensation") || sections.includes("lan")) && (
              <div className="grid gap-4 sm:grid-cols-2">
                {sections.includes("compensation") && (
                  <Field
                    label={t(offer ? "fields.compensationOffered" : "fields.compensation")}
                    required
                    error={err("compensation")}
                    hint={t(offer ? "fields.compensationOfferedHint" : "fields.compensationHint")}
                  >
                    <div className="flex flex-wrap gap-1.5" aria-invalid={!!errors.compensation || undefined}>
                      {COMPENSATIONS.map((value) => (
                        <ToggleChip key={value} active={values.compensation === value} onClick={() => set("compensation", value)}>
                          {tCompensation(value)}
                        </ToggleChip>
                      ))}
                    </div>
                  </Field>
                )}
                {sections.includes("lan") && (
                  <Field label={t("fields.lan")} required error={err("lan")} hint={t(offer ? "fields.lanTeamHint" : "fields.lanHint")}>
                    <div className="flex flex-wrap gap-1.5" aria-invalid={!!errors.lan || undefined}>
                      {LAN_OPTIONS.map((value) => (
                        <ToggleChip key={value} active={values.lan === value} onClick={() => set("lan", value)}>
                          {tLan(value)}
                        </ToggleChip>
                      ))}
                    </div>
                  </Field>
                )}
              </div>
            )}

            {sections.includes("rank") && (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={t("fields.rankCurrent")} htmlFor="rankCurrent" required error={err("rankCurrent")}>
                  <Select
                    id="rankCurrent"
                    label={t("fields.rankCurrent")}
                    placeholder={t("fields.choose")}
                    value={rankValue(values.rankCurrent)}
                    onChange={(v) => set("rankCurrent", rankFrom(v))}
                    options={rankOptions}
                    invalid={!!errors.rankCurrent}
                  />
                </Field>
                <Field label={t("fields.rankPeak")} htmlFor="rankPeak" required error={err("rankPeak")}>
                  <Select
                    id="rankPeak"
                    align="end"
                    label={t("fields.rankPeak")}
                    placeholder={t("fields.choose")}
                    value={rankValue(values.rankPeak)}
                    onChange={(v) => set("rankPeak", rankFrom(v))}
                    options={rankOptions}
                    invalid={!!errors.rankPeak}
                  />
                </Field>
              </div>
            )}

            {sections.includes("tracker") && (
              <Field label={t("fields.tracker")} htmlFor="trackerUrl" error={err("trackerUrl")} hint={t("fields.trackerHint")}>
                <TextInput
                  id="trackerUrl"
                  type="url"
                  inputMode="url"
                  value={values.trackerUrl}
                  maxLength={TRACKER_URL_MAX}
                  onChange={(e) => set("trackerUrl", e.target.value)}
                  placeholder={t("fields.trackerPlaceholder")}
                  invalid={!!errors.trackerUrl}
                  autoComplete="off"
                  spellCheck={false}
                />
              </Field>
            )}

            {sections.includes("rankRange") && (
              <div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label={t("fields.rankMin")} htmlFor="rankMin" error={err("rankMin")}>
                    <Select id="rankMin" label={t("fields.rankMin")} value={rankValue(values.rankMin)} onChange={(v) => set("rankMin", rankFrom(v))} options={rankRangeOptions} invalid={!!errors.rankMin} />
                  </Field>
                  <Field label={t("fields.rankMax")} htmlFor="rankMax" error={err("rankMax")}>
                    <Select
                      id="rankMax"
                      align="end"
                      label={t("fields.rankMax")}
                      value={rankValue(values.rankMax)}
                      onChange={(v) => set("rankMax", rankFrom(v))}
                      options={rankRangeOptions}
                      invalid={!!errors.rankMax}
                    />
                  </Field>
                </div>
                <p className="mt-1.5 text-[12px] text-neutral-500">{t("fields.rankRangeHint")}</p>
              </div>
            )}

            {sections.includes("experience") && (
              <div>
                <p className="mb-1 text-[13px] font-semibold text-neutral-300">{t(type === "lfp" ? "fields.experienceWanted" : "fields.experience")}</p>
                <p className="mb-2.5 text-[12px] text-neutral-500">{t(type === "lfp" ? "fields.experienceWantedHint" : "fields.experienceHint")}</p>
                <div className="grid gap-4 sm:grid-cols-3" aria-invalid={!!errors.experience || undefined}>
                  {TOURNAMENT_LEVELS.map((level) => (
                    <Field key={level} label={tLevels(level)} htmlFor={`experience-${level}`}>
                      <Select
                        id={`experience-${level}`}
                        label={tLevels(level)}
                        value={numberValue(values.experience[level] ?? null)}
                        onChange={(v) => {
                          const rest = Object.fromEntries(Object.entries(values.experience).filter(([key]) => key !== level));
                          set("experience", v === "" ? rest : { ...rest, [level]: Number(v) });
                        }}
                        options={durationOptions}
                        invalid={!!errors.experience}
                      />
                    </Field>
                  ))}
                </div>
                {errors.experience && (
                  <p role="alert" className="mt-1.5 text-[12.5px] font-medium text-red-400">
                    {err("experience")}
                  </p>
                )}
              </div>
            )}
          </div>
        </Card>
      )}

      {sections.includes("tierList") && (
        <Card title={t("sections.tierList")} required description={t("sections.tierListHint")}>
          <TierListEditor value={values.tierList} onChange={(v) => set("tierList", v)} invalid={!!errors.tierList} />
          {errors.tierList && (
            <p role="alert" className="mt-2 text-[12.5px] font-medium text-red-400">
              {err("tierList")}
            </p>
          )}
        </Card>
      )}

      {sections.includes("availability") && (
        <Card title={t("sections.availability")} required={AVAILABILITY_REQUIRED[type]} description={t(isTeam ? "sections.availabilityTeamHint" : "sections.availabilityHint")}>
          <Field label={t("fields.timezone")} htmlFor="timezone" required error={err("timezone")} className="mb-4 max-w-md">
            <Select
              id="timezone"
              searchable
              {...searchCopy}
              label={t("fields.timezone")}
              placeholder={t("fields.choose")}
              value={values.timezone}
              onChange={(v) => set("timezone", v)}
              options={timezoneOptions}
              invalid={!!errors.timezone}
            />
          </Field>
          <AvailabilityEditor value={values.availability} onChange={(v) => set("availability", v)} invalid={!!errors.availability} />
          {errors.availability && (
            <p role="alert" className="mt-2 text-[12.5px] font-medium text-red-400">
              {err("availability")}
            </p>
          )}
        </Card>
      )}

      {sections.includes("availability") && (
        <Card title={t("sections.rhythm")} required={AVAILABILITY_REQUIRED[type]} description={t(isTeam ? "sections.rhythmTeamHint" : "sections.rhythmHint")}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("fields.rhythmHours")} htmlFor="rhythmHours" required={AVAILABILITY_REQUIRED[type]} error={err("rhythmHours")}>
              <Select
                id="rhythmHours"
                label={t("fields.rhythmHours")}
                placeholder={t("fields.choose")}
                value={numberValue(values.rhythmHours)}
                onChange={(v) => set("rhythmHours", v === "" ? null : Number(v))}
                options={AVAILABILITY_REQUIRED[type] ? hourOptions : [{ value: "", label: t("fields.notSpecified") }, ...hourOptions]}
                invalid={!!errors.rhythmHours}
              />
            </Field>
            <Field label={t("fields.rhythmDays")} htmlFor="rhythmDays" required={AVAILABILITY_REQUIRED[type]} error={err("rhythmDays")}>
              <Select
                id="rhythmDays"
                align="end"
                label={t("fields.rhythmDays")}
                placeholder={t("fields.choose")}
                value={numberValue(values.rhythmDays)}
                onChange={(v) => set("rhythmDays", v === "" ? null : Number(v))}
                options={AVAILABILITY_REQUIRED[type] ? dayOptions : [{ value: "", label: t("fields.notSpecified") }, ...dayOptions]}
                invalid={!!errors.rhythmDays}
              />
            </Field>
          </div>
          <p className="mt-2 text-[12px] text-neutral-500">
            {available.minutes > 0 ? t("fields.rhythmMax", { hours: Math.floor(available.minutes / 60), days: available.days }) : t("fields.rhythmNoAvailability")}
          </p>
        </Card>
      )}

      <Card title={t("sections.about")} description={t("sections.aboutHint")}>
        <div className="flex flex-col gap-4">
          <Field label={t("fields.description")} htmlFor="description" error={err("description")} aside={<Counter value={values.description.length} max={DESCRIPTION_MAX} />}>
            <TextArea
              id="description"
              value={values.description}
              maxLength={DESCRIPTION_MAX}
              onChange={(e) => set("description", e.target.value)}
              placeholder={t(`fields.descriptionPlaceholder.${isTeam ? "team" : "player"}`)}
              invalid={!!errors.description}
            />
          </Field>
          <div className="flex flex-col gap-3">
            <CheckRow
              icon={BriefcaseIcon}
              checked={values.agent}
              onChange={(v) => set("agent", v)}
              label={t("fields.agent")}
              detail={t("fields.agentHint")}
              invalid={!!errors.agent}
            />
            {values.agent && (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={t("fields.agentName")} htmlFor="agentName" required error={err("agentName")} aside={<Counter value={values.agentName.length} max={AGENT_NAME_MAX} />}>
                  <TextInput id="agentName" value={values.agentName} maxLength={AGENT_NAME_MAX} onChange={(e) => set("agentName", e.target.value)} invalid={!!errors.agentName} autoComplete="off" />
                </Field>
                <Field label={t("fields.agentAgency")} htmlFor="agentAgency" error={err("agentAgency")} aside={<Counter value={values.agentAgency.length} max={AGENCY_MAX} />}>
                  <TextInput
                    id="agentAgency"
                    value={values.agentAgency}
                    maxLength={AGENCY_MAX}
                    onChange={(e) => set("agentAgency", e.target.value)}
                    placeholder={t("fields.agentAgencyPlaceholder")}
                    invalid={!!errors.agentAgency}
                    autoComplete="off"
                  />
                </Field>
              </div>
            )}
          </div>
          <CheckRow
            icon={MessageSquareIcon}
            checked={values.chatEnabled}
            onChange={(v) => set("chatEnabled", v)}
            label={t("fields.chatEnabled")}
            detail={t("fields.chatEnabledHint")}
            invalid={!!errors.chatEnabled}
          />
          <div>
            <p className="mb-2 text-[13px] font-semibold text-neutral-300">
              {t(values.agent ? "fields.contactAgent" : "fields.contact")}
              {!values.chatEnabled && <span className="ml-0.5 text-red-500">*</span>}
            </p>
            <div className={cn("grid gap-4", isTeam ? "sm:grid-cols-2" : "sm:grid-cols-3")}>
              <Field
                label={t("fields.discord")}
                htmlFor="discord"
                error={err("discord")}
                aside={
                  account.discordId &&
                  values.discord !== account.discordId && (
                    <button
                      type="button"
                      onClick={() => set("discord", account.discordId!)}
                      className="rounded text-[12px] font-semibold text-[var(--sc-accent)] transition-all hover:underline active:scale-[0.97]"
                    >
                      {t("fields.discordUseLinked")}
                    </button>
                  )
                }
              >
                <TextInput
                  id="discord"
                  inputMode="numeric"
                  value={values.discord}
                  maxLength={20}
                  onChange={(e) => set("discord", e.target.value.trim())}
                  placeholder={t("fields.discordPlaceholder")}
                  invalid={!!errors.discord || !!errors.contact}
                  autoComplete="off"
                  spellCheck={false}
                />
              </Field>
              {isTeam && (
                <Field label={t("fields.discordInvite")} htmlFor="discordInvite" error={err("discordInvite")}>
                  <TextInput
                    id="discordInvite"
                    type="url"
                    inputMode="url"
                    value={values.discordInvite}
                    maxLength={DISCORD_INVITE_MAX}
                    onChange={(e) => set("discordInvite", e.target.value)}
                    placeholder={t("fields.discordInvitePlaceholder")}
                    invalid={!!errors.discordInvite || !!errors.contact}
                    autoComplete="off"
                    spellCheck={false}
                  />
                </Field>
              )}
              <Field label={t("fields.twitter")} htmlFor="twitter" error={err("twitter")}>
                <TextInput
                  id="twitter"
                  prefix="@"
                  value={values.twitter}
                  onChange={(e) => set("twitter", e.target.value.replace(/^@/, ""))}
                  placeholder={t("fields.twitterPlaceholder")}
                  invalid={!!errors.twitter || !!errors.contact}
                  autoComplete="off"
                  spellCheck={false}
                />
              </Field>
              <Field label={t("fields.email")} htmlFor="email" error={err("email")}>
                <TextInput
                  id="email"
                  type="email"
                  inputMode="email"
                  value={values.email}
                  maxLength={EMAIL_MAX}
                  onChange={(e) => set("email", e.target.value)}
                  placeholder={t("fields.emailPlaceholder")}
                  invalid={!!errors.email || !!errors.contact}
                  autoComplete="email"
                  spellCheck={false}
                />
              </Field>
            </div>
            <DiscordIdHelp />
            {errors.contact ? (
              <p role="alert" className="mt-1.5 text-[12.5px] font-medium text-red-400">
                {err("contact")}
              </p>
            ) : (
              <p className="mt-1.5 text-[12px] text-neutral-500">
                {t(values.agent ? "fields.contactAgentHint" : "fields.contactHint")} {values.chatEnabled && t("fields.contactChatHint")}
              </p>
            )}
          </div>
        </div>
      </Card>

      <Card title={t("sections.tweet")} description={t("sections.tweetHint")} required>
        <RadioCards
          id="tweetBy"
          value={values.tweetBy}
          onChange={(v) => set("tweetBy", v)}
          disabled={edit?.tweeted}
          invalid={!!errors.tweetBy}
          options={[
            { value: "site", icon: MegaphoneIcon, label: t("fields.tweetBySite"), detail: t("fields.tweetBySiteHint") },
            { value: "author", icon: Repeat2Icon, label: t("fields.tweetByAuthor"), detail: t("fields.tweetByAuthorHint") },
          ]}
        />
        {errors.tweetBy ? (
          <p role="alert" className="mt-2 text-[12.5px] font-medium text-red-400">
            {err("tweetBy")}
          </p>
        ) : (
          edit?.tweeted && <p className="mt-2 text-[12px] text-neutral-500">{t("fields.tweetByLocked")}</p>
        )}
      </Card>

      {moderation ? (
        <Card title={t("sections.moderation")} description={t("sections.moderationHint")}>
          <Field
            label={t("fields.moderationReason")}
            htmlFor="moderationReason"
            required
            error={
              reasonError === "invalidCharacters"
                ? t("errors.invalidCharacters")
                : reasonError
                  ? t("errors.reasonLength", { min: REMOVAL_REASON_MIN, max: REMOVAL_REASON_MAX })
                  : undefined
            }
            aside={<Counter value={reason.trim().length} max={REMOVAL_REASON_MAX} />}
          >
            <TextArea
              id="moderationReason"
              value={reason}
              maxLength={REMOVAL_REASON_MAX}
              onChange={(e) => {
                setReason(e.target.value);
                setReasonError(null);
              }}
              placeholder={t("fields.moderationReasonPlaceholder")}
              invalid={!!reasonError}
              className="min-h-[96px]"
            />
          </Field>
        </Card>
      ) : (
        <Card title={t("sections.reminders")} description={t(account.delegated ? "sections.remindersDelegatedHint" : "sections.remindersHint")}>
          <div className="flex flex-col gap-2">
            <CheckRow
              checked={values.notifyEmail}
              icon={BellIcon}
              disabled={!account.email}
              onChange={(v) => set("notifyEmail", v)}
              label={t("fields.notifyEmail")}
              detail={account.email ?? t("fields.noEmail")}
              invalid={!!errors.notifyEmail}
            />
            <CheckRow
              checked={values.notifyDiscord}
              icon={BellIcon}
              disabled={!account.hasDiscord}
              onChange={(v) => set("notifyDiscord", v)}
              label={t("fields.notifyDiscord")}
              detail={account.hasDiscord ? t("fields.discordLinked") : t("fields.noDiscord")}
              invalid={!!errors.notifyDiscord}
            />
          </div>
          {(errors.notifyEmail || errors.notifyDiscord) && (
            <p role="alert" className="mt-2 text-[12.5px] font-medium text-red-400">
              {t("errors.notifyUnavailable")}
            </p>
          )}
          {noReminder && (
            <div className="mt-3 flex items-start gap-2.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-[12.5px] leading-snug text-amber-200">
              <AlertTriangleIcon className="mt-0.5 h-4 w-4 flex-none text-amber-400" />
              {t("fields.noReminderWarning")}
            </div>
          )}
        </Card>
      )}

      {formError && (
        <div data-form-error role="alert" className="flex items-start gap-3 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3.5">
          <AlertTriangleIcon className="mt-0.5 h-4 w-4 flex-none text-red-400" />
          <div className="text-[13.5px] text-red-200">
            <p>
              {formError.sanctionEndsAt
                ? t("formErrors.sanctionedUntil", { date: format.dateTime(new Date(formError.sanctionEndsAt), { dateStyle: "long", timeStyle: "short" }) })
                : t(`formErrors.${formError.code}`, { code: type.toUpperCase(), max: ACTIVE_POSTS_MAX[type] ?? 0 })}
            </p>
            {formError.existingId && (
              <Link href={`/posts/${type}/${formError.existingId}`} className="mt-1 inline-block font-semibold text-red-100 underline underline-offset-2 hover:text-white active:opacity-70">
                {t("viewExisting")}
              </Link>
            )}
          </div>
        </div>
      )}

      <div className="sticky bottom-0 z-20 -mx-4 flex flex-wrap items-center justify-end gap-3 border-t border-neutral-800 bg-[var(--sc-bg)]/90 px-4 py-3 backdrop-blur-xl sm:mx-0 sm:rounded-xl sm:border sm:px-4">
        {errorCount > 0 && <span className="mr-auto text-[13px] font-medium text-red-400">{t("errorCount", { count: errorCount })}</span>}
        {edit && (
          <Link
            href={`/posts/${type}/${edit.postId}`}
            className="inline-flex h-11 items-center rounded-[11px] border border-neutral-800 px-4 text-[14px] font-semibold text-neutral-300 transition-all hover:bg-[var(--sc-hover)] active:scale-[0.97]"
          >
            {t("cancel")}
          </Link>
        )}
        {errorCount === 0 && !edit && account.replacesExpired && <span className="mr-auto text-[12.5px] text-neutral-500">{t("replacesExpired", { code: type.toUpperCase() })}</span>}
        <button
          type="submit"
          disabled={pending}
          aria-busy={pending}
          className="inline-flex h-11 items-center gap-2 rounded-[11px] bg-[var(--sc-accent)] px-5 text-[14.5px] font-bold text-[var(--sc-accent-ink)] transition-all hover:brightness-110 active:scale-[0.97] disabled:opacity-70"
        >
          {pending ? <Loader2Icon className="h-[18px] w-[18px] animate-spin" /> : edit ? <SaveIcon className="h-[17px] w-[17px]" /> : <SendIcon className="h-[17px] w-[17px]" />}
          {edit ? t(pending ? "saving" : "save") : t(pending ? "publishing" : "publish")}
        </button>
      </div>
    </form>
  );
}

function Card({ title, description, required, children }: { title: string; description?: string; required?: boolean; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-neutral-800 bg-[var(--sc-surface)] p-4 sm:p-6">
      <h2 className="text-[16px] font-bold tracking-tight text-neutral-50">
        {title}
        {required && <span className="ml-0.5 text-red-500">*</span>}
      </h2>
      {description && <p className="mt-1 text-[13px] leading-relaxed text-neutral-500">{description}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Counter({ value, max }: { value: number; max: number }) {
  return <span className={cn("text-[11.5px] tabular-nums", value >= max ? "text-amber-400" : "text-neutral-600")}>{`${value}/${max}`}</span>;
}
