/**
 * GC-Scouting - moderation-message
 *
 * Builds the moderation messages for reports and removed posts.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

import { ButtonStyle, ComponentType, MessageFlags, type APIButtonComponent, type RESTPostAPIChannelMessageJSONBody } from "discord-api-types/v10";
import { reports } from "@scouting/db/schema";
import { REPORT_MESSAGE_MAX } from "@scouting/db/constants";
import { tweetStatusUrl } from "@scouting/db/twitter";
import { t, type Locale } from "../core/i18n";
import { customId } from "../interactions/types";
import { escapeMarkdown, postCode, truncate } from "./format";
import { actionButton, buttonRow, linkButton, postContainer, postUrl } from "./post-message";
import { TWEET_MAX, tweetDraft } from "./tweet";
import { isVisible, type BotPost, type Removal } from "./posts";

export type Report = typeof reports.$inferSelect & { reporterName: string | null; handlerName: string | null };

const REPORT_COLOR = 0xe8566c;

const mention = (discordId: string) => `<@${discordId}>`;

function postStatus(locale: Locale, post: BotPost, removal: Removal | null): string {
  if (removal) {
    const by = removal.by;
    return removal.reason ? t(locale, "mod.status.removedReason", { user: by, reason: escapeMarkdown(removal.reason) }) : t(locale, "mod.status.removed", { user: by });
  }
  if (post.status === "removed") return t(locale, "mod.status.deleted");
  if (post.status === "closed") return t(locale, "mod.status.closed");
  if (post.expiresAt <= new Date()) return t(locale, "mod.status.expired");
  return t(locale, "mod.status.active");
}

/** Who tweets the post and where it stands: tweeted, retweeted, or waiting for the author's link. */
function tweetLine(locale: Locale, post: BotPost): string | null {
  const byAuthor = post.tweetBy === "author";
  const link = post.authorTweetId ? `[${t(locale, "mod.viewTweet")}](${tweetStatusUrl(post.authorTweetId)})` : null;
  if (post.tweetedAt) {
    const done = post.tweetedByDiscordId
      ? t(locale, byAuthor ? "mod.retweetedBy" : "mod.tweetedBy", { user: mention(post.tweetedByDiscordId) })
      : t(locale, byAuthor ? "mod.retweetedOn" : "mod.tweetedOn", { date: `<t:${Math.floor(post.tweetedAt.getTime() / 1000)}:R>` });
    return link ? `${done} (${link})` : done;
  }
  if (!byAuthor) return null;
  return link ? t(locale, "mod.authorTweeted", { link }) : t(locale, "mod.awaitingAuthor");
}

/** Post as seen by moderators: the feed card, its state and the moderation buttons. */
export function moderationMessage(post: BotPost, removal: Removal | null, locale: Locale, appUrl: string): RESTPostAPIChannelMessageJSONBody {
  const visible = isVisible(post);
  const byAuthor = post.tweetBy === "author";
  const tweet = visible && !post.tweetedAt && !byAuthor ? tweetDraft(post, appUrl) : null;
  // The author's tweet is retweeted once its link is given.
  const toTweet = visible && !post.tweetedAt && (!byAuthor || post.authorTweetId !== null);
  const author = post.author.discordId ? `${escapeMarkdown(post.author.username)} (${mention(post.author.discordId)})` : escapeMarkdown(post.author.username);
  const tweetStatus = tweetLine(locale, post);
  const lines = [
    `**${t(locale, "mod.author")}** ${author}`,
    `**${t(locale, "mod.status.label")}** ${postStatus(locale, post, removal)}`,
    tweetStatus ? `**${t(locale, "mod.tweet")}** ${tweetStatus}` : null,
    tweet?.tooLong ? `**${t(locale, "mod.tweet")}** ${t(locale, "mod.tweetTooLong", { length: tweet.length, max: TWEET_MAX })}` : null,
  ].filter((l): l is string => l !== null);

  const buttons: APIButtonComponent[] = [];
  if (visible) buttons.push(actionButton(t(locale, "mod.buttons.remove"), customId("mod", "remove", post.id), ButtonStyle.Danger));
  if (removal) buttons.push(actionButton(t(locale, "mod.buttons.restore"), customId("mod", "restore", post.id), ButtonStyle.Success));
  if (toTweet) buttons.push(linkButton(t(locale, "mod.buttons.openTweets"), `${appUrl}/tweets`));
  if (post.tweetedAt) {
    buttons.push(actionButton(t(locale, byAuthor ? "mod.buttons.retweeted" : "mod.buttons.tweeted"), customId("mod", "tweeted", post.id), ButtonStyle.Secondary, true));
  } else if (toTweet) {
    buttons.push(actionButton(t(locale, byAuthor ? "mod.buttons.markRetweeted" : "mod.buttons.markTweeted"), customId("mod", "tweeted", post.id), ButtonStyle.Primary));
  }

  return {
    flags: MessageFlags.IsComponentsV2,
    components: [
      postContainer(post, locale, appUrl),
      { type: ComponentType.TextDisplay, content: lines.join("\n") },
      ...(buttons.length ? [buttonRow(buttons)] : []),
    ],
  };
}

export function reportMessage(report: Report, post: BotPost, locale: Locale, appUrl: string): RESTPostAPIChannelMessageJSONBody {
  const reporter = report.reporterDiscordId ? mention(report.reporterDiscordId) : escapeMarkdown(report.reporterName ?? "?");
  const handler = report.handledByDiscordId ? mention(report.handledByDiscordId) : escapeMarkdown(report.handlerName ?? "?");
  const status =
    report.status === "handled"
      ? t(locale, "report.status.handled", { user: handler })
      : report.status === "dismissed"
        ? t(locale, "report.status.dismissed", { user: handler })
        : t(locale, "report.status.open");

  const lines = [
    `### ${t(locale, "report.title", { id: report.id })}`,
    `**${t(locale, "report.post")}** [${escapeMarkdown(post.displayName)}](${postUrl(appUrl, locale, post)}) (${postCode(post.type)})`,
    `**${t(locale, "report.reason")}** ${t(locale, `report.reasons.${report.reason}`)}`,
    `**${t(locale, "report.reporter")}** ${reporter}`,
    `**${t(locale, "mod.status.label")}** ${status}`,
  ];
  if (report.message.trim()) {
    lines.push(
      escapeMarkdown(truncate(report.message.trim(), REPORT_MESSAGE_MAX))
        .split("\n")
        .map((l) => `> ${l}`)
        .join("\n"),
    );
  }

  const buttons: APIButtonComponent[] =
    report.status === "open"
      ? [
          ...(isVisible(post) ? [actionButton(t(locale, "report.buttons.remove"), customId("mod", "remove", post.id, report.id), ButtonStyle.Danger)] : []),
          actionButton(t(locale, "report.buttons.dismiss"), customId("report", "dismiss", report.id), ButtonStyle.Secondary),
        ]
      : [];

  return {
    flags: MessageFlags.IsComponentsV2,
    components: [
      {
        type: ComponentType.Container,
        accent_color: REPORT_COLOR,
        components: [{ type: ComponentType.TextDisplay, content: lines.join("\n") }, ...(buttons.length ? [buttonRow(buttons)] : [])],
      },
    ],
  };
}
