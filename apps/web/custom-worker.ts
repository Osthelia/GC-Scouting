/**
 * GC-Scouting - custom-worker
 *
 * Cloudflare worker entry: wraps the OpenNext handler and routes cron triggers to the cron endpoints of the site.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

// @ts-ignore `.open-next/worker.js` only exists after `opennextjs-cloudflare build`
import { default as handler } from "./.open-next/worker.js";

// Cron trigger -> cron routes: getCloudflareContext() (Hyperdrive) only resolves inside handler.fetch.
const CRON_ROUTES: Record<string, string[]> = {
  "0 * * * *": ["/api/cron/player-links", "/api/cron/expiry-reminders", "/api/cron/sessions"],
};

export default {
  fetch: handler.fetch,

  async scheduled(controller, env, ctx) {
    for (const path of CRON_ROUTES[controller.cron] ?? []) {
      const request = new Request(new URL(path, "https://internal.scouting"), {
        method: "POST",
        headers: { authorization: `Bearer ${env.CRON_SECRET}` },
      });
      ctx.waitUntil(handler.fetch(request, env, ctx));
    }
  },
} satisfies ExportedHandler<CloudflareEnv & { CRON_SECRET: string }>;
