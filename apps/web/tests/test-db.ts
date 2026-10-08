/**
 * GC-Scouting - test-db
 *
 * Test database setup and teardown.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";

// Database tests run on `<name>_test`, next to the local database, emptied and migrated on every run.
// It is created once by a superuser, owned by the migration role of `packages/db/.env`:
//   create database scouting_test owner scouting_migration;

try {
  process.loadEnvFile(new URL("../../../packages/db/.env", import.meta.url));
} catch {}

export async function useTestDatabase(): Promise<void> {
  const source = process.env.DATABASE_URL;
  if (!source) throw new Error("DATABASE_URL is missing (see packages/db/.env.example)");
  const url = new URL(source);
  if (!["localhost", "127.0.0.1"].includes(url.hostname)) throw new Error(`Refusing to run database tests on ${url.hostname}`);
  url.pathname = `/${decodeURIComponent(url.pathname.slice(1))}_test`;

  const pool = new Pool({ connectionString: url.toString() });
  try {
    await pool.query("drop schema if exists drizzle cascade; drop schema public cascade; create schema public;");
  } catch (error) {
    await pool.end();
    throw new Error(`Cannot reset ${url.pathname.slice(1)}, create it first (see tests/test-db.ts)`, { cause: error });
  }
  await migrate(drizzle(pool), { migrationsFolder: fileURLToPath(new URL("../../../packages/db/drizzle", import.meta.url)) });
  await pool.end();
  // Read by `@scouting/db/client` on its first query.
  process.env.DATABASE_URL = url.toString();
}

/** Closes the pool of `@scouting/db/client` so the test process can exit. */
export async function closeTestDatabase(): Promise<void> {
  await globalThis.__scoutingDbPool?.end();
}
