/**
 * GC-Scouting - root layout
 *
 * Root layout that only exists so the root not found page can render.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

// The real root layout lives in `[locale]/layout.tsx`; this one only lets `not-found.tsx` exist at the root.
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return children;
}
