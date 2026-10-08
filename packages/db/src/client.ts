/**
 * GC-Scouting - client
 *
 * Database client for Node and Cloudflare Workers.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

import { Pool } from "pg";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import * as schema from "./schema";

export type Db = NodePgDatabase<typeof schema>;

interface WorkersEnv {
  HYPERDRIVE: { connectionString: string };
}

declare global {
  // eslint-disable-next-line no-var
  var __scoutingDbPool: Pool | undefined;
}

// Local dev: one pool, kept across hot reloads.
let nodeDb: Db | undefined;
function getNodeDb(): Db {
  if (!nodeDb) {
    const pool = globalThis.__scoutingDbPool ?? new Pool({ connectionString: process.env.DATABASE_URL });
    if (process.env.NODE_ENV !== "production") globalThis.__scoutingDbPool = pool;
    nodeDb = drizzle(pool, { schema });
  }
  return nodeDb;
}

// Workers: one Hyperdrive pool per request, memoized on the ExecutionContext.
const perRequest = new WeakMap<object, Db>();
function getWorkersDb(): Db {
  const { env, ctx } = getCloudflareContext();
  const cached = ctx ? perRequest.get(ctx) : undefined;
  if (cached) return cached;

  const pool = new Pool({ connectionString: (env as unknown as WorkersEnv).HYPERDRIVE.connectionString, maxUses: 1 });
  // workerd drops the socket once the request ends, the idle client then errors.
  pool.on("error", () => {});
  const instance = drizzle(pool, { schema });
  if (ctx) perRequest.set(ctx, instance);
  return instance;
}

function resolveDb(): Db {
  return process.env.DEPLOY_TARGET === "cloudflare" ? getWorkersDb() : getNodeDb();
}

// Proxy so call sites import a single `db` whatever the runtime. Every trap is forwarded
// because drizzle checks the prototype to identify the dialect.
export const db: Db = new Proxy({} as Db, {
  get(_target, prop) {
    const real = resolveDb();
    const value = Reflect.get(real, prop, real);
    return typeof value === "function" ? value.bind(real) : value;
  },
  has: (_target, prop) => Reflect.has(resolveDb(), prop),
  ownKeys: () => Reflect.ownKeys(resolveDb()),
  getOwnPropertyDescriptor: (_target, prop) => Reflect.getOwnPropertyDescriptor(resolveDb(), prop),
  getPrototypeOf: () => Reflect.getPrototypeOf(resolveDb()),
  set: (_target, prop, value) => Reflect.set(resolveDb(), prop, value),
});
