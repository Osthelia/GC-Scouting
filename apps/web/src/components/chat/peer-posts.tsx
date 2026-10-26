/**
 * GC-Scouting - peer-posts
 *
 * Posts of the other person, shown next to a conversation.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

"use client";

import { useEffect, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { ChevronDownIcon, FileTextIcon } from "lucide-react";
import { Link } from "@/i18n/navigation";
import type { PostCardView } from "@/lib/posts";
import { postRankRange } from "@/lib/posts";
import { REGION_COLOR } from "@/lib/regions";
import { PostTypeBadge, RankChip } from "@/components/post/badges";
import { cn } from "@/lib/utils";

/** Open posts of the other member, as a column on wide screens. */
export function PeerPostsAside({ name, posts }: { name: string; posts: PostCardView[] }) {
  const t = useTranslations("chat.posts");
  return (
    <aside className="hidden w-[320px] flex-none flex-col border-l border-neutral-800 xl:flex">
      <h2 className="flex-none px-4 pt-4 pb-3 text-[11.5px] font-semibold tracking-[0.12em] text-neutral-500 uppercase">{t("title", { name })}</h2>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-4">
        <PostList posts={posts} />
      </div>
    </aside>
  );
}

/** Same list in a menu of the conversation header, below xl. */
export function PeerPostsToggle({ name, posts }: { name: string; posts: PostCardView[] }) {
  const t = useTranslations("chat.posts");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [open]);

  return (
    <div className="relative xl:hidden">
      <button
        type="button"
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className="inline-flex h-9 items-center gap-1.5 rounded-[9px] border border-neutral-800 bg-[var(--sc-surface)] px-2.5 text-[13px] font-semibold text-neutral-300 transition-all hover:bg-[var(--sc-hover)] hover:text-neutral-100 active:scale-[0.97]"
      >
        <FileTextIcon className="h-3.5 w-3.5 text-[var(--sc-accent)]" />
        <span className="tabular-nums">{posts.length}</span>
        <span className="sr-only">{t("toggle", { count: posts.length })}</span>
        <ChevronDownIcon className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute top-11 right-0 z-30 w-[min(340px,calc(100vw-24px))] rounded-xl border border-neutral-800 bg-[var(--sc-surface-3)] p-2 shadow-[0_20px_48px_rgba(0,0,0,.7)]"
        >
          <p className="px-1.5 pt-1 pb-2 text-[11px] font-semibold tracking-[0.12em] text-neutral-500 uppercase">{t("title", { name })}</p>
          <div className="max-h-[50vh] overflow-y-auto">
            <PostList posts={posts} />
          </div>
        </div>
      )}
    </div>
  );
}

function PostList({ posts }: { posts: PostCardView[] }) {
  const t = useTranslations("chat.posts");
  const tRegions = useTranslations("regions");
  const format = useFormatter();
  const now = new Date();

  if (!posts.length) return <p className="px-1.5 py-3 text-[13px] text-neutral-500">{t("none")}</p>;

  return (
    <ul className="flex flex-col gap-2">
      {posts.map((post) => {
        const rank = postRankRange(post);
        return (
          <li key={post.id}>
            <Link
              href={`/posts/${post.type}/${post.id}`}
              className="block rounded-xl border border-neutral-800 bg-[var(--sc-surface)] px-3 py-2.5 transition-all hover:translate-x-0.5 hover:bg-[var(--sc-hover)] active:scale-[0.99]"
              style={{ borderLeft: `3px solid ${REGION_COLOR[post.region]}` }}
            >
              <span className="flex items-center gap-2">
                <PostTypeBadge type={post.type} />
                <span className="truncate text-[14px] font-semibold text-neutral-100">{post.displayName}</span>
              </span>
              <span className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[12px] text-neutral-500">
                <span>{tRegions(post.region)}</span>
                {rank && <RankChip rank={rank.rank} rankMax={rank.rankMax} />}
                <span>{t("published", { date: format.relativeTime(new Date(post.bumpedAt), now) })}</span>
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
