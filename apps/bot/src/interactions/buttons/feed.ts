/**
 * GC-Scouting - feed
 *
 * Button and modal handlers of the feed setup message.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

import type { APIMessageComponentInteraction, APIModalSubmitInteraction } from "discord-api-types/v10";
import { and, eq } from "drizzle-orm";
import type { PostFilters } from "@scouting/db";
import { discordChannels } from "@scouting/db/schema";
import type { ComponentHandler } from "../types";
import { modalSelectValues, modalValue } from "../shared";
import type { BotContext } from "../../core/context";
import { t, toLocale, type Locale } from "../../core/i18n";
import { canManageGuild } from "../../core/permissions";
import { deferredUpdate, openModal, reply, replyComponents, updateMessage, type ComponentOutcome } from "../../core/responses";
import { configFilters, configLocale, findChannelConfig } from "../../modules/channels";
import {
  applyFilterModal,
  editorMessage,
  filterModal,
  isFilterGroup,
  LINK_INPUT,
  linkModal,
  parseSession,
  savedMessage,
  saveFeed,
  setupMessage,
  welcomeMessage,
  type FeedSession,
} from "../../modules/feed";
import { filtersFromLink } from "../../modules/filters";

/** Feed buttons and modals are for members who can manage the server. */
function guard(interaction: APIMessageComponentInteraction | APIModalSubmitInteraction, locale: Locale): { guildId: string; userId: string } | string {
  const guildId = interaction.guild_id;
  const userId = interaction.member?.user.id;
  if (!guildId || !userId) return t(locale, "errors.guildOnly");
  if (!canManageGuild(interaction.member)) return t(locale, "errors.manageGuild");
  return { guildId, userId };
}

/** Saves the feed in the background and turns the setup message into a confirmation. */
function save(
  interaction: APIMessageComponentInteraction | APIModalSubmitInteraction,
  ctx: BotContext,
  locale: Locale,
  input: { guildId: string; userId: string; session: FeedSession; filters: PostFilters; keepAvailability: boolean; ignored?: string[] },
) {
  return deferredUpdate(ctx, interaction.token, locale, async (): Promise<ComponentOutcome> => {
    const result = await saveFeed(ctx, locale, input);
    if (!result.ok) return { error: result.error };
    return { update: savedMessage(locale, input.session.channelId, result.filters, result.added, input.ignored) };
  });
}

// Custom ids: feed:{edit|pause|resume} on the "Scouting posts" message,
// feed:{action}:{channelId}:{messageId}:{locale}:{filters} on the setup message and its modals.
export default {
  prefix: "feed",

  async button(interaction, ctx, [action, ...args]) {
    const locale = toLocale(interaction.locale);
    const member = guard(interaction, locale);
    if (typeof member === "string") return reply(member);

    if (action === "edit" || action === "pause" || action === "resume") {
      const channelId = interaction.channel.id;
      const config = await findChannelConfig(ctx.db, channelId);
      if (!config || config.kind !== "feed" || config.guildId !== member.guildId) {
        return reply(t(locale, "feed.errors.notFound", { channel: `<#${channelId}>` }));
      }
      const filters = configFilters(config) ?? {};

      if (action === "edit") {
        const session: FeedSession = { channelId, messageId: interaction.message.id, locale: configLocale(config), filters };
        return replyComponents(setupMessage(locale, session, ctx.env.APP_URL, filters).components ?? []);
      }

      const enabled = action === "resume";
      return deferredUpdate(ctx, interaction.token, locale, async () => {
        await ctx.db
          .update(discordChannels)
          .set({ enabled })
          .where(and(eq(discordChannels.id, config.id), eq(discordChannels.guildId, member.guildId)));
        return { update: welcomeMessage(configLocale(config), filters, ctx.env.APP_URL, enabled) };
      });
    }

    const session = parseSession(args);
    if (!session) return reply(t(locale, "feed.errors.expired"));

    if (isFilterGroup(action)) return openModal(filterModal(locale, action, session));
    switch (action) {
      case "link":
        return openModal(linkModal(locale, session, ctx.env.APP_URL));
      case "manual":
        return updateMessage(editorMessage(locale, session));
      case "clear":
        return updateMessage(editorMessage(locale, { ...session, filters: {} }));
      case "back":
        return updateMessage(setupMessage(locale, session, ctx.env.APP_URL));
      case "save":
        return save(interaction, ctx, locale, { ...member, session, filters: session.filters, keepAvailability: true });
    }
    return reply(t(locale, "errors.unknownInteraction"));
  },

  async modal(interaction, ctx, [action, ...args]) {
    const locale = toLocale(interaction.locale);
    const member = guard(interaction, locale);
    if (typeof member === "string") return reply(member);
    const session = parseSession(args);
    if (!session) return reply(t(locale, "feed.errors.expired"));

    if (action === "link") {
      const parsed = filtersFromLink(modalValue(interaction, LINK_INPUT)?.trim() ?? "", ctx.env.APP_URL);
      if (!parsed.ok) {
        const appUrl = ctx.env.APP_URL.replace(/\/$/, "");
        return reply(t(locale, `feed.errors.${parsed.error}`, { site: new URL(appUrl).host, example: `${appUrl}/${locale}/posts/lft?regions=eu` }));
      }
      return save(interaction, ctx, locale, { ...member, session, filters: parsed.filters, keepAvailability: false, ignored: parsed.ignored });
    }

    if (isFilterGroup(action)) {
      const result = applyFilterModal(locale, action, session.filters, (id) => modalSelectValues(interaction, id));
      if (!result.ok) return reply(result.error);
      return updateMessage(editorMessage(locale, { ...session, filters: result.filters }));
    }
    return reply(t(locale, "errors.unknownInteraction"));
  },
} satisfies ComponentHandler;
