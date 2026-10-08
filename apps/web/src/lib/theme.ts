/**
 * GC-Scouting - theme
 *
 * Theme preference values and cookie name.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

// Shared by the layout (server) and the preferences menu.

export const THEMES = ["system", "light", "dark"] as const;
export type ThemePreference = (typeof THEMES)[number];
export const THEME_COOKIE = "sc_theme";

export function isThemePreference(value: unknown): value is ThemePreference {
  return THEMES.includes(value as ThemePreference);
}
