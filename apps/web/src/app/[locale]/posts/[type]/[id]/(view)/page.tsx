/**
 * GC-Scouting - type id page
 *
 * Post detail page with the GC Stats summary and contact actions.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { ArrowLeftIcon, ArrowRightIcon, BellOffIcon, BriefcaseIcon, ClockIcon, CopyIcon, ExternalLinkIcon, LinkIcon, LockIcon, MailIcon, ShieldIcon } from "lucide-react";
import { eq } from "drizzle-orm";
import { db } from "@scouting/db/client";
import { parseId, users, POST_LIFETIME_DAYS } from "@scouting/db";
import { shareImageUrl } from "@scouting/db/share-image";
import { trackerUrl } from "@scouting/db/tracker";
import { discordInviteUrl, discordProfileUrl, isDiscordId } from "@/lib/discord-contact";
import type { AppLocale } from "@/i18n/routing";
import { Link, redirect } from "@/i18n/navigation";
import { getPost, postAuthorId, similarPosts } from "@/lib/posts-query";
import { appUrl } from "@/lib/app-url";
import { findConversation } from "@/lib/chat/queries";
import { MessageAuthorButton } from "@/components/chat/message-author-button";
import { getActiveProfile } from "@/lib/auth/session";
import { getStaffUser } from "@/lib/admin/access";
import { postRankRange, type PostView } from "@/lib/posts";
import { POST_TYPE_BY_KEY, isPostType } from "@/lib/post-types";
import { REGION_COLOR } from "@/lib/regions";
import { RANK_BY_KEY, rankKey } from "@/lib/ranks";
import { PostCard, PostTags } from "@/components/post/post-card";
import { PostTypeBadge, RankChip } from "@/components/post/badges";
import { RankIcon } from "@/components/post/rank-icon";
import { TierListView } from "@/components/post/tier-list";
import { LanguageFlags } from "@/components/post/language-flags";
import { GcsHistory } from "@/components/post/gcs-history";
import { AvailabilityWeek } from "@/components/post/availability-week";
import { CopyButton } from "@/components/ui/copy-button";
import { useExperienceItems } from "@/components/post/experience";
import { RenewPostButton } from "@/components/post/renew-post-button";
import { PostAuthorActions } from "@/components/post/post-author-actions";
import { ReportPostButton } from "@/components/post/report-post-button";
import { canRenew } from "@/lib/post-expiry";
import { cn } from "@/lib/utils";
import { gcsApiConfigured } from "@/lib/gcs-api";
import { fetchAuthorTweets } from "@/lib/notify/bot";
import { PostTweetPanel } from "@/components/post/post-tweet-panel";

/** Visitors wait for the history of a new post this long, its author always does. */
const GCS_SUMMARY_WAIT_MS = 10 * 60 * 1000;

type Params = Promise<{ locale: string; type: string; id: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale, id } = await params;
  const postId = parseId(id);
  const post = postId ? await getPost(postId) : null;
  if (!post) return {};
  const t = await getTranslations({ locale: locale as AppLocale, namespace: "home.types" });
  const title = `${post.displayName} - ${POST_TYPE_BY_KEY[post.type].code}`;
  const description = post.description.slice(0, 160) || t(`${post.type}.desc`);
  const origin = appUrl();
  const image = { url: shareImageUrl(origin, post), width: 1200, height: 630, alt: title };
  return {
    title,
    description,
    openGraph: { title, description, type: "article", url: `${origin}/${locale}/posts/${post.type}/${post.id}`, images: [image] },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  };
}

export default async function PostPage({ params }: { params: Params }) {
  const { locale, type, id } = await params;
  setRequestLocale(locale);
  const postId = parseId(id);
  if (!postId || !isPostType(type)) notFound();

  const post = await getPost(postId);
  if (!post) notFound();
  // Keeps shared links working if the type segment is wrong.
  if (post.type !== type) redirect({ href: `/posts/${post.type}/${post.id}`, locale });

  const [similar, user, authorId, staff] = await Promise.all([similarPosts(post), getActiveProfile(), postAuthorId(post.id), getStaffUser()]);
  const isAuthor = !!user && user.id === authorId;
  const [reminders] =
    user && isAuthor && post.status === "active"
      ? await db.select({ email: users.notifyEmail, discord: users.notifyDiscord }).from(users).where(eq(users.id, user.id)).limit(1)
      : [];
  const now = new Date();
  const expired = new Date(post.expiresAt) <= now;
  const conversationId = user && authorId && !isAuthor ? await findConversation(user.id, authorId) : null;
  const canMessage = !isAuthor && (conversationId !== null || (post.chatEnabled && post.status === "active" && !expired));
  const t = await getTranslations("postPage");
  const code = POST_TYPE_BY_KEY[post.type].code;

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-8 sm:px-6 sm:py-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href={`/posts/${post.type}`}
          className="inline-flex items-center gap-1.5 rounded-md py-1 text-[13px] font-semibold text-neutral-500 transition-colors hover:text-neutral-100 active:opacity-70"
        >
          <ArrowLeftIcon className="h-4 w-4" />
          {t("back", { code })}
        </Link>
        {isAuthor ? (
          post.status === "active" && <PostAuthorActions postId={post.id} type={post.type} />
        ) : (
          <div className="flex flex-wrap items-center gap-1.5">
            {staff && post.status === "active" && (
              <Link
                href={`/posts/${post.type}/${post.id}/edit`}
                className="inline-flex h-9 items-center gap-1.5 rounded-[9px] border border-amber-500/30 bg-amber-500/10 px-3 text-[13px] font-semibold text-amber-200 transition-all hover:bg-amber-500/15 hover:text-amber-100 active:scale-[0.97]"
              >
                <ShieldIcon className="h-3.5 w-3.5" />
                {t("staffEdit")}
              </Link>
            )}
            <ReportPostButton postId={post.id} loggedIn={!!user} />
          </div>
        )}
      </div>

      {(post.status === "closed" || expired) && (
        <div className="mt-4 flex items-start gap-3 rounded-xl border border-neutral-800 bg-[var(--sc-surface-2)] px-4 py-3.5">
          <span className="mt-0.5 text-neutral-400">{post.status === "closed" ? <LockIcon className="h-4 w-4" /> : <ClockIcon className="h-4 w-4" />}</span>
          <div>
            <p className="text-[14px] font-semibold text-neutral-100">{t(post.status === "closed" ? "closed" : "expired")}</p>
            <p className="mt-0.5 text-[13px] text-neutral-500">{t(post.status === "closed" ? "closedHint" : "expiredHint")}</p>
          </div>
        </div>
      )}

      {reminders && <AuthorNotices post={post} expired={expired} now={now} noReminder={!reminders.email && !reminders.discord} />}

      {isAuthor && post.status === "active" && !expired && (
        <Suspense fallback={<div aria-busy className="mt-4 h-[74px] animate-pulse rounded-xl border border-neutral-800 bg-[var(--sc-surface-2)]" />}>
          <AuthorTweet post={post} />
        </Suspense>
      )}

      <PostHeader
        post={post}
        expired={expired}
        now={now}
        isAuthor={isAuthor}
        chat={canMessage && (
            <MessageAuthorButton
              postId={post.id}
              authorName={post.displayName}
              loggedIn={!!user}
              conversationId={conversationId}
              delegate={user?.delegated ? { name: user.actorName, profile: user.username } : null}
            />
          )}
      />

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-8">
        <div className="flex min-w-0 flex-col gap-6">
          {post.description && (
            <Section title={t("about")}>
              <p className="text-[14.5px] leading-relaxed whitespace-pre-line text-neutral-300">{post.description}</p>
            </Section>
          )}
          {post.tierList && (
            <Section title={t("tierlist")}>
              <TierListView tierList={post.tierList} iconSize={40} />
            </Section>
          )}
          <Section title={t("availability")}>
            <AvailabilityWeek slots={post.availability} timezone={post.timezone} />
          </Section>
        </div>

        <aside className="flex flex-col gap-6">
          <Section title={t("profile")}>
            <ProfileFacts post={post} />
          </Section>
        </aside>
      </div>

      {similar.length > 0 && (
        <section className="mt-12">
          <div className="mb-4 flex items-end justify-between gap-4">
            <h2 className="text-[20px] font-bold tracking-tight text-neutral-50">{t("similar")}</h2>
            <Link
              href={`/posts/${post.type}`}
              className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[var(--sc-accent)] transition-opacity hover:opacity-80 active:opacity-60"
            >
              {t("seeAll")}
              <ArrowRightIcon className="h-4 w-4" />
            </Link>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            {similar.map((p) => (
              <PostCard key={p.id} post={p} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

/** The author's tweet texts are written by the bot, only fetched while they still have to post it. */
async function AuthorTweet({ post }: { post: PostView }) {
  const drafts = post.tweetBy === "author" && !post.tweeted ? await fetchAuthorTweets(post.id) : null;
  return <PostTweetPanel postId={post.id} tweetBy={post.tweetBy} authorTweetId={post.authorTweetId} tweeted={post.tweeted} drafts={drafts} />;
}

/** Renewal once the reminder window is open, and a warning while no reminder channel is on. */
function AuthorNotices({ post, expired, now, noReminder }: { post: PostView; expired: boolean; now: Date; noReminder: boolean }) {
  const t = useTranslations("expiry");
  const format = useFormatter();
  const renewable = canRenew(new Date(post.expiresAt), now);
  if (!renewable && !noReminder) return null;

  return (
    <div className="mt-4 flex flex-col gap-3">
      {renewable && (
        <div className="flex flex-col gap-3 rounded-xl border border-[color-mix(in_oklab,var(--sc-accent)_35%,transparent)] bg-[color-mix(in_oklab,var(--sc-accent)_8%,transparent)] px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <ClockIcon className="mt-0.5 h-4 w-4 flex-none text-[var(--sc-accent)]" />
            <div>
              <p className="text-[14px] font-semibold text-neutral-100">
                {expired ? t("renew.expiredTitle") : t("renew.title", { date: format.relativeTime(new Date(post.expiresAt), now) })}
              </p>
              <p className="mt-0.5 text-[13px] text-neutral-400">{t("renew.hint", { days: POST_LIFETIME_DAYS })}</p>
            </div>
          </div>
          <RenewPostButton postId={post.id} />
        </div>
      )}
      {noReminder && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3.5">
          <BellOffIcon className="mt-0.5 h-4 w-4 flex-none text-amber-400" />
          <div>
            <p className="text-[14px] font-semibold text-neutral-100">{t("noReminder.title")}</p>
            <p className="mt-0.5 text-[13px] text-neutral-400">{t("noReminder.text", { days: POST_LIFETIME_DAYS })}</p>
          </div>
        </div>
      )}
    </div>
  );
}

function PostHeader({ post, expired, now, isAuthor, chat }: { post: PostView; expired: boolean; now: Date; isAuthor: boolean; chat: React.ReactNode }) {
  const t = useTranslations("postPage");
  const tRegions = useTranslations("regions");
  const format = useFormatter();
  const locale = useLocale();
  const renewed = post.bumpedAt !== post.publishedAt;
  const countryName = post.country ? new Intl.DisplayNames([locale], { type: "region" }).of(post.country) : null;

  return (
    <div
      className="mt-4 rounded-2xl border border-neutral-800 bg-[var(--sc-surface)] p-5 sm:p-6"
      style={{ borderLeft: `3px solid ${REGION_COLOR[post.region]}` }}
    >
      <div className="flex flex-wrap items-start gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <PostTypeBadge type={post.type} />
            <h1 className="text-[24px] leading-tight font-bold tracking-tight text-neutral-50 sm:text-[28px]">{post.displayName}</h1>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[13px] text-neutral-400">
            <span className="inline-flex items-center gap-1.5 font-medium text-neutral-200">
              <span className="h-2 w-2 rounded-full" style={{ background: REGION_COLOR[post.region] }} />
              {tRegions(post.region)}
            </span>
            {post.country && (
              <span className="inline-flex items-center gap-1.5">
                <span className={`fi fi-${post.country.toLowerCase()} rounded-[2px]`} style={{ width: 18, height: 13.5, lineHeight: "13.5px" }} />
                {countryName}
              </span>
            )}
            <LanguageFlags languages={post.languages} />
          </div>
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[12.5px] text-neutral-500">
            <span>{t("published", { date: format.relativeTime(new Date(post.publishedAt), now) })}</span>
            {renewed && <span>{t("renewed", { date: format.relativeTime(new Date(post.bumpedAt), now) })}</span>}
            {!expired && post.status === "active" && <span>{t("expires", { date: format.relativeTime(new Date(post.expiresAt), now) })}</span>}
          </div>
        </div>

        <ContactActions post={post} chat={chat} />
      </div>

      <div className="mt-5 border-t border-neutral-800 pt-5">
        <GcsHistory post={post} canRefresh={isAuthor} awaiting={awaitingGcsSummary(post, isAuthor, now)} />
      </div>
    </div>
  );
}

/** The history is fetched after publication (or after a team change): the page waits for it. */
function awaitingGcsSummary(post: PostView, isAuthor: boolean, now: Date): boolean {
  if (post.gcsSummary || post.gcsSummarySyncedAt || post.status !== "active" || !gcsApiConfigured()) return false;
  if (post.profile === "none" && post.gcsTeamId === null) return false;
  return isAuthor || now.getTime() - new Date(post.publishedAt).getTime() < GCS_SUMMARY_WAIT_MS;
}

function ContactActions({ post, chat }: { post: PostView; chat: React.ReactNode }) {
  const t = useTranslations("postPage");
  const { discord, discordInvite, twitter, email, agent } = post.contact;
  const linkClass =
    "inline-flex h-[38px] items-center gap-2 rounded-[10px] border border-neutral-800 bg-[var(--sc-surface)] px-3 text-[13px] font-semibold text-neutral-200 transition-all hover:bg-[var(--sc-hover)] active:scale-[0.97]";

  return (
    <div className="flex w-full flex-col gap-2 sm:w-auto sm:items-end">
      {agent && (
        <p className="inline-flex max-w-full items-center gap-1.5 text-[12.5px] text-neutral-400">
          <BriefcaseIcon className="h-3.5 w-3.5 flex-none text-neutral-500" />
          <span className="truncate">
            {t("agentContact")} <span className="font-semibold text-neutral-200">{agent.name}</span>
            {agent.agency && <span className="text-neutral-500"> ({agent.agency})</span>}
          </span>
        </p>
      )}
      <div className="flex w-full flex-wrap gap-2 sm:w-auto sm:justify-end">
        {chat}
        {discordInvite && (
          <a href={discordInviteUrl(discordInvite)} target="_blank" rel="noopener noreferrer" className={linkClass}>
            <DiscordIcon />
            {t("discordServer")}
          </a>
        )}
        {discord &&
          (isDiscordId(discord) ? (
            <>
              <a href={discordProfileUrl(discord)} target="_blank" rel="noopener noreferrer" className={linkClass}>
                <DiscordIcon />
                {t("discordProfile")}
              </a>
              <CopyButton value={discord} label={t("copyDiscordId")} copiedLabel={t("copied")} icon={<CopyIcon className="h-4 w-4 text-neutral-400" />} />
            </>
          ) : (
            <CopyButton value={discord} label={discord} title={t("copyDiscord")} copiedLabel={t("copied")} icon={<DiscordIcon />} />
          ))}
        {twitter && (
          <a
            href={`https://x.com/${encodeURIComponent(twitter)}`}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={t("twitter")}
            className={linkClass}
          >
            <XIcon />@{twitter}
          </a>
        )}
        {email && (
          <a
            href={`mailto:${encodeURIComponent(email)}`}
            aria-label={t("email")}
            className={cn(linkClass, "max-w-full")}
          >
            <MailIcon className="h-4 w-4 flex-none text-neutral-400" />
            <span className="truncate">{email}</span>
          </a>
        )}
        <CopyButton label={t("share")} copiedLabel={t("linkCopied")} icon={<LinkIcon className="h-4 w-4" />} />
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-neutral-800 bg-[var(--sc-surface)] p-4 sm:p-5">
      <h2 className="mb-4 text-[11.5px] font-semibold tracking-[0.12em] text-neutral-500 uppercase">{title}</h2>
      {children}
    </section>
  );
}

function ProfileFacts({ post }: { post: PostView }) {
  const t = useTranslations("postPage");
  const tSpots = useTranslations("rosterSpots");
  const tCompensation = useTranslations("compensation");
  const tLan = useTranslations("lan");
  const tAge = useTranslations("ageGroups");
  const tMinors = useTranslations("minorsPolicy");
  const experience = useExperienceItems()(post.experience);
  const searching = post.type === "lfp" || post.type === "lfs";
  const rank = postRankRange(post);
  const peak = rankKey(post.rankPeak);
  const hasTags = post.roles.length > 0 || post.staffRoles.length > 0 || post.igl.length > 0;

  const rows: { label: string; value: React.ReactNode }[] = [];
  if (post.compensation) rows.push({ label: t("compensation"), value: tCompensation(post.compensation) });
  if (post.lan) rows.push({ label: t("lan"), value: tLan(post.lan) });
  if (post.playersWanted !== null && post.subsWanted !== null) {
    const wanted = [post.playersWanted > 0 && t("playersWanted", { count: post.playersWanted }), post.subsWanted > 0 && t("subsWanted", { count: post.subsWanted })];
    rows.push({ label: t("rosterSpotWanted"), value: wanted.filter(Boolean).join(", ") });
  } else if (post.rosterSpot) rows.push({ label: t(searching ? "rosterSpotWanted" : "rosterSpot"), value: tSpots(post.rosterSpot) });
  if (post.ageGroup) rows.push({ label: t("ageGroup"), value: tAge(post.ageGroup) });
  if (post.minorsAccepted !== null) rows.push({ label: t("minorsAccepted"), value: tMinors(post.minorsAccepted ? "accepted" : "adultsOnly") });
  if (hasTags) {
    rows.push({
      label: searching ? t("lookingFor") : post.staffRoles.length ? t("staffRoles") : t("roles"),
      value: (
        <div className="flex flex-wrap justify-end gap-1.5">
          <PostTags post={post} withLabel={false} />
        </div>
      ),
    });
  }
  if (rank) {
    rows.push({
      label: post.rankCurrent !== null ? t("rank") : t("rankWanted"),
      value: (
        <div className="flex flex-col items-end gap-1">
          <RankChip rank={rank.rank} rankMax={rank.rankMax} />
          {peak && post.rankPeak !== post.rankCurrent && (
            <span className="inline-flex items-center gap-1 text-[12px] text-neutral-500">
              <RankIcon rank={peak} size={14} />
              {t("peak", { rank: RANK_BY_KEY[peak].label })}
            </span>
          )}
        </div>
      ),
    });
  }
  if (post.trackerRiotId) {
    rows.push({
      label: t("tracker"),
      value: (
        <a
          href={trackerUrl(post.trackerRiotId)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex max-w-full items-center gap-1.5 rounded-md text-[var(--sc-accent)] transition-opacity hover:opacity-80 active:opacity-60"
        >
          <span className="truncate">{post.trackerRiotId}</span>
          <ExternalLinkIcon className="h-3.5 w-3.5 flex-none" />
        </a>
      ),
    });
  }
  rows.push({
    label: t(post.type === "lfp" ? "experienceWanted" : "experience"),
    value:
      experience.length === 0 ? (
        t("noExperience")
      ) : (
        <div className="flex flex-col items-end gap-0.5">
          {experience.map((item) => (
            <span key={item.level}>
              {item.label} <span className="font-normal text-neutral-500">{item.duration}</span>
            </span>
          ))}
        </div>
      ),
  });
  if (post.weeklyMinutes > 0) {
    rows.push({ label: t("rhythm"), value: t("rhythmValue", { hours: Math.round((post.weeklyMinutes / 60) * 10) / 10, days: post.activeDays }) });
  }

  return (
    <dl className="flex flex-col divide-y divide-neutral-800/80">
      {rows.map((row) => (
        <div key={row.label} className="flex items-start justify-between gap-4 py-2.5 first:pt-0 last:pb-0">
          <dt className="pt-0.5 text-[13px] text-neutral-500">{row.label}</dt>
          <dd className="text-right text-[13.5px] font-medium text-neutral-200">{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function DiscordIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 flex-none text-[#5865F2]" fill="currentColor" aria-hidden="true">
      <path d="M20.3 4.4A19.8 19.8 0 0015.4 3l-.6 1.3a18.4 18.4 0 00-5.6 0L8.6 3a19.7 19.7 0 00-4.9 1.4C.6 9 0 13.6.3 18.1a19.9 19.9 0 006 3l1.3-2a13 13 0 01-2-1l.5-.4a14.2 14.2 0 0012 0l.5.4c-.6.4-1.3.7-2 1l1.3 2a19.8 19.8 0 006-3c.5-5.2-.8-9.7-3.6-13.7zM8.3 15.3c-1.2 0-2.2-1.1-2.2-2.4s1-2.4 2.2-2.4 2.2 1.1 2.2 2.4-1 2.4-2.2 2.4zm7.4 0c-1.2 0-2.2-1.1-2.2-2.4s1-2.4 2.2-2.4 2.2 1.1 2.2 2.4-1 2.4-2.2 2.4z" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 flex-none" fill="currentColor" aria-hidden="true">
      <path d="M17.8 3h3.1l-6.8 7.8L22 21h-6.2l-4.9-6.4L5.3 21H2.2l7.3-8.3L1.9 3h6.4l4.4 5.8L17.8 3zm-1.1 16.2h1.7L7.4 4.7H5.6l11.1 14.5z" />
    </svg>
  );
}
