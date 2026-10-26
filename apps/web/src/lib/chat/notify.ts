/**
 * GC-Scouting - notify
 *
 * Notifies a recipient of a new chat message (Discord, email).
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

import { and, eq, inArray, isNull, lte, or } from "drizzle-orm";
import { createTranslator } from "next-intl";
import { db } from "@scouting/db/client";
import { conversationMembers, profileDelegations, users } from "@scouting/db";
import { escapeMarkdown } from "@scouting/db/markdown";
import { appUrl, localeOf } from "@/lib/app-url";
import { renderEmail, sendEmail } from "@/lib/notify/email";
import { sendDiscordDm } from "@/lib/notify/discord";
import { loggable } from "@scouting/db/log";

const ACCENT_COLOR = 0x9b7bff;

type Recipient = { id: string; username: string; email: string | null; discordId: string | null; locale: string; byEmail: boolean; byDiscord: boolean };

/**
 * Email and Discord alert for a new message, to the recipient profile and the accounts that manage it.
 * One alert per unread streak of the profile: nothing more is sent until it opens the conversation.
 * The message itself is never copied in the alert. `writerId` (the account that wrote it) is never alerted.
 */
export async function notifyNewMessage(
  conversationId: number,
  recipientId: string,
  sender: { name: string; manager: string | null; writerId: string | null },
): Promise<void> {
  try {
    const [claimed] = await db
      .update(conversationMembers)
      .set({ notifiedAt: new Date() })
      .where(
        and(
          eq(conversationMembers.conversationId, conversationId),
          eq(conversationMembers.userId, recipientId),
          or(isNull(conversationMembers.notifiedAt), lte(conversationMembers.notifiedAt, conversationMembers.lastReadAt)),
        ),
      )
      .returning({ userId: conversationMembers.userId });
    if (!claimed) return;

    const delegates = db.select({ id: profileDelegations.delegateId }).from(profileDelegations).where(eq(profileDelegations.ownerId, recipientId));
    const people: Recipient[] = await db
      .select({
        id: users.id,
        username: users.username,
        email: users.email,
        discordId: users.discordId,
        locale: users.locale,
        byEmail: users.chatNotifyEmail,
        byDiscord: users.chatNotifyDiscord,
      })
      .from(users)
      .where(or(eq(users.id, recipientId), inArray(users.id, delegates)));
    const profile = people.find((p) => p.id === recipientId);
    if (!profile) return;

    await Promise.all(
      people.filter((p) => p.id !== sender.writerId).map((p) => alert(p, conversationId, sender, p.id === recipientId ? null : profile.username)),
    );
  } catch (error) {
    console.error("Chat alert failed", conversationId, loggable(error));
  }
}

/** One person's alert. `managedProfile` is set for a manager of the recipient profile. */
async function alert(recipient: Recipient, conversationId: number, sender: { name: string; manager: string | null }, managedProfile: string | null): Promise<void> {
  const email = recipient.byEmail ? recipient.email : null;
  const discordId = recipient.byDiscord ? recipient.discordId : null;
  if (!email && !discordId) return;

  const locale = localeOf(recipient.locale);
  const messages = (await import(`../../messages/${locale}.json`)).default;
  const t = createTranslator({ locale, messages, namespace: "chat" });
  const url = `${appUrl()}/${locale}/messages/${conversationId}`;
  // A manager writes under their own name.
  const texts = (escape: (text: string) => string) => {
    const name = sender.manager ? t("managerName", { name: escape(sender.manager), profile: escape(sender.name) }) : escape(sender.name);
    const values = { name, profile: escape(managedProfile ?? "") };
    return {
      title: managedProfile ? t("alert.managedTitle", values) : t("alert.title", values),
      body: managedProfile ? t("alert.managedBody", values) : t("alert.body", values),
      subject: managedProfile ? t("alert.managedSubject", values) : t("alert.subject", values),
    };
  };
  const { title, body, subject } = texts((text) => text);
  // Discord renders markdown, names are escaped there.
  const dm = texts(escapeMarkdown);

  await Promise.all([
    email &&
      sendEmail({
        to: email,
        subject,
        ...renderEmail({ locale, title, paragraphs: [body], buttons: [{ label: t("alert.open"), url, primary: true }], footer: t("alert.footer") }),
      }),
    discordId &&
      sendDiscordDm(discordId, {
        accentColor: ACCENT_COLOR,
        blocks: [
          { kind: "text", content: `**${dm.title}**\n${dm.body}` },
          { kind: "buttons", buttons: [{ label: t("alert.open"), url }] },
          { kind: "text", content: `-# ${t("alert.footer")}` },
        ],
      }),
  ]);
}
