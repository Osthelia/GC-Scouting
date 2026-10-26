/**
 * GC-Scouting - drizzle.config
 *
 * Drizzle Kit configuration.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

import { defineConfig } from "drizzle-kit";

try {
  process.loadEnvFile();
} catch {}

// `db:generate` only diffs the schema against ./drizzle, `db:migrate` needs a real DATABASE_URL.
export default defineConfig({
  schema: "./src/schema/*.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgres://placeholder",
  },
});
