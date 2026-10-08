/**
 * GC-Scouting - automod
 *
 * Automatic moderation of chat messages.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

import type { MessageModeration } from "@scouting/db";
import { loggable } from "@scouting/db/log";

// OpenAI Moderation API (free, omni-moderation-latest). A flagged message is held for the staff.

const TIMEOUT_MS = 4000;

type ModerationResponse = { results?: { flagged?: boolean; categories?: Record<string, boolean> }[] };

/** Null when the check could not run (no key, OpenAI down): the message then goes through unchecked. */
export async function moderateMessage(body: string): Promise<MessageModeration | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  try {
    const response = await fetch("https://api.openai.com/v1/moderations", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "omni-moderation-latest", input: body }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) {
      console.warn(`[automod] OpenAI answered ${response.status}`);
      return null;
    }
    const result = ((await response.json()) as ModerationResponse).results?.[0];
    if (!result) return null;
    const categories = Object.entries(result.categories ?? {})
      .filter(([, hit]) => hit)
      .map(([name]) => name);
    return { flagged: !!result.flagged, categories };
  } catch (error) {
    console.warn("[automod] OpenAI request failed", loggable(error));
    return null;
  }
}
