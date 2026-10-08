/**
 * GC-Scouting - context
 *
 * Per request bot context: database handle, environment and deferred background work.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

import { Pool } from "pg";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "@scouting/db/schema";
import type { Env } from "../env";
import { loggable } from "@scouting/db/log";

export type Db = NodePgDatabase<typeof schema>;

/** What every handler receives: bindings, a database for this request, and work to run after the response. */
export type BotContext = {
  env: Env;
  db: Db;
  defer(task: () => Promise<unknown>): void;
};

/** One Hyperdrive pool per invocation, closed once the deferred work is done. */
export function createContext(env: Env, execution: ExecutionContext): { ctx: BotContext; finish(): void } {
  const pool = new Pool({ connectionString: env.HYPERDRIVE.connectionString, maxUses: 1 });
  // workerd drops idle sockets once the invocation ends, the pool then errors.
  pool.on("error", () => {});
  const tasks: Promise<unknown>[] = [];

  const ctx: BotContext = {
    env,
    db: drizzle(pool, { schema }),
    defer(task) {
      tasks.push(
        task().catch((error) => {
          console.error("[bot] deferred task failed", loggable(error));
        }),
      );
    },
  };

  return {
    ctx,
    finish() {
      execution.waitUntil(
        (async () => {
          // Deferred tasks may defer more work, wait until the list is stable.
          for (let done = 0; done < tasks.length; ) {
            const batch = tasks.slice(done);
            done = tasks.length;
            await Promise.all(batch);
          }
          await pool.end().catch(() => {});
        })(),
      );
    },
  };
}
