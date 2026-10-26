/**
 * GC-Scouting - post-form-account
 *
 * Contact channels of the account offered by the post form.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

import { eq } from "drizzle-orm";
import { db } from "@scouting/db/client";
import { users } from "@scouting/db";
import type { ActiveProfile } from "@/lib/auth/session";

/** Reminder channels of the profile, as shown in the post form. */
export async function formAccountChannels(user: ActiveProfile) {
  const [account] = await db
    .select({ email: users.email, discordId: users.discordId, notifyEmail: users.notifyEmail, notifyDiscord: users.notifyDiscord })
    .from(users)
    .where(eq(users.id, user.id))
    .limit(1);
  return {
    // A delegate sees that the owner has an email, not the address.
    email: account?.email ? (user.delegated ? maskEmail(account.email) : account.email) : null,
    hasDiscord: !!account?.discordId,
    // Prefills the Discord contact, kept from a delegate like the email.
    discordId: user.delegated ? null : (account?.discordId ?? null),
    // A stored preference only counts while its channel is still available.
    notifyEmail: !!account?.email && account.notifyEmail,
    notifyDiscord: !!account?.discordId && account.notifyDiscord,
  };
}

function maskEmail(email: string): string {
  const [name = "", domain = ""] = email.split("@");
  return `${name.slice(0, 1)}***@${domain}`;
}
