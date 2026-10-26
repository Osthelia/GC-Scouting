/**
 * GC-Scouting - . index
 *
 * Bot process entry point: Discord gateway, internal HTTP server for the site and the periodic catch up.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

import { loggable } from "@scouting/db/log";
import { loadEnv } from "./env";
import { createContext } from "./core/context";
import { createGateway } from "./core/gateway";
import { startHeartbeat } from "./core/heartbeat";
import { catchUp } from "./modules/delivery";
import { createInternalServer } from "./server";

// One process per bot: a single gateway connection, so a single replica (strategy Recreate).

/** Catch up on posts the site could not hand over (bot down, failed call). */
const CATCH_UP_INTERVAL_MS = 5 * 60 * 1000;
/** Time given to in-flight work once a stop is asked. */
const SHUTDOWN_TIMEOUT_MS = 25_000;

const env = loadEnv();
const { ctx, pool, drain } = createContext(env);
const client = createGateway(ctx);
const server = createInternalServer(ctx, { discordReady: () => client.isReady() });

let catchingUp = false;
function runCatchUp(): void {
  if (catchingUp) return;
  catchingUp = true;
  catchUp(ctx)
    .catch((error) => console.error("[bot] catch up failed", loggable(error)))
    .finally(() => {
      catchingUp = false;
    });
}

const timer = setInterval(runCatchUp, CATCH_UP_INTERVAL_MS);
const heartbeat = startHeartbeat(client, ctx);

let stopping = false;
async function shutdown(signal: string): Promise<void> {
  if (stopping) return;
  stopping = true;
  console.info(`[bot] ${signal}, stopping`);
  setTimeout(() => process.exit(1), SHUTDOWN_TIMEOUT_MS).unref();

  clearInterval(timer);
  if (heartbeat) clearInterval(heartbeat);
  await client.destroy();
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await drain();
  await pool.end();
  process.exit(0);
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));

server.listen(Number(env.PORT), () => console.info(`[bot] internal server on :${env.PORT}`));
await client.login(env.DISCORD_BOT_TOKEN);
// Right after a start: whatever the site sent while the bot was down.
runCatchUp();
