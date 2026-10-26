/**
 * GC-Scouting - root page
 *
 * Home page: hero, post types, latest posts and explanations.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

import { useLocale, useTranslations } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { connection } from "next/server";
import { Link } from "@/i18n/navigation";
import { TOURNAMENT_LEVELS } from "@scouting/db/constants";
import { shareImageVersion } from "@scouting/db/share-image";
import { postRankRange } from "@/lib/posts";
import { DEMO_POST, HERO_DEMOS, type DemoPost } from "@/lib/demo-post";
import { AGENTS_BY_SLUG } from "@/lib/agents";
import { REGION_COLOR } from "@/lib/regions";
import { POST_TYPES } from "@/lib/post-types";
import { TIERS } from "@/lib/tiers";
import { TierListView } from "@/components/post/tier-list";
import { CheckIcon, PostTypeBadge, ProfileBadge, RankChip } from "@/components/post/badges";
import { RankIcon } from "@/components/post/rank-icon";
import { RANK_BY_KEY, rankKey } from "@/lib/ranks";
import { PostTags } from "@/components/post/post-card";
import { LanguageFlags } from "@/components/post/language-flags";
import { TopExperience } from "@/components/post/experience";
import { socialLinks } from "@/lib/social";
import { OptionalImage } from "@/components/ui/optional-image";

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale);
  // A new example post on every load.
  await connection();
  const demo = HERO_DEMOS[Math.floor(Math.random() * HERO_DEMOS.length)]!;
  return (
    <>
      <Hero demo={demo} />
      <TypesSection />
      <HowSection />
      <TierlistSection />
      <VerifiedSection />
      <DiscordSection />
      <TwitterSection />
      <FinalCta />
    </>
  );
}

function Container({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`mx-auto max-w-[1400px] px-4 sm:px-6 ${className}`}>{children}</div>;
}

function SectionHeading({ title, sub, action }: { title: string; sub?: string; action?: React.ReactNode }) {
  return (
    <div className="mb-7 flex flex-wrap items-end gap-x-6 gap-y-2">
      <div className="max-w-2xl">
        <h2 className="text-[22px] font-bold tracking-tight text-neutral-50 sm:text-[26px]">{title}</h2>
        {sub && <p className="mt-2 text-[14.5px] leading-relaxed text-neutral-500">{sub}</p>}
      </div>
      {action && <div className="ml-auto">{action}</div>}
    </div>
  );
}

function PrimaryButton({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex h-11 items-center gap-2 rounded-[11px] bg-[var(--sc-accent)] px-5 text-[14.5px] font-bold text-[var(--sc-accent-ink)] transition-all hover:brightness-110 active:scale-[0.97]"
    >
      {children}
      <ArrowIcon />
    </Link>
  );
}

function SecondaryButton({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex h-11 items-center rounded-[11px] border border-neutral-800 bg-[var(--sc-surface)] px-5 text-[14.5px] font-semibold text-neutral-200 transition-all hover:border-[var(--sc-hover-2)] hover:bg-[var(--sc-hover)] active:scale-[0.97]"
    >
      {children}
    </Link>
  );
}

function Hero({ demo }: { demo: DemoPost }) {
  const t = useTranslations("home.hero");

  return (
    <section className="relative overflow-hidden border-b border-neutral-800">
      <div className="sc-glow pointer-events-none absolute -top-56 right-[-15%] h-[820px] w-[820px] opacity-80" />

      <Container className="relative grid items-center gap-12 py-14 sm:py-20 lg:grid-cols-[minmax(0,1fr)_minmax(0,560px)] lg:py-24">
        <div>
          <h1 className="text-[40px] leading-[1.02] font-bold tracking-[-0.035em] text-neutral-50 sm:text-[56px] lg:text-[64px]">
            {t.rich("title", {
              accent: (chunks) => <span className="block text-[var(--sc-accent)]">{chunks}</span>,
            })}
          </h1>

          <p className="mt-6 max-w-[560px] text-[16px] leading-relaxed text-neutral-400 sm:text-[17px]">{t("subtitle")}</p>

          <div className="mt-8 flex flex-wrap gap-3">
            <PrimaryButton href="/posts">{t("ctaBrowse")}</PrimaryButton>
            <SecondaryButton href="/posts/new">{t("ctaPost")}</SecondaryButton>
          </div>
        </div>

        <DemoPostCard post={demo} />
      </Container>
    </section>
  );
}

function DemoPostCard({ post }: { post: DemoPost }) {
  const tPost = useTranslations("post");
  const tPage = useTranslations("postPage");
  const tDemo = useTranslations("home.hero.demo");
  const tCompensation = useTranslations("compensation");
  const tLan = useTranslations("lan");
  const tMinors = useTranslations("minorsPolicy");
  const rank = postRankRange(post);

  const rows: [label: string, value: string][] = [];
  if (post.playersWanted !== null && post.subsWanted !== null) {
    const wanted = [
      post.playersWanted > 0 && tPage("playersWanted", { count: post.playersWanted }),
      post.subsWanted > 0 && tPage("subsWanted", { count: post.subsWanted }),
    ];
    rows.push([tPage("rosterSpotWanted"), wanted.filter(Boolean).join(", ")]);
  }
  if (post.compensation) rows.push([tPage("compensation"), tCompensation(post.compensation)]);
  if (post.lan) rows.push([tPage("lan"), tLan(post.lan)]);
  if (post.minorsAccepted !== null) rows.push([tPage("minorsAccepted"), tMinors(post.minorsAccepted ? "accepted" : "adultsOnly")]);
  rows.push([tPage("rhythm"), tPage("rhythmValue", { hours: Math.round((post.weeklyMinutes / 60) * 10) / 10, days: post.activeDays })]);

  return (
    <Link href={`/posts/${post.type}`} className="group relative block transition-transform active:scale-[0.99]">
      <div className="relative rounded-2xl border border-neutral-800 bg-[var(--sc-surface)]/95 p-4 transition-colors group-hover:border-[var(--sc-hover-2)] shadow-[0_30px_80px_-30px_rgb(0_0_0/0.8)] backdrop-blur sm:p-5">
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <PostTypeBadge type={post.type} />
              <span className="text-[16px] font-semibold tracking-tight text-neutral-50">{post.displayName}</span>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-2 text-[12.5px] text-neutral-500">
              <span className="font-medium text-neutral-300 uppercase">{post.region}</span>
              <LanguageFlags languages={post.languages} />
              {post.gcsSummary && <span>{tPost("tournaments", { count: post.gcsSummary.tournaments })}</span>}
            </div>
          </div>
          {post.profile !== "none" && <ProfileBadge status={post.profile} />}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-1.5">
          <PostTags post={post} />
          <TopExperience experience={post.experience} />
          {rank && (
            <span className="ml-auto">
              <RankChip rank={rank.rank} rankMax={rank.rankMax} />
            </span>
          )}
        </div>

        {post.tierList ? (
          <TierListView tierList={post.tierList} iconSize={34} className="mt-4" />
        ) : (
          <>
            <dl className="mt-4 divide-y divide-neutral-800/80 rounded-xl border border-neutral-800 bg-[var(--sc-surface-2)] text-[13px]">
              {rows.map(([label, value]) => (
                <div key={label} className="flex items-center justify-between gap-4 px-3.5 py-2.5">
                  <dt className="text-neutral-500">{label}</dt>
                  <dd className="text-right font-medium text-neutral-200">{value}</dd>
                </div>
              ))}
            </dl>
            {(post.type === "lfp" || post.type === "lfs") && (
              <p className="mt-4 border-l-2 border-neutral-800 pl-3 text-[13.5px] leading-relaxed text-neutral-400">{tDemo(post.type)}</p>
            )}
          </>
        )}
      </div>
    </Link>
  );
}

function TypesSection() {
  const t = useTranslations("home.types");
  return (
    <section className="py-16 sm:py-20">
      <Container>
        <SectionHeading title={t("heading")} sub={t("sub")} />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {POST_TYPES.map((type) => (
            <Link
              key={type.key}
              href={`/posts/${type.key}`}
              className="group flex flex-col rounded-xl border border-neutral-800 bg-[var(--sc-surface)] p-4 transition-all hover:-translate-y-0.5 hover:bg-[var(--sc-hover)] active:scale-[0.98]"
              style={{ borderTop: `3px solid ${type.color}` }}
            >
              <span className="font-mono text-[22px] font-black tracking-wider" style={{ color: type.color }}>
                {type.code}
              </span>
              <span className="mt-2 text-[14px] font-semibold text-neutral-100">{t(`${type.key}.label`)}</span>
              <span className="mt-1 text-[13px] leading-relaxed text-neutral-500">{t(`${type.key}.desc`)}</span>
            </Link>
          ))}
        </div>
      </Container>
    </section>
  );
}

function HowSection() {
  const t = useTranslations("home.how");
  const steps = ["step1", "step2", "step3"] as const;
  return (
    <section className="border-y border-neutral-800 bg-[var(--sc-surface-2)] py-16 sm:py-20">
      <Container>
        <SectionHeading title={t("heading")} />
        <div className="grid gap-3 md:grid-cols-3">
          {steps.map((step, i) => (
            <div key={step} className="relative overflow-hidden rounded-xl border border-neutral-800 bg-[var(--sc-surface)] p-5">
              <span className="font-mono text-[12px] font-black tracking-widest text-[var(--sc-accent)]">0{i + 1}</span>
              <h3 className="mt-3 text-[16px] font-semibold tracking-tight text-neutral-50">{t(`${step}.title`)}</h3>
              <p className="mt-2 text-[13.5px] leading-relaxed text-neutral-500">{t(`${step}.body`)}</p>
              <span className="pointer-events-none absolute -right-2 -bottom-6 font-mono text-[96px] leading-none font-black text-white/[0.03]">{i + 1}</span>
            </div>
          ))}
        </div>
        <div className="mt-3 flex items-center gap-3 rounded-xl border border-dashed border-neutral-800 px-5 py-3.5">
          <span className="flex h-7 w-7 flex-none items-center justify-center rounded-lg bg-[color-mix(in_oklab,var(--sc-accent)_14%,transparent)] text-[var(--sc-accent)]">
            <RefreshIcon />
          </span>
          <p className="text-[13.5px] text-neutral-400">
            <span className="font-semibold text-neutral-100">{t("freshTitle")}.</span> {t("freshBody")}
          </p>
        </div>
      </Container>
    </section>
  );
}

function TierlistSection() {
  const t = useTranslations("home.tierlist");
  const tTiers = useTranslations("tiers");
  return (
    <section className="py-16 sm:py-20">
      <Container className="grid items-center gap-10 lg:grid-cols-2">
        <div>
          <h2 className="text-[22px] font-bold tracking-tight text-neutral-50 sm:text-[26px]">{t("heading")}</h2>
          <p className="mt-3 max-w-lg text-[14.5px] leading-relaxed text-neutral-500">{t("body")}</p>
          <ol className="mt-6 flex flex-col gap-2">
            {TIERS.map((tier, i) => (
              <li key={tier.key} className="flex items-center gap-3 text-[13.5px] text-neutral-300">
                <span className="flex h-6 w-6 items-center justify-center rounded-md text-[11px] font-black text-[#141414]" style={{ background: tier.color }}>
                  {i + 1}
                </span>
                {tTiers(tier.key)}
              </li>
            ))}
          </ol>
          <p className="mt-6 border-l-2 border-[var(--sc-accent)] pl-3 text-[13px] text-neutral-500">{t("filterHint")}</p>
        </div>
        {DEMO_POST.tierList && <TierListView tierList={DEMO_POST.tierList} iconSize={40} />}
      </Container>
    </section>
  );
}

function VerifiedSection() {
  const t = useTranslations("home.verified");
  const states = [
    { key: "verified", badge: <ProfileBadge status="verified" label={t("verified")} />, hint: t("verifiedHint") },
    { key: "pending", badge: <ProfileBadge status="pending" label={t("pending")} />, hint: t("pendingHint") },
    {
      key: "none",
      badge: <span className="inline-flex rounded-md border border-neutral-800 px-1.5 py-0.5 text-[11px] font-semibold text-neutral-500">{t("none")}</span>,
      hint: t("noneHint"),
    },
  ];
  return (
    <section className="border-y border-neutral-800 bg-[var(--sc-surface-2)] py-16 sm:py-20">
      <Container className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <div>
          <h2 className="text-[22px] font-bold tracking-tight text-neutral-50 sm:text-[26px]">{t("heading")}</h2>
          <p className="mt-3 max-w-lg text-[14.5px] leading-relaxed text-neutral-500">{t("body")}</p>
        </div>
        <div className="flex flex-col gap-2">
          {states.map((s) => (
            <div key={s.key} className="flex items-center gap-4 rounded-xl border border-neutral-800 bg-[var(--sc-surface)] px-4 py-3.5">
              <div className="w-36 flex-none">{s.badge}</div>
              <p className="text-[13.5px] text-neutral-400">{s.hint}</p>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}

const DISCORD_COLOR = "#5865F2";
/** Same cap as the bot. */
const DISCORD_AGENTS_MAX = 5;

function DiscordSection() {
  const t = useTranslations("home.discord");
  const { discordBot } = socialLinks();
  const steps = ["add", "channel", "filters", "receive"] as const;
  return (
    <section className="py-16 sm:py-20">
      <Container className="grid items-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,520px)]">
        <div>
          <span className="inline-flex items-center gap-2 text-[12px] font-bold tracking-widest uppercase" style={{ color: DISCORD_COLOR }}>
            <DiscordIcon />
            {t("eyebrow")}
          </span>
          <h2 className="mt-3 text-[22px] font-bold tracking-tight text-neutral-50 sm:text-[26px]">{t("heading")}</h2>
          <p className="mt-3 max-w-lg text-[14.5px] leading-relaxed text-neutral-500">{t("body")}</p>

          <ol className="mt-7 flex flex-col gap-2">
            {steps.map((step, i) => (
              <li key={step} className="flex gap-4 rounded-xl border border-neutral-800 bg-[var(--sc-surface)] px-4 py-3.5">
                <span
                  className="flex h-7 w-7 flex-none items-center justify-center rounded-lg font-mono text-[12px] font-black"
                  style={{ color: DISCORD_COLOR, background: `color-mix(in oklab, ${DISCORD_COLOR} 16%, transparent)` }}
                >
                  {i + 1}
                </span>
                <div className="min-w-0">
                  <h3 className="text-[14.5px] font-semibold tracking-tight text-neutral-50">{t(`steps.${step}.title`)}</h3>
                  <p className="mt-0.5 text-[13.5px] leading-relaxed text-neutral-500">{t(`steps.${step}.body`)}</p>
                </div>
              </li>
            ))}
          </ol>

          {discordBot && (
            <a
              href={discordBot}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-7 inline-flex h-11 items-center gap-2 rounded-[11px] px-5 text-[14.5px] font-bold text-white transition-all hover:brightness-110 active:scale-[0.97]"
              style={{ background: DISCORD_COLOR }}
            >
              <DiscordIcon />
              {t("cta")}
            </a>
          )}
        </div>

        <DiscordPreview />
      </Container>
    </section>
  );
}

/** Mock of a bot message in a feed channel, same blocks as the bot's post container (apps/bot post-message). */
function DiscordPreview() {
  const t = useTranslations("home.discord.preview");
  const tPost = useTranslations("post");
  const tTypes = useTranslations("home.types");
  const tRoles = useTranslations("roles");
  const tIgl = useTranslations("igl");
  const tRegions = useTranslations("regions");
  const tSpots = useTranslations("rosterSpots");
  const tLevels = useTranslations("levels");
  const tDuration = useTranslations("duration");
  const locale = useLocale();
  const post = DEMO_POST;
  const rank = rankKey(post.rankCurrent);
  const peak = rankKey(post.rankPeak);
  const languageNames = new Intl.DisplayNames([locale], { type: "language" });
  const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);
  const duration = (months: number) =>
    months >= 12 && months % 12 === 0 ? tDuration("years", { count: months / 12 }) : tDuration("months", { count: months });

  const profile: [string, string][] = [
    [t("rank"), rank ? RANK_BY_KEY[rank].label + (peak && peak !== rank ? ` · ${t("peak", { rank: RANK_BY_KEY[peak].label })}` : "") : ""],
    [t("roles"), [...post.roles.map((r) => tRoles(r)), ...post.igl.map((r) => tIgl(r))].join(" · ")],
    [t("agents"), post.strongAgents.slice(0, DISCORD_AGENTS_MAX).map((slug) => AGENTS_BY_SLUG[slug]?.name ?? slug).join(" · ")],
  ];
  const practical: [string, string][] = [
    [
      t("experience"),
      [...TOURNAMENT_LEVELS]
        .reverse()
        .filter((level) => (post.experience[level] ?? 0) > 0)
        .map((level) => `${tLevels(level)} (${duration(post.experience[level]!)})`)
        .join(" · "),
    ],
    [t("languages"), post.languages.map((code) => capitalize(languageNames.of(code) ?? code)).join(" · ")],
    [t("rhythm"), t("rhythmValue", { hours: Math.round((post.weeklyMinutes / 60) * 10) / 10, days: post.activeDays })],
  ];
  const filters = [t("filterType"), tRegions(post.region), t("filterRole"), t("filterRank")];

  return (
    <div>
      <div className="overflow-hidden rounded-2xl border border-neutral-800 bg-[var(--dc-bg)] text-[var(--dc-text)] shadow-[0_30px_80px_-30px_rgb(0_0_0/0.8)]">
        <div className="flex items-center gap-2 border-b border-[var(--dc-border)] px-4 py-3 text-[14px] font-semibold text-[var(--dc-strong)]">
          <span className="text-[20px] leading-none font-normal text-[var(--dc-muted)]">#</span>
          {t("channel")}
        </div>

        <div className="flex gap-3 px-4 py-4">
          <span className="flex h-10 w-10 flex-none items-center justify-center rounded-full text-white" style={{ background: DISCORD_COLOR }}>
            <DiscordIcon />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="text-[15px] font-medium text-[var(--dc-strong)]">GC Scouting</span>
              <span className="inline-flex items-center gap-0.5 rounded-[4px] px-1 text-[10px] leading-[15px] font-semibold text-white" style={{ background: DISCORD_COLOR }}>
                <CheckIcon className="h-2.5 w-2.5" />
                {t("app")}
              </span>
              <span className="ml-1 text-[12px] text-[var(--dc-muted)]">{t("time")}</span>
            </div>

            <div
              className="mt-1.5 flex max-w-[460px] flex-col gap-2 rounded-lg border border-[var(--dc-border)] bg-[var(--dc-container)] p-4 text-[14px] leading-[1.375]"
              style={{ borderLeft: `4px solid ${REGION_COLOR[post.region]}` }}
            >
              <div className="flex gap-4">
                <div className="min-w-0 flex-1">
                  <p className="text-[20px] leading-[1.375] font-bold text-[var(--dc-strong)]">
                    {post.displayName} ({post.type.toUpperCase()})
                  </p>
                  <p className="flex flex-wrap items-center gap-x-1.5">
                    {post.country && (
                      <span className={`fi fi-${post.country.toLowerCase()} flex-none rounded-[2px]`} style={{ width: 18, height: 13.5, lineHeight: "13.5px" }} />
                    )}
                    <span>{tRegions(post.region)}</span>
                    {post.rosterSpot && <span>· {tSpots(post.rosterSpot)}</span>}
                  </p>
                  <p className="text-[12px] text-[var(--dc-muted)]">
                    {tTypes(`${post.type}.label`)} · {t("published")}
                  </p>
                </div>
                {rank && (
                  <span className="flex h-[85px] w-[85px] flex-none items-center justify-center rounded-lg bg-[var(--dc-bg)]">
                    <RankIcon rank={rank} size={60} />
                  </span>
                )}
              </div>

              <DiscordFields fields={profile} />
              <DiscordFields fields={practical} />

              {post.tierList && (
                <OptionalImage
                  src={`/api/home/share-image?v=${shareImageVersion(post)}`}
                  alt={t("tierlistAlt", { name: post.displayName })}
                  width={1200}
                  height={630}
                  loading="lazy"
                  className="mt-1 h-auto w-full rounded-lg bg-[var(--dc-bg)]"
                />
              )}

              <div className="mt-2 flex flex-wrap gap-2">
                <DiscordLinkButton>{tPost("view")}</DiscordLinkButton>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1.5 px-1">
        <span className="mr-1 text-[12px] text-neutral-500">{t("filtersLabel", { channel: t("channel") })}</span>
        {filters.map((f) => (
          <span key={f} className="rounded-md border border-neutral-800 bg-[var(--sc-surface)] px-2 py-0.5 text-[12px] font-medium text-neutral-300">
            {f}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Separator then "**Label** value" lines, empty values skipped. */
function DiscordFields({ fields }: { fields: [label: string, value: string][] }) {
  const kept = fields.filter(([, value]) => value);
  if (kept.length === 0) return null;
  return (
    <>
      <hr className="my-1 border-[var(--dc-border)]" />
      <div>
        {kept.map(([label, value]) => (
          <p key={label}>
            <strong className="font-semibold text-[var(--dc-strong)]">{label}</strong> {value}
          </p>
        ))}
      </div>
    </>
  );
}

/** Discord link button (secondary style with the external arrow), decorative only. */
function DiscordLinkButton({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex h-8 items-center gap-1.5 rounded-[8px] bg-[var(--dc-button)] px-3 text-[14px] font-medium text-[var(--dc-button-text)]">
      {children}
      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 01-1 1H5a1 1 0 01-1-1V7a1 1 0 011-1h5" />
      </svg>
    </span>
  );
}

function TwitterSection() {
  const t = useTranslations("home.twitter");
  const { twitter } = socialLinks();
  if (!twitter) return null;
  return (
    <section className="pb-16 sm:pb-20">
      <Container>
        <div className="flex flex-wrap items-center gap-4 rounded-xl border border-neutral-800 bg-[var(--sc-surface)] p-5">
          <span className="flex h-10 w-10 flex-none items-center justify-center rounded-[10px] border border-neutral-800 bg-[var(--sc-surface-2)] text-neutral-100">
            <XIcon />
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="text-[15px] font-semibold tracking-tight text-neutral-50">{t("title")}</h3>
            <p className="mt-1 text-[13.5px] leading-relaxed text-neutral-500">{t("body")}</p>
          </div>
          <a
            href={twitter}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-10 items-center gap-1.5 rounded-[10px] border border-neutral-800 bg-[var(--sc-surface-2)] px-4 text-[13px] font-semibold text-neutral-200 transition-all hover:border-[var(--sc-hover-2)] hover:bg-[var(--sc-hover)] active:scale-[0.97]"
          >
            {t("cta")}
            <ArrowIcon />
          </a>
        </div>
      </Container>
    </section>
  );
}

function FinalCta() {
  const t = useTranslations("home.cta");
  return (
    <section className="pb-20">
      <Container>
        <div className="relative overflow-hidden rounded-2xl border border-neutral-800 bg-[var(--sc-surface)] px-6 py-12 text-center sm:px-12">
          <div className="sc-glow pointer-events-none absolute -bottom-40 left-1/2 h-[420px] w-[720px] -translate-x-1/2 opacity-60" />
          <div className="relative">
            <h2 className="text-[26px] font-bold tracking-tight text-neutral-50 sm:text-[32px]">{t("title")}</h2>
            <p className="mx-auto mt-3 max-w-md text-[14.5px] text-neutral-500">{t("body")}</p>
            <div className="mt-7 flex justify-center">
              <PrimaryButton href="/posts">{t("button")}</PrimaryButton>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}

function ArrowIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

function RefreshIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 11a8 8 0 10-2.3 5.7M20 5v6h-6" />
    </svg>
  );
}

function DiscordIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden="true">
      <path d="M20.3 4.4A19.8 19.8 0 0015.4 3l-.6 1.3a18.4 18.4 0 00-5.6 0L8.6 3a19.7 19.7 0 00-4.9 1.4C.6 9 0 13.6.3 18.1a19.9 19.9 0 006 3l1.3-2a13 13 0 01-2-1l.5-.4a14.2 14.2 0 0012 0l.5.4c-.6.4-1.3.7-2 1l1.3 2a19.8 19.8 0 006-3c.5-5.2-.8-9.7-3.6-13.7zM8.3 15.3c-1.2 0-2.2-1.1-2.2-2.4s1-2.4 2.2-2.4 2.2 1.1 2.2 2.4-1 2.4-2.2 2.4zm7.4 0c-1.2 0-2.2-1.1-2.2-2.4s1-2.4 2.2-2.4 2.2 1.1 2.2 2.4-1 2.4-2.2 2.4z" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="currentColor" aria-hidden="true">
      <path d="M17.8 3h3.1l-6.8 7.8L22 21h-6.2l-4.9-6.4L5.3 21H2.2l7.3-8.3L1.9 3h6.4l4.4 5.8L17.8 3zm-1.1 16.2h1.7L7.4 4.7H5.6l11.1 14.5z" />
    </svg>
  );
}
