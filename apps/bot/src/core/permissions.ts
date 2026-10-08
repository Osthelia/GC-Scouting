/**
 * GC-Scouting - permissions
 *
 * Permission checks on the member attached to an interaction.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

import { PermissionFlagsBits, type APIInteractionGuildMember } from "discord-api-types/v10";

// Permissions and roles arrive with the interaction, no gateway intent needed.

function has(member: APIInteractionGuildMember, flag: bigint): boolean {
  return (BigInt(member.permissions) & flag) !== 0n;
}

export function canManageGuild(member: APIInteractionGuildMember | undefined): boolean {
  return !!member && (has(member, PermissionFlagsBits.Administrator) || has(member, PermissionFlagsBits.ManageGuild));
}

export function isAdministrator(member: APIInteractionGuildMember | undefined): boolean {
  return !!member && has(member, PermissionFlagsBits.Administrator);
}

/** Moderators: the configured role, or administrators. */
export function isModerator(member: APIInteractionGuildMember | undefined, roleId: string | null): boolean {
  if (!member) return false;
  return (roleId !== null && member.roles.includes(roleId)) || has(member, PermissionFlagsBits.Administrator);
}
