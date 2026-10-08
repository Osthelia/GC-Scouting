/**
 * GC-Scouting - post-message
 *
 * Builds the Discord message that announces a post.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

import {
  ButtonStyle,
  ComponentType,
  MessageFlags,
  SeparatorSpacingSize,
  type APIActionRowComponent,
  type APIButtonComponent,
  type APIComponentInContainer,
  type APIContainerComponent,
  type APISeparatorComponent,
  type RESTPostAPIChannelMessageJSONBody,
} from "discord-api-types/v10";
import { RANK_KEYS, REGION_COLORS, shareImageUrl } from "@scouting/db";
import { trackerUrl } from "@scouting/db/tracker";
import { label, postTypeLabel, t, type Locale } from "../core/i18n";
import { agentName, escapeMarkdown, experienceText, flagEmoji, hexColor, languageName, postCode, rankLabel, rankRange, truncate } from "./format";
import type { BotPost } from "./posts";

const DESCRIPTION_MAX = 300;
const AGENTS_MAX = 5;

export function postUrl(appUrl: string, locale: Locale, post: Pick<BotPost, "id" | "type">): string {
  return `${appUrl.replace(/\/$/, "")}/${locale}/posts/${post.type}/${post.id}`;
}

export function linkButton(text: string, url: string): APIButtonComponent {
  return { type: ComponentType.Button, style: ButtonStyle.Link, label: text, url };
}

export function actionButton(text: string, id: string, style: Exclude<ButtonStyle, ButtonStyle.Link | ButtonStyle.Premium>, disabled = false): APIButtonComponent {
  return { type: ComponentType.Button, style, label: text, custom_id: id, disabled };
}

export function buttonRow(buttons: APIButtonComponent[]): APIActionRowComponent<APIButtonComponent> {
  return { type: ComponentType.ActionRow, components: buttons };
}

const separator = (divider = true): APISeparatorComponent => ({ type: ComponentType.Separator, divider, spacing: SeparatorSpacingSize.Small });

/** Rank shown as thumbnail: current rank of a player, top of the range of a team. */
function thumbnailRank(post: BotPost): number | null {
  return post.rankCurrent ?? post.rankMax ?? post.rankMin;
}

function rankText(locale: Locale, post: BotPost): string | null {
  if (post.rankCurrent !== null) {
    const peak = post.rankPeak !== null && post.rankPeak !== post.rankCurrent ? ` · ${t(locale, "post.peak", { rank: rankLabel(post.rankPeak) })}` : "";
    return rankLabel(post.rankCurrent) + peak;
  }
  if (post.rankMin !== null || post.rankMax !== null) return rankRange(locale, post.rankMin, post.rankMax);
  return null;
}

/** "**Label** value" lines, empty values skipped. */
function lines(locale: Locale, entries: [key: string, value: string | null][]): string | null {
  const kept = entries.filter(([, value]) => value).map(([key, value]) => `**${t(locale, `post.${key}`)}** ${value}`);
  return kept.length ? kept.join("\n") : null;
}

const join = (values: string[]) => (values.length ? values.join(" · ") : null);

/** Who the post is about: rank, roles, staff roles, agents, compensation, LAN, age. */
function profileBlock(locale: Locale, post: BotPost): string | null {
  const roles = [...post.roles.map((r) => label(locale, "roles", r)), ...post.igl.map((r) => label(locale, "igl", r))];
  return lines(locale, [
    [post.rankCurrent !== null ? "rank" : "rankWanted", rankText(locale, post)],
    ["roles", join(roles)],
    ["staffRoles", join(post.staffRoles.map((r) => label(locale, "staffRoles", r)))],
    ["agents", join(post.strongAgents.slice(0, AGENTS_MAX).map(agentName))],
    ["compensation", post.compensation && label(locale, "compensation", post.compensation)],
    ["lan", post.lan && label(locale, "lan", post.lan)],
    ["ageGroup", post.ageGroup && label(locale, "ageGroups", post.ageGroup)],
    ["minorsAccepted", post.minorsAccepted === null ? null : label(locale, "minorsPolicy", post.minorsAccepted ? "accepted" : "adultsOnly")],
  ]);
}

/** Agent reached by the contact details of the post. */
function agentText(post: BotPost): string | null {
  const agent = post.contact.agent;
  if (!agent) return null;
  return escapeMarkdown(agent.name) + (agent.agency ? ` (${escapeMarkdown(agent.agency)})` : "");
}

/** How it would work: experience, languages, rhythm, contact agent. */
function practicalBlock(locale: Locale, post: BotPost): string | null {
  const rhythm =
    post.weeklyMinutes > 0 ? t(locale, "post.rhythmValue", { hours: Math.round((post.weeklyMinutes / 60) * 10) / 10, days: post.activeDays }) : null;
  return lines(locale, [
    ["experience", experienceText(locale, post.experience, (level) => label(locale, "levels", level), { separator: " · " })],
    ["languages", join(post.languages.map((code) => languageName(locale, code)))],
    ["rhythm", rhythm],
    ["agent", agentText(post)],
  ]);
}

function header(locale: Locale, post: BotPost): string {
  const region = `${flagEmoji(post.country)} ${label(locale, "regions", post.region)}`.trim();
  const subtitle = [region, post.rosterSpot && label(locale, "rosterSpots", post.rosterSpot)].filter(Boolean).join(" · ");
  const renewed = post.bumpedAt.getTime() !== post.publishedAt.getTime();
  // Discord renders the timestamp in the reader's language and timezone.
  const date = t(locale, renewed ? "post.renewed" : "post.published", { date: `<t:${Math.floor(post.bumpedAt.getTime() / 1000)}:R>` });
  return `## ${escapeMarkdown(post.displayName)} (${postCode(post.type)})\n${subtitle}\n-# ${postTypeLabel(locale, post.type)} · ${date}`;
}

/** The post itself, accent in the color of its region. */
export function postContainer(post: BotPost, locale: Locale, appUrl: string): APIContainerComponent {
  const rank = thumbnailRank(post);
  const rankKey = rank === null ? undefined : RANK_KEYS[rank];
  const title = header(locale, post);

  const body: APIComponentInContainer[] = [
    rankKey
      ? {
          type: ComponentType.Section,
          components: [{ type: ComponentType.TextDisplay, content: title }],
          accessory: {
            type: ComponentType.Thumbnail,
            media: { url: `${appUrl.replace(/\/$/, "")}/valorant/ranks/${rankKey}.webp` },
            description: rankLabel(rank!),
          },
        }
      : { type: ComponentType.TextDisplay, content: title },
  ];

  for (const block of [profileBlock(locale, post), practicalBlock(locale, post)]) {
    if (block) body.push(separator(), { type: ComponentType.TextDisplay, content: block });
  }

  // Share image rendered by the site, versioned so an edited tierlist is fetched again.
  if (post.tierList) {
    body.push({
      type: ComponentType.MediaGallery,
      items: [{ media: { url: shareImageUrl(appUrl, post) }, description: t(locale, "post.tierlist", { name: post.displayName }) }],
    });
  }

  const description = post.description.trim();
  if (description) {
    body.push(separator(), {
      type: ComponentType.TextDisplay,
      content: escapeMarkdown(truncate(description, DESCRIPTION_MAX))
        .split("\n")
        .map((l) => `> ${l}`)
        .join("\n"),
    });
  }

  const buttons = [linkButton(t(locale, "post.view"), postUrl(appUrl, locale, post))];
  if (post.trackerRiotId) buttons.push(linkButton(t(locale, "post.tracker"), trackerUrl(post.trackerRiotId)));
  body.push(separator(false), buttonRow(buttons));
  return { type: ComponentType.Container, accent_color: hexColor(REGION_COLORS[post.region]), components: body };
}

/** Message posted in a feed channel. */
export function feedMessage(post: BotPost, locale: Locale, appUrl: string): RESTPostAPIChannelMessageJSONBody {
  return { flags: MessageFlags.IsComponentsV2, components: [postContainer(post, locale, appUrl)] };
}
