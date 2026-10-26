/**
 * GC-Scouting - use-post-filters
 *
 * Hook that keeps the post filters in the URL.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { FILTER_PARAM_KEYS, filtersFromParams, filtersToParams, type PostFilters } from "@scouting/db/filters";
import type { PostSort, PostType } from "@scouting/db/constants";
import { FILTER_GROUPS, type FilterGroup } from "./post-types";

const GROUP_KEYS: Record<FilterGroup, (keyof PostFilters)[]> = {
  spot: ["spots"],
  role: ["roles", "igl"],
  staffRole: ["staffRoles"],
  compensation: ["compensation"],
  lan: ["lan"],
  age: ["ages"],
  rank: ["rankMin", "rankMax"],
  agents: ["agents"],
  experience: ["minMonths", "levels"],
  availability: ["minHours", "minDays", "slot", "week"],
};

/** The type comes from the page, a `types` filter would only hide results. Filters the page does not show are dropped too. */
function parse(params: { get(key: string): string | null }, type: PostType) {
  const parsed = filtersFromParams(params);
  delete parsed.filters.types;
  for (const [group, keys] of Object.entries(GROUP_KEYS) as [FilterGroup, (keyof PostFilters)[]][]) {
    if (!FILTER_GROUPS[type].includes(group)) for (const key of keys) delete parsed.filters[key];
  }
  return parsed;
}

/**
 * Filters of a /posts/{type} page: the URL wins (shared links), then the last filters saved in this browser for this type,
 * then the defaults.
 */
export function usePostFilters(type: PostType) {
  const storageKey = `sc:posts:filters:${type}`;
  const searchParams = useSearchParams();
  const hasParams = FILTER_PARAM_KEYS.some((key) => searchParams.has(key));
  const [state, setState] = useState(() => parse(searchParams, type));
  const hydrated = useRef(false);

  useEffect(() => {
    if (!hydrated.current) {
      hydrated.current = true;
      if (hasParams) return;
      try {
        const saved = localStorage.getItem(storageKey);
        if (saved !== null) setState(parse(new URLSearchParams(saved), type));
      } catch {
        // Storage can be blocked, filters just won't be restored.
      }
      return;
    }

    const query = filtersToParams(state.filters, state.sort).toString();
    window.history.replaceState(null, "", query ? `${window.location.pathname}?${query}` : window.location.pathname);
    try {
      localStorage.setItem(storageKey, query);
    } catch {
      // Same as above.
    }
    // The URL and default region are only read on the first run.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const setFilters = useCallback((patch: Partial<PostFilters>) => {
    setState((prev) => {
      const filters: PostFilters = { ...prev.filters, ...patch };
      for (const key of Object.keys(filters) as (keyof PostFilters)[]) {
        const value = filters[key];
        if (value === undefined || (value === 0 && key !== "rankMax") || (Array.isArray(value) && value.length === 0)) delete filters[key];
      }
      return { ...prev, filters };
    });
  }, []);

  const setSort = useCallback((sort: PostSort) => setState((prev) => ({ ...prev, sort })), []);
  const reset = useCallback(() => setState((prev) => ({ filters: {}, sort: prev.sort })), []);

  return { filters: state.filters, sort: state.sort, setFilters, setSort, reset };
}
