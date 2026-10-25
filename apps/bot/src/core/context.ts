/**
 * GC-Scouting - context
 *
 * Bot context shared by every handler: database handle, environment and background work.
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

/** What every handler receives: environment, database, and work to run after the response. */
export type BotContext = {
  env: Env;
  db: Db;
  defer(task: () => Promise<unknown>): void;
};

/** The process keeps one pool for its whole life. */
export function createContext(env: Env): { ctx: BotContext; pool: Pool; drain(): Promise<void> } {
  const pool = new Pool({ connectionString: env.DATABASE_URL, max: 10 });
  // An idle client dropped by the server must not crash the process.
  pool.on("error", (error) => console.error("[bot] database pool error", loggable(error)));
  const running = new Set<Promise<unknown>>();

  const ctx: BotContext = {
    env,
    db: drizzle(pool, { schema }),
    defer(task) {
      const run = task()
        .catch((error) => {
          console.error("[bot] deferred task failed", loggable(error));
        })
        .finally(() => running.delete(run));
      running.add(run);
    },
  };

  return {
    ctx,
    pool,
    // Deferred tasks may defer more work, wait until none is left.
    async drain() {
      while (running.size > 0) await Promise.all([...running]);
    },
  };
}
