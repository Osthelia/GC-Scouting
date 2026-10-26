/**
 * GC-Scouting - log
 *
 * Strips sensitive data from database errors before they are logged.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

// Drizzle puts query parameters in its error message and Postgres puts row values in `detail`,
// so database errors are reduced to their query text, code and message before being logged.

type PgError = Error & { code: string; severity: string; constraint?: string; table?: string; column?: string };

const isQueryError = (error: Error): error is Error & { query: string; params: unknown[] } => "query" in error && "params" in error;
const isPgError = (error: Error): error is PgError => typeof (error as PgError).code === "string" && "severity" in error;

/** The error to pass to `console.error`, without any value read or written by a query. */
export function loggable(error: unknown): unknown {
  if (!(error instanceof Error)) return error;
  if (isQueryError(error)) return { name: "DrizzleQueryError", query: error.query, cause: loggable(error.cause) };
  if (isPgError(error)) {
    // Data exceptions (class 22) quote the rejected value after a colon.
    const message = error.code.startsWith("22") ? error.message.split(":")[0] : error.message;
    return { name: "PostgresError", message, code: error.code, constraint: error.constraint, table: error.table, column: error.column };
  }
  if (error.cause instanceof Error) return { name: error.name, message: error.message, stack: error.stack, cause: loggable(error.cause) };
  return error;
}
