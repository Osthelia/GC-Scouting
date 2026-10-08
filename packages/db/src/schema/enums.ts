/**
 * GC-Scouting - enums
 *
 * Postgres enums.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

import { pgEnum } from "drizzle-orm/pg-core";
import {
  ACTION_TOKEN_ACTIONS,
  AGE_GROUPS,
  AGENT_ROLES,
  COMPENSATIONS,
  DISCORD_CHANNEL_KINDS,
  IGL_ROLES,
  LAN_OPTIONS,
  MESSAGE_STATUSES,
  MODERATION_ACTIONS,
  PLAYER_LINK_STATUSES,
  POST_STATUSES,
  POST_TYPES,
  REGIONS,
  REPORT_REASONS,
  REPORT_STATUSES,
  ROSTER_SPOTS,
  STAFF_ROLES,
  TOURNAMENT_LEVELS,
  TWEET_BY,
  USER_ROLES,
} from "../constants";

export const postTypeEnum = pgEnum("post_type", POST_TYPES);
export const postStatusEnum = pgEnum("post_status", POST_STATUSES);
export const regionEnum = pgEnum("region", REGIONS);
export const agentRoleEnum = pgEnum("agent_role", AGENT_ROLES);
export const iglRoleEnum = pgEnum("igl_role", IGL_ROLES);
export const rosterSpotEnum = pgEnum("roster_spot", ROSTER_SPOTS);
export const staffRoleEnum = pgEnum("staff_role", STAFF_ROLES);
export const ageGroupEnum = pgEnum("age_group", AGE_GROUPS);
export const compensationEnum = pgEnum("compensation", COMPENSATIONS);
export const lanOptionEnum = pgEnum("lan_option", LAN_OPTIONS);
export const tournamentLevelEnum = pgEnum("tournament_level", TOURNAMENT_LEVELS);
export const tweetByEnum = pgEnum("tweet_by", TWEET_BY);
export const playerLinkStatusEnum = pgEnum("player_link_status", PLAYER_LINK_STATUSES);
export const actionTokenActionEnum = pgEnum("action_token_action", ACTION_TOKEN_ACTIONS);
export const discordChannelKindEnum = pgEnum("discord_channel_kind", DISCORD_CHANNEL_KINDS);
export const moderationActionEnum = pgEnum("moderation_action", MODERATION_ACTIONS);
export const reportReasonEnum = pgEnum("report_reason", REPORT_REASONS);
export const reportStatusEnum = pgEnum("report_status", REPORT_STATUSES);
export const userRoleEnum = pgEnum("user_role", USER_ROLES);
export const messageStatusEnum = pgEnum("message_status", MESSAGE_STATUSES);
