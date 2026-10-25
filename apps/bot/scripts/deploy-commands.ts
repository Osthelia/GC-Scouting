/**
 * GC-Scouting - deploy-commands
 *
 * Registers the bot slash commands with Discord (run once after a command change).
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

import { Routes } from "discord-api-types/v10";
import { commands } from "../src/interactions";

// Registers the slash commands: `global` ones everywhere, `moderation` ones on the moderation server only.
// Reads .env locally, the environment otherwise. Run after adding or changing a command.

try {
  process.loadEnvFile(".env");
} catch {}

const { DISCORD_APPLICATION_ID: applicationId, DISCORD_BOT_TOKEN: token, MODERATION_GUILD_ID: moderationGuildId } = process.env;
if (!applicationId || !token || !moderationGuildId) {
  console.error("DISCORD_APPLICATION_ID, DISCORD_BOT_TOKEN and MODERATION_GUILD_ID are required.");
  process.exit(1);
}

async function put(route: `/${string}`, body: unknown[]): Promise<void> {
  const response = await fetch(`https://discord.com/api/v10${route}`, {
    method: "PUT",
    headers: { Authorization: `Bot ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`${route} answered ${response.status}: ${await response.text()}`);
  console.log(`${route}: ${body.length} command(s)`);
}

const all = [...commands.values()];
await put(Routes.applicationCommands(applicationId), all.filter((c) => c.scope === "global").map((c) => c.data));
await put(Routes.applicationGuildCommands(applicationId, moderationGuildId), all.filter((c) => c.scope === "moderation").map((c) => c.data));
