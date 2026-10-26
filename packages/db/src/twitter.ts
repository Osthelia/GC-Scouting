/**
 * GC-Scouting - twitter
 *
 * Tweet link parsing.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

// Links to tweets: the author pastes the link of their own tweet, GC Scouting retweets it.

const STATUS_URL = /^(?:https?:\/\/)?(?:www\.|mobile\.)?(?:x|twitter)\.com\/(?:[A-Za-z0-9_]{1,15}|i(?:\/web)?)\/status(?:es)?\/(\d{1,20})(?:[/?#].*)?$/i;

/** Status id of a tweet link (x.com or twitter.com), null when it is not one. */
export function parseTweetUrl(url: string): string | null {
  return url.trim().match(STATUS_URL)?.[1] ?? null;
}

export function tweetStatusUrl(id: string): string {
  return `https://x.com/i/status/${id}`;
}

export function retweetIntentUrl(id: string): string {
  return `https://x.com/intent/retweet?${new URLSearchParams({ tweet_id: id })}`;
}

export function tweetIntentUrl(text: string): string {
  return `https://x.com/intent/tweet?${new URLSearchParams({ text })}`;
}
