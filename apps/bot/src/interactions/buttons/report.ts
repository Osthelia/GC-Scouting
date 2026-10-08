/**
 * GC-Scouting - report
 *
 * Button handlers attached to report messages.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

import type { ComponentHandler } from "../types";
import { moderatorGuard, parseId } from "../shared";
import { t, toLocale } from "../../core/i18n";
import { deferredUpdate, reply } from "../../core/responses";
import { configLocale } from "../../modules/channels";
import { loadReport } from "../../modules/delivery";
import { dismissReport } from "../../modules/moderation";
import { reportMessage } from "../../modules/moderation-message";
import { loadPost } from "../../modules/posts";

// Custom id: report:dismiss:{reportId}. Removing the post goes through the `mod` modal.
export default {
  prefix: "report",

  async button(interaction, ctx, [action, rawReportId]) {
    const locale = toLocale(interaction.locale);
    const reportId = parseId(rawReportId);
    if (action !== "dismiss" || !reportId) return reply(t(locale, "errors.unknownInteraction"));

    return deferredUpdate(ctx, interaction.token, locale, async () => {
      const guard = await moderatorGuard(interaction, ctx, locale);
      if (!guard.ok) return guard;

      const result = await dismissReport(ctx.db, reportId, guard.userId);
      if (result !== "ok") return { error: t(locale, `report.errors.${result}`) };

      const report = await loadReport(ctx.db, reportId);
      const post = report && (await loadPost(ctx.db, report.postId));
      if (!report || !post) return { error: t(locale, "report.dismissed") };
      return { update: reportMessage(report, post, configLocale(guard.config), ctx.env.APP_URL) };
    });
  },
} satisfies ComponentHandler;
