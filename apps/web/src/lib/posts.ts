/**
 * GC-Scouting - posts
 *
 * Post view types shared by the pages and components.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

import { rankKey, type Rank } from "./ranks";
import type { MatchablePost } from "@scouting/db/filters";
import type { AvailabilitySlot, GcsSummary, PostContact, TierList, TweetBy } from "@scouting/db";

export type ProfileStatus = "verified" | "pending" | "none";

/** What a post card and the list filters need. Contacts and description stay on the detail page. */
export type PostCardView = MatchablePost & {
  id: number;
  tierList: TierList | null;
  bumpedAt: string;
};

/** A public post as the detail page receives it. Dates are ISO strings. */
export type PostView = PostCardView & {
  /** Removed posts are never sent to the client. */
  status: "active" | "closed";
  profile: ProfileStatus;
  /** GC Stats player, only once the link is approved. */
  gcsPersonId: number | null;
  gcsTeamId: number | null;
  country: string | null;
  rankPeak: number | null;
  /** Riot ID of the author's tracker.gg profile. */
  trackerRiotId: string | null;
  timezone: string;
  availability: AvailabilitySlot[];
  activeDays: number;
  description: string;
  contact: PostContact;
  chatEnabled: boolean;
  tweetBy: TweetBy;
  /** Status id of the author's tweet, once its link is given. */
  authorTweetId: string | null;
  /** Tweeted by GC Scouting, or the author's tweet retweeted. */
  tweeted: boolean;
  gcsSummary: GcsSummary | null;
  gcsSummarySyncedAt: string | null;
  publishedAt: string;
  expiresAt: string;
};

export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const letters = words.length > 1 ? words[0]![0]! + words[1]![0]! : name.slice(0, 2);
  return letters.toUpperCase();
}

/** Rank shown on a card: the current rank, or the range a team is looking for. */
export function postRankRange(post: Pick<PostView, "rankCurrent" | "rankMin" | "rankMax">): { rank: Rank; rankMax?: Rank } | null {
  if (post.rankCurrent !== null) return { rank: rankKey(post.rankCurrent)! };
  const min = rankKey(post.rankMin);
  const max = rankKey(post.rankMax);
  if (!min && !max) return null;
  if (!min || !max || min === max) return { rank: (min ?? max)! };
  return { rank: min, rankMax: max };
}
