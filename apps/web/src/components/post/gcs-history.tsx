/**
 * GC-Scouting - gcs-history
 *
 * Team history and results pulled from GC Stats.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

import { useFormatter, useLocale, useTranslations } from "next-intl";
import { ExternalLinkIcon } from "lucide-react";
import type { GcsPlacement, GcsTeamRole } from "@scouting/db";
import type { PostView } from "@/lib/posts";
import { gcsPlayerUrl, gcsTeamUrl, gcsTournamentUrl, monthYear } from "@/lib/gcs";
import { GcsMark } from "@/components/gcs-mark";
import { ProfileBadge } from "./badges";
import { GcsLogo } from "./gcs-logo";
import { GcsSummaryRefresh } from "./gcs-summary-refresh";
import { GcsSummaryPending } from "./gcs-summary-pending";

// Role colors of GC Stats rosters: vivid for the current team, muted for former ones.
const ROLE_COLOR: Record<"player" | "sub" | "manager" | "staff", [current: string, former: string]> = {
  player: ["#e4ae22", "#9c8a5c"],
  sub: ["#7dd3fc", "#6f95a8"],
  manager: ["#fdba74", "#a4826a"],
  staff: ["#d8b4fe", "#8c7f9e"],
};

function roleColor(role: GcsTeamRole, current: boolean): string {
  const group = role === "player" || role === "player-igl" ? "player" : role === "sub" || role === "manager" ? role : "staff";
  return ROLE_COLOR[group][current ? 0 : 1];
}

const PODIUM = ["#e8c04f", "#c9d1d6", "#b8804a"];

/** GC Stats band of the post header: totals, latest teams and latest tournaments. `awaiting`: the history is being fetched. */
export function GcsHistory({ post, canRefresh, awaiting }: { post: PostView; canRefresh: boolean; awaiting: boolean }) {
  const t = useTranslations("postPage");
  const tPost = useTranslations("post");
  const locale = useLocale();
  const format = useFormatter();
  const summary = post.gcsSummary;

  // gcsPersonId is only set once the link is approved, the team link is given by the author.
  const profileUrl = post.gcsPersonId ? gcsPlayerUrl(locale, post.gcsPersonId, post.displayName) : post.gcsTeamId ? gcsTeamUrl(locale, post.gcsTeamId, post.displayName) : null;
  // Pending links have no profile URL yet but can already be fetched.
  const refresh = canRefresh && !awaiting && (post.profile !== "none" || post.gcsTeamId !== null) && <GcsSummaryRefresh postId={post.id} />;
  const badge = post.profile !== "none" && <ProfileBadge status={post.profile} />;
  const actions = (profileUrl || refresh) && (
    <div className="ml-auto flex flex-wrap items-start justify-end gap-2">
      {refresh}
      {profileUrl && <GcsLink href={profileUrl} label={t(post.gcsPersonId ? "viewProfile" : "viewTeamProfile")} />}
    </div>
  );

  // No snapshot yet: the profile can still be linked, only the history is missing.
  if (post.profile === "none" || !summary) {
    return (
      <div>
        <div className="flex flex-wrap items-center gap-2.5">
          <GcsMark />
          {badge}
          {post.profile === "none" && !post.gcsTeamId && <p className="text-[13px] text-neutral-500">{t("noProfile")}</p>}
          {actions}
        </div>
        {post.profile === "pending" && <p className="mt-3 rounded-lg bg-[var(--sc-surface-2)] px-3 py-2 text-[12.5px] text-neutral-400">{t("pendingNote")}</p>}
        {awaiting && <GcsSummaryPending postId={post.id} />}
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <GcsMark />
        <h2 className="text-[12px] font-extrabold tracking-[0.13em] text-neutral-50 uppercase">{t("gcsHistory")}</h2>
        {badge}
        <span className="text-[13px] font-semibold text-neutral-300">{tPost("tournaments", { count: summary.tournaments })}</span>
        {summary.bestPlacement && (
          <span className="text-[13px] text-neutral-500">
            {t("bestResult")} <Placement placement={summary.bestPlacement} />
          </span>
        )}
        {post.gcsSummarySyncedAt && (
          <span className="text-[12px] text-neutral-500">{t("syncedAt", { date: format.relativeTime(new Date(post.gcsSummarySyncedAt), new Date()) })}</span>
        )}
        {actions}
      </div>

      {post.profile === "pending" && <p className="mt-3 rounded-lg bg-[var(--sc-surface-2)] px-3 py-2 text-[12.5px] text-neutral-400">{t("pendingNote")}</p>}

      <div className={summary.teams.length > 0 ? "mt-4 grid gap-4 lg:grid-cols-2" : "mt-4"}>
        {summary.teams.length > 0 && (
          <HistoryList title={t("latestTeams")}>
            {summary.teams.map((team) => {
              const current = team.until === null;
              return (
                <HistoryRow key={`${team.id}-${team.since}`} href={gcsTeamUrl(locale, team.id, team.name)}>
                  <GcsLogo src={team.logoUrl} name={team.name} kind="team" />
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="truncate text-[13.5px] font-semibold text-neutral-100">{team.name}</span>
                    <span className="font-mono text-[9.5px] tracking-widest uppercase" style={{ color: roleColor(team.role, current) }}>
                      {t(`teamRoles.${team.role}`, { pronoun: summary.pronoun ?? "inclusive" })}
                    </span>
                  </span>
                  <span className="font-mono text-[10.5px] whitespace-nowrap text-neutral-500">
                    {monthYear(team.since) ?? t("unknownDate")} - {current ? t("present") : (monthYear(team.until) ?? t("unknownDate"))}
                  </span>
                </HistoryRow>
              );
            })}
          </HistoryList>
        )}

        <HistoryList title={t("latestTournaments")}>
          {summary.recentTournaments.length === 0 ? (
            <p className="p-3 text-[13px] text-neutral-500">{t("noTournaments")}</p>
          ) : (
            summary.recentTournaments.map((tournament) => (
              <HistoryRow key={tournament.id} href={gcsTournamentUrl(locale, tournament.id, tournament.name)}>
                <GcsLogo src={tournament.logoUrl} name={tournament.name} kind="tournament" />
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="truncate text-[13.5px] font-semibold text-neutral-100">{tournament.name}</span>
                  <span className="font-mono text-[10.5px] text-neutral-500">{monthYear(tournament.date)}</span>
                </span>
                <span className="flex flex-col items-end gap-0.5">
                  <span className="text-[13px] font-bold whitespace-nowrap">{tournament.placement ? <Placement placement={tournament.placement} /> : "-"}</span>
                  {tournament.record && (
                    <span className="font-mono text-[10.5px] whitespace-nowrap text-neutral-500" title={t("recordTitle", tournament.record)}>
                      <span className="text-emerald-400">{t("wins", { n: tournament.record.wins })}</span> - <span className="text-red-400">{t("losses", { n: tournament.record.losses })}</span>
                    </span>
                  )}
                </span>
              </HistoryRow>
            ))
          )}
        </HistoryList>
      </div>
    </div>
  );
}

function Placement({ placement: [best, worst] }: { placement: GcsPlacement }) {
  const t = useTranslations("postPage");
  return (
    <span className="font-bold" style={{ color: PODIUM[best - 1] ?? "var(--sc-text-dim)" }}>
      {best === worst ? t("place", { n: best }) : t("top", { n: worst })}
    </span>
  );
}

function HistoryList({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <h3 className="mb-2 text-[11.5px] font-semibold tracking-[0.12em] text-neutral-500 uppercase">{title}</h3>
      <div className="overflow-hidden rounded-xl border border-neutral-800">{children}</div>
    </div>
  );
}

function HistoryRow({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="grid grid-cols-[30px_minmax(0,1fr)_auto] items-center gap-2.5 border-b border-neutral-800/70 bg-[var(--sc-surface-2)] p-2.5 transition-colors last:border-b-0 hover:bg-[var(--sc-hover)] active:bg-[var(--sc-hover-2)]"
    >
      {children}
    </a>
  );
}

function GcsLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-neutral-800 bg-[var(--sc-surface-2)] px-2.5 text-[12.5px] font-semibold text-neutral-100 transition-all hover:bg-[var(--sc-hover)] active:scale-[0.97]"
    >
      {label}
      <ExternalLinkIcon className="h-3.5 w-3.5" />
    </a>
  );
}
