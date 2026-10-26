/**
 * GC-Scouting - feed
 *
 * Feed configuration flow: filters, language, channel and the setup message.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

import {
  ButtonStyle,
  ChannelType,
  ComponentType,
  MessageFlags,
  TextInputStyle,
  type APIComponentInContainer,
  type APIModalInteractionResponseCallbackData,
  type APISelectMenuOption,
  type RESTPostAPIChannelMessageJSONBody,
} from "discord-api-types/v10";
import { eq } from "drizzle-orm";
import { discordChannels } from "@scouting/db/schema";
import {
  AGE_GROUPS,
  AGENT_CLASSES,
  AGENT_ROLES,
  COMPENSATIONS,
  LAN_OPTIONS,
  EXPERIENCE_MONTHS,
  FILTER_AGENTS_MAX,
  FILTER_DAY_STEPS,
  FILTER_HOUR_STEPS,
  IGL_ROLES,
  LANGUAGES,
  POST_TYPES,
  RANK_KEYS,
  REGIONS,
  ROSTER_SPOTS,
  STAFF_ROLES,
  TOURNAMENT_LEVELS,
  VALORANT_AGENTS,
  postFiltersSchema,
  type PostFilters,
} from "@scouting/db";
import type { BotContext } from "../core/context";
import { DiscordApiError, editMessage, fetchChannel, sendMessage } from "../core/discord";
import { isLocale, label, postTypeLabel, t, type LabelGroup, type Locale } from "../core/i18n";
import { customId } from "../interactions/types";
import { configFilters, FEEDS_PER_GUILD_MAX, findChannelConfig, listGuildFeeds } from "./channels";
import { decodeFilterDraft, describeFilters, encodeFilterDraft, filtersLink, LINK_MAX } from "./filters";
import { duration, languageName, postCode, rankLabel, truncate } from "./format";
import { actionButton, buttonRow, linkButton } from "./post-message";

export const FEED_ACCENT = 0x9b7bff;

/**
 * A feed being set up, carried by the custom ids of its buttons and modals.
 * `messageId` is the "Scouting posts" message to edit, null to post a new one.
 */
export type FeedSession = { channelId: string; messageId: string | null; locale: Locale; filters: PostFilters };

const SNOWFLAKE = /^\d{17,20}$/;
export const FEED_CHANNEL_TYPES: (ChannelType.GuildText | ChannelType.GuildAnnouncement)[] = [ChannelType.GuildText, ChannelType.GuildAnnouncement];
/** Ignored link params shown back, they are typed by the user. */
const IGNORED_SHOWN_MAX = 10;
const IGNORED_LENGTH_MAX = 30;

export function sessionId(action: string, session: FeedSession): string {
  return customId("feed", action, session.channelId, session.messageId ?? "0", session.locale, encodeFilterDraft(session.filters));
}

export function parseSession([channelId, messageId, locale, draft]: string[]): FeedSession | null {
  const filters = draft ? decodeFilterDraft(draft) : null;
  if (!channelId || !SNOWFLAKE.test(channelId) || !isLocale(locale) || !filters) return null;
  return { channelId, messageId: messageId && SNOWFLAKE.test(messageId) ? messageId : null, locale, filters };
}

const text = (content: string): APIComponentInContainer => ({ type: ComponentType.TextDisplay, content });
const separator: APIComponentInContainer = { type: ComponentType.Separator };

function container(components: APIComponentInContainer[]): RESTPostAPIChannelMessageJSONBody {
  return { flags: MessageFlags.IsComponentsV2, components: [{ type: ComponentType.Container, accent_color: FEED_ACCENT, components }] };
}

/** "Scouting posts" message of the channel, also proves the bot can write there. */
export function welcomeMessage(locale: Locale, filters: PostFilters, appUrl: string, enabled: boolean): RESTPostAPIChannelMessageJSONBody {
  return container([
    text(`## ${t(locale, "feed.welcome.title")}\n${t(locale, "feed.welcome.text")}`),
    text(describeFilters(locale, filters).join("\n")),
    ...(enabled ? [] : [text(`-# ${t(locale, "feed.welcome.pausedState")}`)]),
    buttonRow([
      linkButton(t(locale, "feed.welcome.button"), filtersLink(appUrl, locale, filters)),
      actionButton(t(locale, "feed.welcome.edit"), customId("feed", "edit"), ButtonStyle.Secondary),
      enabled
        ? actionButton(t(locale, "feed.welcome.pause"), customId("feed", "pause"), ButtonStyle.Secondary)
        : actionButton(t(locale, "feed.welcome.resume"), customId("feed", "resume"), ButtonStyle.Success),
    ]),
  ]);
}

/** The two ways to pick the filters: a link copied from the site, or the editor. */
export function setupMessage(locale: Locale, session: FeedSession, appUrl: string, siteFilters = session.filters): RESTPostAPIChannelMessageJSONBody {
  const channel = `<#${session.channelId}>`;
  return container([
    text(`## ${t(locale, "feed.setup.title", { channel })}\n${t(locale, "feed.setup.text", { channel })}`),
    separator,
    text(`### ${t(locale, "feed.setup.site.title")}\n${t(locale, "feed.setup.site.steps", { button: t(locale, "feed.setup.site.paste") })}`),
    buttonRow([
      linkButton(t(locale, "feed.setup.site.open"), filtersLink(appUrl, locale, siteFilters)),
      actionButton(t(locale, "feed.setup.site.paste"), sessionId("link", session), ButtonStyle.Primary),
    ]),
    separator,
    text(`### ${t(locale, "feed.setup.manual.title")}\n${t(locale, "feed.setup.manual.text")}`),
    buttonRow([actionButton(t(locale, "feed.setup.manual.button"), sessionId("manual", session), ButtonStyle.Primary)]),
  ]);
}

export const FILTER_GROUPS = ["posts", "profile", "terms", "level", "agents"] as const;
export type FilterGroup = (typeof FILTER_GROUPS)[number];

export function isFilterGroup(value: unknown): value is FilterGroup {
  return (FILTER_GROUPS as readonly unknown[]).includes(value);
}

/** Filters picked group by group, applied once saved. */
export function editorMessage(locale: Locale, session: FeedSession): RESTPostAPIChannelMessageJSONBody {
  return container([
    text(`## ${t(locale, "feed.setup.title", { channel: `<#${session.channelId}>` })}\n-# ${t(locale, "feed.editor.hint")}`),
    separator,
    text(describeFilters(locale, session.filters).join("\n")),
    separator,
    buttonRow(FILTER_GROUPS.map((group) => actionButton(t(locale, `feed.editor.groups.${group}`), sessionId(group, session), ButtonStyle.Secondary))),
    buttonRow([
      actionButton(t(locale, "feed.editor.save"), sessionId("save", session), ButtonStyle.Success),
      actionButton(t(locale, "feed.editor.clear"), sessionId("clear", session), ButtonStyle.Danger),
      actionButton(t(locale, "feed.editor.back"), sessionId("back", session), ButtonStyle.Secondary),
    ]),
  ]);
}

/** Replaces the setup message once the feed is saved. */
export function savedMessage(locale: Locale, channelId: string, filters: PostFilters, added: boolean, ignored: string[] = []): RESTPostAPIChannelMessageJSONBody {
  const lines = [`### ${t(locale, added ? "feed.added" : "feed.updated", { channel: `<#${channelId}>` })}`, ...describeFilters(locale, filters)];
  if (ignored.length) {
    const params = ignored.slice(0, IGNORED_SHOWN_MAX).map((key) => `\`${truncate(key, IGNORED_LENGTH_MAX).replace(/`/g, "'")}\``);
    if (ignored.length > IGNORED_SHOWN_MAX) params.push("…");
    lines.push(`-# ${t(locale, "feed.ignored", { params: params.join(", ") })}`);
  }
  return container([text(lines.join("\n"))]);
}

export const LINK_INPUT = "link";

export function linkModal(locale: Locale, session: FeedSession, appUrl: string): APIModalInteractionResponseCallbackData {
  return {
    custom_id: sessionId("link", session),
    title: t(locale, "feed.link.title"),
    components: [
      {
        type: ComponentType.Label,
        label: t(locale, "feed.link.label"),
        description: t(locale, "feed.link.hint", { site: new URL(appUrl).host }),
        component: { type: ComponentType.TextInput, custom_id: LINK_INPUT, style: TextInputStyle.Short, min_length: 1, max_length: LINK_MAX, required: true },
      },
    ],
  };
}

type DraftKey = Exclude<keyof PostFilters, "slot" | "week">;

/** One select of a filter modal. Several selects can fill the same key (languages, agents). */
type FilterSelect = { id: string; key: DraftKey; label: string; description?: string; options: APISelectMenuOption[]; single?: boolean };

// A select holds 25 options at most.
const LANGUAGES_SPLIT = Math.ceil(LANGUAGES.length / 2);

function groupSelects(locale: Locale, group: FilterGroup, filters: PostFilters): FilterSelect[] {
  const list = (key: DraftKey, values: readonly string[], labelGroup: LabelGroup): FilterSelect => ({
    id: key,
    key,
    label: t(locale, `filters.${key}`),
    options: values.map((value) => ({ value, label: label(locale, labelGroup, value) })),
  });
  const ranks = RANK_KEYS.map((_, i) => ({ value: String(i), label: rankLabel(i) }));
  const languages = (values: readonly string[]) => values.map((value) => ({ value, label: languageName(locale, value) }));

  switch (group) {
    case "posts":
      return [
        {
          id: "types",
          key: "types",
          label: t(locale, "filters.types"),
          options: POST_TYPES.map((type) => ({ value: type, label: postCode(type), description: postTypeLabel(locale, type) })),
        },
        list("regions", REGIONS, "regions"),
        { id: "languages", key: "languages", label: t(locale, "filters.languages"), options: languages(LANGUAGES.slice(0, LANGUAGES_SPLIT)) },
        { id: "languagesMore", key: "languages", label: t(locale, "feed.editor.languagesMore"), options: languages(LANGUAGES.slice(LANGUAGES_SPLIT)) },
        list("spots", ROSTER_SPOTS, "rosterSpots"),
      ];
    case "profile":
      return [
        list("roles", AGENT_ROLES, "roles"),
        list("igl", IGL_ROLES, "igl"),
        list("staffRoles", STAFF_ROLES, "staffRoles"),
      ];
    case "terms": {
      // A rhythm set from a site link may not be one of the steps.
      const hours = [...new Set([...FILTER_HOUR_STEPS.filter((h) => h > 0), ...(filters.minHours ? [filters.minHours] : [])])].sort((a, b) => a - b);
      return [
        list("compensation", COMPENSATIONS, "compensation"),
        list("lan", LAN_OPTIONS, "lan"),
        list("ages", AGE_GROUPS, "ageGroups"),
        {
          id: "minHours",
          key: "minHours",
          label: t(locale, "filters.minHours"),
          options: hours.map((h) => ({ value: String(h), label: t(locale, "filters.minHoursValue", { hours: h }) })),
          single: true,
        },
        {
          id: "minDays",
          key: "minDays",
          label: t(locale, "filters.minDays"),
          options: FILTER_DAY_STEPS.filter((d) => d > 0).map((d) => ({ value: String(d), label: t(locale, "filters.minDaysValue", { count: d }) })),
          single: true,
        },
      ];
    }
    case "level":
      return [
        { id: "rankMin", key: "rankMin", label: t(locale, "feed.editor.rankMin"), options: ranks, single: true },
        { id: "rankMax", key: "rankMax", label: t(locale, "feed.editor.rankMax"), options: ranks, single: true },
        { ...list("levels", TOURNAMENT_LEVELS, "levels"), label: t(locale, "feed.editor.levels") },
        {
          id: "minMonths",
          key: "minMonths",
          label: t(locale, "feed.editor.minMonths"),
          description: t(locale, "feed.editor.minMonthsHint"),
          options: EXPERIENCE_MONTHS.map((months) => ({ value: String(months), label: duration(locale, months) })),
          single: true,
        },
      ];
    case "agents":
      return AGENT_CLASSES.map((agentClass) => ({
        id: `agents_${agentClass}`,
        key: "agents",
        label: t(locale, `feed.editor.classes.${agentClass}`),
        description: t(locale, "feed.editor.agentsHint", { max: FILTER_AGENTS_MAX }),
        options: VALORANT_AGENTS.filter((a) => a.role === agentClass).map((a) => ({ value: a.slug, label: a.name })),
      }));
  }
}

function pickedValues(filters: PostFilters, key: DraftKey): string[] {
  const value = filters[key];
  if (value === undefined) return [];
  return Array.isArray(value) ? value.map(String) : [String(value)];
}

export function filterModal(locale: Locale, group: FilterGroup, session: FeedSession): APIModalInteractionResponseCallbackData {
  return {
    custom_id: sessionId(group, session),
    title: t(locale, `feed.editor.groups.${group}`),
    components: groupSelects(locale, group, session.filters).map((select) => {
      const picked = pickedValues(session.filters, select.key);
      return {
        type: ComponentType.Label,
        label: select.label,
        description: select.description,
        component: {
          type: ComponentType.StringSelect,
          custom_id: select.id,
          placeholder: t(locale, "feed.editor.placeholder"),
          required: false,
          min_values: 0,
          max_values: select.single ? 1 : select.options.length,
          options: select.options.map((option) => ({ ...option, default: picked.includes(option.value) })),
        },
      };
    }),
  };
}

/** Draft with the values picked in a filter modal, every value checked against its select. */
export function applyFilterModal(
  locale: Locale,
  group: FilterGroup,
  filters: PostFilters,
  read: (id: string) => string[] | null,
): { ok: true; filters: PostFilters } | { ok: false; error: string } {
  const selects = groupSelects(locale, group, filters);
  const next: Record<string, unknown> = { ...filters };
  for (const select of selects) delete next[select.key];

  for (const select of selects) {
    const values = read(select.id) ?? [];
    const allowed = new Set(select.options.map((o) => o.value));
    if (values.some((v) => !allowed.has(v)) || (select.single && values.length > 1)) {
      return { ok: false, error: t(locale, "feed.errors.invalidValue", { field: select.label }) };
    }
    if (!values.length) continue;
    next[select.key] = select.single ? Number(values[0]) : [...((next[select.key] as string[] | undefined) ?? []), ...values];
  }

  const agents = (next.agents as string[] | undefined)?.length ?? 0;
  if (agents > FILTER_AGENTS_MAX) return { ok: false, error: t(locale, "feed.errors.agentsMax", { max: FILTER_AGENTS_MAX, count: agents }) };
  if (typeof next.rankMin === "number" && typeof next.rankMax === "number" && next.rankMin > next.rankMax) {
    return { ok: false, error: t(locale, "feed.errors.rankOrder") };
  }
  const parsed = postFiltersSchema.safeParse(next);
  return parsed.success ? { ok: true, filters: parsed.data } : { ok: false, error: t(locale, "feed.errors.invalidDraft") };
}

/**
 * Saves the feed of the session: posts or edits its "Scouting posts" message, then stores the config.
 * `keepAvailability` keeps the availability already stored, the editor cannot set it.
 */
export async function saveFeed(
  ctx: BotContext,
  locale: Locale,
  input: { guildId: string; userId: string; session: FeedSession; filters: PostFilters; keepAvailability: boolean },
): Promise<{ ok: true; added: boolean; filters: PostFilters } | { ok: false; error: string }> {
  const { db, env } = ctx;
  const { guildId, userId, session } = input;
  const channel = `<#${session.channelId}>`;
  const existing = await findChannelConfig(db, session.channelId);

  if (existing?.kind === "moderation") return { ok: false, error: t(locale, "feed.errors.moderationChannel", { channel }) };
  if (existing && existing.guildId !== guildId) return { ok: false, error: t(locale, "feed.errors.notFound", { channel }) };
  if (!existing && (await listGuildFeeds(db, guildId)).length >= FEEDS_PER_GUILD_MAX) {
    return { ok: false, error: t(locale, "feed.errors.limit", { max: FEEDS_PER_GUILD_MAX }) };
  }

  const stored = existing ? configFilters(existing) : null;
  const merged: PostFilters = { ...input.filters };
  if (input.keepAvailability && stored?.slot) merged.slot = stored.slot;
  if (input.keepAvailability && stored?.week) merged.week = stored.week;
  // Only values of the shared schema are ever stored.
  const parsed = postFiltersSchema.safeParse(merged);
  if (!parsed.success) return { ok: false, error: t(locale, "feed.errors.invalidDraft") };
  const filters = parsed.data;
  // Editing keeps a paused feed paused, a new setup starts it.
  const enabled = session.messageId && existing ? existing.enabled : true;
  const message = welcomeMessage(session.locale, filters, env.APP_URL, enabled);

  try {
    // The channel id comes from a custom id: it must be a text channel of this server.
    const target = await fetchChannel(env, session.channelId);
    if (!("guild_id" in target) || target.guild_id !== guildId || !(FEED_CHANNEL_TYPES as ChannelType[]).includes(target.type)) {
      return { ok: false, error: t(locale, "feed.errors.notFound", { channel }) };
    }
    if (session.messageId) {
      await editMessage(env, session.channelId, session.messageId, message).catch((error) => {
        if (error instanceof DiscordApiError && error.unknownMessage) return sendMessage(env, session.channelId, message);
        throw error;
      });
    } else {
      await sendMessage(env, session.channelId, message);
    }
  } catch (error) {
    if (error instanceof DiscordApiError && error.channelUnreachable) return { ok: false, error: t(locale, "errors.channelUnreachable", { channel }) };
    throw error;
  }

  const values = { filters, locale: session.locale, enabled };
  if (existing) {
    await db.update(discordChannels).set(values).where(eq(discordChannels.id, existing.id));
  } else {
    await db
      .insert(discordChannels)
      .values({ guildId, channelId: session.channelId, kind: "feed", createdByDiscordId: userId, ...values })
      .onConflictDoUpdate({ target: discordChannels.channelId, set: values });
  }
  return { ok: true, added: !existing, filters };
}
