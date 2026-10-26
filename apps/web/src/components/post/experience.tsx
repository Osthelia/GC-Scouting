/**
 * GC-Scouting - experience
 *
 * Experience labels and tournament level summary.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

import { useTranslations } from "next-intl";
import { TOURNAMENT_LEVELS } from "@scouting/db/constants";
import type { Experience } from "@scouting/db/derived";

/** "3 months", "1 year", "2 years". */
export function useDurationLabel() {
  const t = useTranslations("duration");
  return (months: number) => (months < 12 ? t("months", { count: months }) : t("years", { count: Math.round(months / 12) }));
}

/** Levels played with their duration, highest level first ("Main event, 3 months"). */
export function useExperienceItems() {
  const tLevels = useTranslations("levels");
  const duration = useDurationLabel();
  return (experience: Experience) =>
    [...TOURNAMENT_LEVELS]
      .reverse()
      .flatMap((level) => (experience[level] ? [{ level, label: tLevels(level), duration: duration(experience[level]) }] : []));
}

/** Highest level played and its duration, for cards. */
export function TopExperience({ experience }: { experience: Experience }) {
  const top = useExperienceItems()(experience)[0];
  if (!top) return null;
  return (
    <span className="text-[12px] whitespace-nowrap text-neutral-500">
      <span className="font-medium text-neutral-300">{top.label}</span> {top.duration}
    </span>
  );
}
