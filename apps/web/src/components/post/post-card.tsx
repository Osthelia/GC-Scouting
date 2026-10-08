/**
 * GC-Scouting - post-card
 *
 * Post card used in lists, and the tags row.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { REGION_COLOR } from "@/lib/regions";
import { groupByTier } from "@/lib/tiers";
import { postRankRange, type PostCardView } from "@/lib/posts";
import { AgentIcon } from "./agent-icon";
import { PostTypeBadge, RankChip } from "./badges";
import { LanguageFlags } from "./language-flags";
import { TopExperience } from "./experience";

export function PostCard({ post }: { post: PostCardView }) {
  const t = useTranslations("post");
  const tCompensation = useTranslations("compensation");
  const tLan = useTranslations("lan");
  const tMinors = useTranslations("minorsPolicy");
  const confident = post.tierList ? groupByTier(post.tierList)[0]! : [];
  const terms = [post.compensation && tCompensation(post.compensation), post.lan && tLan(post.lan)].filter(Boolean).join(" · ");
  const rank = postRankRange(post);

  return (
    <Link
      href={`/posts/${post.type}/${post.id}`}
      className="group flex flex-col gap-3.5 rounded-xl border border-neutral-800 bg-[var(--sc-surface)] p-4 transition-all hover:translate-x-1 hover:bg-[var(--sc-hover)] active:scale-[0.99]"
      style={{ borderLeft: `3px solid ${REGION_COLOR[post.region]}` }}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <PostTypeBadge type={post.type} />
          <span className="truncate text-[15px] font-semibold tracking-tight text-neutral-50">{post.displayName}</span>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px] text-neutral-500">
          <span className="font-medium text-neutral-300 uppercase">{post.region}</span>
          <Dot />
          <LanguageFlags languages={post.languages} />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <PostTags post={post} />
        {rank && (
          <span className="ml-auto">
            <RankChip rank={rank.rank} rankMax={rank.rankMax} />
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-neutral-800/80 pt-3">
        {confident.length > 0 ? (
          <div className="flex min-w-0 items-center gap-2">
            <span className="text-[11px] font-semibold tracking-[0.12em] whitespace-nowrap text-neutral-500 uppercase">{t("confident")}</span>
            <div className="flex -space-x-1.5">
              {confident.slice(0, 5).map((slug) => (
                <AgentIcon key={slug} slug={slug} size={26} className="rounded-full ring-2 ring-[var(--sc-surface)] transition-colors group-hover:ring-[var(--sc-hover)]" />
              ))}
            </div>
          </div>
        ) : terms ? (
          <span className="text-[12.5px] font-medium text-neutral-300">{terms}</span>
        ) : (
          post.minorsAccepted !== null && <span className="text-[12.5px] font-medium text-neutral-300">{tMinors(post.minorsAccepted ? "accepted" : "adultsOnly")}</span>
        )}
        <div className="ml-auto">
          <TopExperience experience={post.experience} />
        </div>
      </div>
    </Link>
  );
}

/** Roles, staff roles, IGL and sub tags of a post. `withLabel` adds "Looking for" on team posts. */
export function PostTags({ post, withLabel = true }: { post: Pick<PostCardView, "type" | "roles" | "staffRoles" | "igl" | "rosterSpot">; withLabel?: boolean }) {
  const t = useTranslations("post");
  const tRoles = useTranslations("roles");
  const tStaff = useTranslations("staffRoles");
  const tIgl = useTranslations("igl");
  const tSpots = useTranslations("rosterSpots");
  const searching = withLabel && (post.type === "lfp" || post.type === "lfs");

  return (
    <>
      {searching && (post.roles.length > 0 || post.staffRoles.length > 0) && <span className="text-[12px] text-neutral-500">{t("lookingFor")}</span>}
      {post.rosterSpot === "sub" && (
        <span className="rounded-md bg-amber-500/15 px-2 py-0.5 text-[12px] font-semibold text-amber-300">{tSpots("sub")}</span>
      )}
      {post.roles.map((role) => (
        <Tag key={role}>{tRoles(role)}</Tag>
      ))}
      {post.staffRoles.map((role) => (
        <Tag key={role}>{tStaff(role)}</Tag>
      ))}
      {post.igl.map((role) => (
        <span key={role} className="rounded-md bg-[color-mix(in_oklab,var(--sc-accent-2)_16%,transparent)] px-2 py-0.5 text-[12px] font-semibold text-[var(--sc-accent-2)]">
          {tIgl(role)}
        </span>
      ))}
    </>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return <span className="rounded-md border border-neutral-800 bg-[var(--sc-surface-2)] px-2 py-0.5 text-[12px] font-medium text-neutral-300">{children}</span>;
}

function Dot() {
  return <span className="h-[3px] w-[3px] flex-none rounded-full bg-neutral-700" />;
}
