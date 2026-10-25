/**
 * GC-Scouting - client
 *
 * Database client: one connection pool per Node process.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

import { Pool } from "pg";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "./schema";

export type Db = NodePgDatabase<typeof schema>;

declare global {
  // eslint-disable-next-line no-var
  var __scoutingDbPool: Pool | undefined;
}

/** Connections per process. Replicas times this must stay under what the pooler (PgBouncer) accepts. */
const POOL_SIZE = Number(process.env.DATABASE_POOL_SIZE) || 10;

function createPool(): Pool {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: POOL_SIZE });
  // An idle client dropped by the server must not crash the process.
  pool.on("error", (error) => console.error("[db] pool error", error.message));
  return pool;
}

// The pool survives hot reloads in dev. It connects on the first query, so the build never reaches the database.
const pool = globalThis.__scoutingDbPool ?? createPool();
if (process.env.NODE_ENV !== "production") globalThis.__scoutingDbPool = pool;

export const db: Db = drizzle(pool, { schema });
