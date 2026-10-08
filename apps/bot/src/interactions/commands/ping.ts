/**
 * GC-Scouting - ping
 *
 * Health check slash command.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

import type { CommandHandler } from "../types";
import { localized, t, toLocale } from "../../core/i18n";
import { reply } from "../../core/responses";

export default {
  scope: "global",
  data: { name: "ping", ...localized("commands.ping.description") },
  async execute(interaction) {
    return reply(t(toLocale(interaction.locale), "ping.reply"));
  },
} satisfies CommandHandler;
