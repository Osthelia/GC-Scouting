/**
 * GC-Scouting - create-db
 *
 * Creates the database when it does not exist.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

import { Client } from "pg";
import { databaseUrl } from "./env";

// Creates the database named in DATABASE_URL. `--drop` recreates it from scratch.

const target = new URL(databaseUrl());
const name = decodeURIComponent(target.pathname.slice(1));
if (!/^[a-z0-9_]+$/i.test(name)) throw new Error(`Invalid database name: ${name}`);

const admin = new URL(target);
admin.pathname = "/postgres";
const client = new Client({ connectionString: admin.toString() });
await client.connect();

try {
  if (process.argv.includes("--drop")) {
    await client.query(`drop database if exists "${name}" with (force)`);
    console.log(`Dropped ${name}`);
  }
  const { rowCount } = await client.query("select 1 from pg_database where datname = $1", [name]);
  if (rowCount) console.log(`${name} already exists`);
  else {
    await client.query(`create database "${name}"`);
    console.log(`Created ${name}`);
  }
} finally {
  await client.end();
}
