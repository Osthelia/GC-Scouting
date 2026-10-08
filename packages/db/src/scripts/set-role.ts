/**
 * GC-Scouting - set-role
 *
 * Sets the role of a user from the command line.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

import { Client } from "pg";
import { USER_ROLES } from "../constants";
import { databaseUrl } from "./env";

// Sets the role of an account: `npm run db:role -- <username | GC Stats id | account id> [user | staff | admin]` (admin by default).

const [target, role = "admin"] = process.argv.slice(2);
if (!target || !(USER_ROLES as readonly string[]).includes(role)) {
  console.error(`Usage: npm run db:role -- <username | GC Stats id | account id> [${USER_ROLES.join(" | ")}]`);
  process.exit(1);
}

const client = new Client({ connectionString: databaseUrl() });
await client.connect();

try {
  const { rows } = await client.query<{ id: string; username: string; role: string }>(
    "select id, username, role from users where id = $1 or gcs_user_id = $1 or lower(username) = lower($1)",
    [target],
  );
  const [user] = rows;
  if (!user) throw new Error(`No account matches "${target}" (sign in once on the website first)`);
  if (rows.length > 1) throw new Error(`Several accounts match "${target}": ${rows.map((r) => `${r.username} (${r.id})`).join(", ")}, use the account id`);

  await client.query("update users set role = $1 where id = $2", [role, user.id]);
  console.log(`${user.username} (${user.id}): ${user.role} -> ${role}`);
} finally {
  await client.end();
}
