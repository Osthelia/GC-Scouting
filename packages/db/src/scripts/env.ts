/**
 * GC-Scouting - env
 *
 * Loads the database URL for the scripts.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

// Loads packages/db/.env when present, the real environment wins.
try {
  process.loadEnvFile(new URL("../../.env", import.meta.url));
} catch {}

export function databaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is missing (see packages/db/.env.example)");
  return url;
}
