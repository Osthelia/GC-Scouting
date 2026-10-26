/**
 * GC-Scouting - preferences
 *
 * Client side preferences (timezone) with change events.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

"use client";

import { useSyncExternalStore } from "react";
import { isValidTimezone } from "@scouting/db/derived";
import { THEME_COOKIE, type ThemePreference } from "./theme";

// Visitor preferences: timezone in localStorage (client only), theme in a cookie so the server renders it.

const TIMEZONE_KEY = "sc:timezone";
const TIMEZONE_EVENT = "sc:timezone-change";

export function browserTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

function subscribeTimezone(callback: () => void) {
  window.addEventListener(TIMEZONE_EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(TIMEZONE_EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

function readTimezone(): string {
  try {
    const value = localStorage.getItem(TIMEZONE_KEY);
    return value && isValidTimezone(value) ? value : "";
  } catch {
    return "";
  }
}

/** Chosen timezone, "" when it follows the browser. */
export function useTimezonePreference(): string {
  return useSyncExternalStore(subscribeTimezone, readTimezone, () => "");
}

/** "" goes back to the browser timezone. */
export function setTimezonePreference(timezone: string) {
  try {
    if (timezone) localStorage.setItem(TIMEZONE_KEY, timezone);
    else localStorage.removeItem(TIMEZONE_KEY);
  } catch {
    // Storage can be blocked, the choice then lasts until the page is left.
  }
  window.dispatchEvent(new Event(TIMEZONE_EVENT));
}

const noop = () => () => {};

/** Timezone used to show and search hours, null during the server render. */
export function useViewerTimezone(): string | null {
  const preference = useTimezonePreference();
  const hydrated = useSyncExternalStore(noop, () => true, () => false);
  if (!hydrated) return null;
  return preference || browserTimezone();
}

export function applyTheme(theme: ThemePreference) {
  document.cookie = `${THEME_COOKIE}=${theme}; path=/; max-age=31536000; samesite=lax`;
  if (theme === "system") delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = theme;
}
