/**
 * GC-Scouting - mod
 *
 * Button and modal handlers of moderation messages (remove post, dismiss report).
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

import { ComponentType, TextInputStyle } from "discord-api-types/v10";
import type { ComponentHandler } from "../types";
import { customId } from "../types";
import { modalValue, moderatorGuard, parseId } from "../shared";
import { t, toLocale } from "../../core/i18n";
import { deferredUpdate, openModal, reply } from "../../core/responses";
import { configLocale } from "../../modules/channels";
import { loadReport, refreshModeration, removeFromFeeds, syncPost } from "../../modules/delivery";
import { markTweeted, REASON_MAX, REASON_MIN, removePost, restorePost } from "../../modules/moderation";
import { moderationMessage, reportMessage } from "../../modules/moderation-message";
import { loadPost, moderationRemoval } from "../../modules/posts";
import { cleanText } from "@scouting/db/text-input";

const REASON_INPUT = "reason";

// Custom ids: mod:remove:{postId}[:{reportId}], mod:restore:{postId}, mod:tweeted:{postId}.
export default {
  prefix: "mod",

  async button(interaction, ctx, [action, rawPostId, rawReportId]) {
    const locale = toLocale(interaction.locale);
    const postId = parseId(rawPostId);
    if (!postId || !["remove", "restore", "tweeted"].includes(action ?? "")) return reply(t(locale, "errors.unknownInteraction"));

    // A modal must be the immediate answer, the guard runs before it.
    if (action === "remove") {
      const guard = await moderatorGuard(interaction, ctx, locale);
      if (!guard.ok) return reply(guard.error);
      return openModal({
        custom_id: customId("mod", "remove", postId, parseId(rawReportId) ?? ""),
        title: t(locale, "mod.modal.title"),
        components: [
          {
            type: ComponentType.Label,
            label: t(locale, "mod.modal.reason"),
            description: t(locale, "mod.modal.reasonHint", { min: REASON_MIN, max: REASON_MAX }),
            component: {
              type: ComponentType.TextInput,
              custom_id: REASON_INPUT,
              style: TextInputStyle.Paragraph,
              min_length: REASON_MIN,
              max_length: REASON_MAX,
              required: true,
            },
          },
        ],
      });
    }

    return deferredUpdate(ctx, interaction.token, locale, async () => {
      const guard = await moderatorGuard(interaction, ctx, locale);
      if (!guard.ok) return guard;

      if (action === "restore") {
        const result = await restorePost(ctx.db, postId, guard.userId);
        if (result !== "ok") return { error: t(locale, `mod.errors.${result}`) };
        // Feed messages were deleted on removal, the post goes out again.
        ctx.defer(() => syncPost(ctx, postId));
      } else {
        const result = await markTweeted(ctx.db, postId, { discordUserId: guard.userId });
        if (result !== "ok") return { error: t(locale, `mod.errors.${result}`) };
      }
      ctx.defer(() => refreshModeration(ctx, postId, interaction.message.id));

      const post = await loadPost(ctx.db, postId);
      if (!post) return { error: t(locale, "mod.errors.notFound") };
      return { update: moderationMessage(post, await moderationRemoval(ctx.db, post), configLocale(guard.config), ctx.env.APP_URL) };
    });
  },

  async modal(interaction, ctx, [action, rawPostId, rawReportId]) {
    const locale = toLocale(interaction.locale);
    const postId = parseId(rawPostId);
    if (action !== "remove" || !postId) return reply(t(locale, "errors.unknownInteraction"));
    const reportId = parseId(rawReportId);

    const { text: reason, invalid } = cleanText(modalValue(interaction, REASON_INPUT), { multiline: true });
    if (invalid) return reply(t(locale, "mod.errors.invalidCharacters"));
    if (reason.length < REASON_MIN || reason.length > REASON_MAX) {
      return reply(t(locale, "mod.errors.reasonLength", { min: REASON_MIN, max: REASON_MAX }));
    }

    return deferredUpdate(ctx, interaction.token, locale, async () => {
      const guard = await moderatorGuard(interaction, ctx, locale);
      if (!guard.ok) return guard;

      const result = await removePost(ctx.db, postId, guard.userId, reason, reportId);
      if (result !== "ok") return { error: t(locale, `mod.errors.${result}`) };

      const messageId = interaction.message?.id;
      ctx.defer(() => refreshModeration(ctx, postId, messageId));
      ctx.defer(() => removeFromFeeds(ctx, postId));

      const post = await loadPost(ctx.db, postId);
      if (!post) return { error: t(locale, "mod.errors.notFound") };
      const channelLocale = configLocale(guard.config);
      const report = reportId ? await loadReport(ctx.db, reportId) : null;
      // The modal came from either the post card or one of its reports.
      return {
        update:
          report && report.moderationMessageId === messageId
            ? reportMessage(report, post, channelLocale, ctx.env.APP_URL)
            : moderationMessage(post, await moderationRemoval(ctx.db, post), channelLocale, ctx.env.APP_URL),
      };
    });
  },
} satisfies ComponentHandler;
