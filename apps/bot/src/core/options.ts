/**
 * GC-Scouting - options
 *
 * Typed reader for slash command options.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

import {
  ApplicationCommandOptionType,
  type APIApplicationCommandInteractionDataBasicOption,
  type APIApplicationCommandInteractionDataOption,
  type APIChatInputApplicationCommandInteraction,
  type APIInteractionDataResolvedChannel,
  type APIRole,
} from "discord-api-types/v10";

/** Subcommand name and its options, read from a chat input interaction. */
export class CommandOptions {
  readonly subcommand: string | null;
  private readonly values: Map<string, APIApplicationCommandInteractionDataBasicOption>;

  constructor(private readonly interaction: APIChatInputApplicationCommandInteraction) {
    let options: APIApplicationCommandInteractionDataOption[] = interaction.data.options ?? [];
    const sub = options.find((o) => o.type === ApplicationCommandOptionType.Subcommand);
    this.subcommand = sub?.name ?? null;
    if (sub && sub.type === ApplicationCommandOptionType.Subcommand) options = sub.options ?? [];
    this.values = new Map(
      options
        .filter((o): o is APIApplicationCommandInteractionDataBasicOption => o.type !== ApplicationCommandOptionType.Subcommand && o.type !== ApplicationCommandOptionType.SubcommandGroup)
        .map((o) => [o.name, o]),
    );
  }

  string(name: string): string | null {
    const option = this.values.get(name);
    return option?.type === ApplicationCommandOptionType.String ? option.value.trim() : null;
  }

  channel(name: string): APIInteractionDataResolvedChannel | null {
    const option = this.values.get(name);
    if (option?.type !== ApplicationCommandOptionType.Channel) return null;
    return this.interaction.data.resolved?.channels?.[option.value] ?? null;
  }

  role(name: string): APIRole | null {
    const option = this.values.get(name);
    if (option?.type !== ApplicationCommandOptionType.Role) return null;
    return this.interaction.data.resolved?.roles?.[option.value] ?? null;
  }
}
