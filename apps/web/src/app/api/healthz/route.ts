/**
 * GC-Scouting - healthz route
 *
 * Liveness probe: the process answers.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

export const dynamic = "force-dynamic";

export function GET() {
  return new Response("ok", { headers: { "Cache-Control": "no-store" } });
}
