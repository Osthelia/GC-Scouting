/**
 * GC-Scouting - interactions index
 *
 * Registry of every command and component handler.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

import type { CommandHandler, ComponentHandler } from "./types";
import feed from "./commands/feed";
import moderation from "./commands/moderation";
import ping from "./commands/ping";
import feedButtons from "./buttons/feed";
import mod from "./buttons/mod";
import report from "./buttons/report";

// Explicit registry, so the build and the typecheck see every handler.
const COMMANDS: CommandHandler[] = [ping, feed, moderation];
const COMPONENTS: ComponentHandler[] = [feedButtons, mod, report];

export const commands = new Map(COMMANDS.map((c) => [c.data.name, c]));
export const components = new Map(COMPONENTS.map((c) => [c.prefix, c]));
