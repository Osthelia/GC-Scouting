/**
 * GC-Scouting - posts type loading
 *
 * Loading skeleton of a post list.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

import { PostsSkeleton } from "@/components/posts/posts-skeleton";

export default function PostsLoading() {
  return (
    <div className="mx-auto max-w-[1400px] px-4 py-8 sm:px-6 sm:py-10">
      <div className="mb-7 h-[70px] max-w-md animate-pulse rounded-lg bg-[var(--sc-surface)]" />
      <PostsSkeleton />
    </div>
  );
}
