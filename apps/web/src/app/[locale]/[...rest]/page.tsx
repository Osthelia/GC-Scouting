/**
 * GC-Scouting - rest page
 *
 * Catch all route that renders the localized not found page.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

import { notFound } from "next/navigation";

// Unmatched paths under a locale render the localized not-found page.
export default function CatchAll() {
  notFound();
}
