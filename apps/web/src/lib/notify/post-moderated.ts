/**
 * GC-Scouting - post-moderated
 *
 * Notifies an author when staff edited or removed a post.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

import { eq } from "drizzle-orm";
import { createTranslator } from "next-intl";
import { db } from "@scouting/db/client";
import { posts, users } from "@scouting/db";
import { escapeMarkdown } from "@scouting/db/markdown";
import { appUrl, localeOf } from "@/lib/app-url";
import { POST_TYPE_BY_KEY } from "@/lib/post-types";
import { renderEmail, sendEmail } from "@/lib/notify/email";
import { sendDiscordDm } from "@/lib/notify/discord";
import { loggable } from "@scouting/db/log";

const ACCENT_COLOR = 0x9b7bff;

/** Tells the author that the staff edited their post, with the reason. Sent on every channel of the account, reminder settings aside. */
export async function notifyPostEditedByStaff(postId: number, reason: string): Promise<void> {
  try {
    const [row] = await db
      .select({ type: posts.type, displayName: posts.displayName, email: users.email, discordId: users.discordId, locale: users.locale })
      .from(posts)
      .innerJoin(users, eq(users.id, posts.authorId))
      .where(eq(posts.id, postId))
      .limit(1);
    if (!row || (!row.email && !row.discordId)) return;

    const locale = localeOf(row.locale);
    const messages = (await import(`../../messages/${locale}.json`)).default;
    const t = createTranslator({ locale, messages, namespace: "moderationNotice.edited" });
    const values = { code: POST_TYPE_BY_KEY[row.type].code, name: row.displayName };
    const url = `${appUrl()}/${locale}/posts/${row.type}/${postId}`;
    const title = t("title", values);
    const body = t("body", values);
    const reasonLine = t("reason", { reason });
    const dmValues = { ...values, name: escapeMarkdown(row.displayName) };

    await Promise.all([
      row.email &&
        sendEmail({
          to: row.email,
          subject: t("subject", values),
          ...renderEmail({ locale, title, paragraphs: [body, reasonLine], buttons: [{ label: t("open"), url, primary: true }], footer: t("footer") }),
        }),
      row.discordId &&
        sendDiscordDm(row.discordId, {
          accentColor: ACCENT_COLOR,
          blocks: [
            { kind: "text", content: `**${t("title", dmValues)}**\n${t("body", dmValues)}` },
            { kind: "text", content: `>>> ${escapeMarkdown(reason)}` },
            { kind: "buttons", buttons: [{ label: t("open"), url }] },
            { kind: "text", content: `-# ${t("footer")}` },
          ],
        }),
    ]);
  } catch (error) {
    console.error("Post edit notice failed", postId, loggable(error));
  }
}
