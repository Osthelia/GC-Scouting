/**
 * GC-Scouting - player-link-wizard
 *
 * Step by step flow to link a GC Stats player or team to the account.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

"use client";

import { useEffect, useMemo, useRef, useState, useTransition, type ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import { AlertTriangleIcon, ArrowLeftIcon, CheckCircle2Icon, ChevronRightIcon, ExternalLinkIcon, Loader2Icon, LockIcon, SearchIcon, SendIcon, TrophyIcon, UserIcon } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import {
  getGcsTournamentEntrants,
  linkGcsPlayer,
  searchGcsPlayers,
  searchGcsTournaments,
  type GcsEntrant,
  type GcsPlayerHit,
  type GcsTournamentHit,
  type LinkPlayerError,
  type LookupError,
  type LookupResult,
} from "@/actions/player-link";
import { GCS_SEARCH_MAX, GCS_SEARCH_MIN, gcsPlayerUrl } from "@/lib/gcs";
import { GcsLogo } from "@/components/post/gcs-logo";
import { UserAvatar } from "@/components/auth/user-menu";
import { LoginLink } from "@/components/auth/login-link";
import { TextInput } from "@/components/ui/field";
import { cn } from "@/lib/utils";

type Candidate = { id: number; handle: string; context: string | null };
type Mode = "name" | "tournament";

/** Debounced GC Stats search, only the latest answer is kept. */
function useLookup<T>(query: string, fetcher: (q: string) => Promise<LookupResult<T[]>>) {
  const [state, setState] = useState<{ query: string; data: T[]; error: LookupError | null } | null>(null);
  const [loading, setLoading] = useState(false);
  const latest = useRef("");
  const trimmed = query.trim();

  useEffect(() => {
    latest.current = trimmed;
    if (trimmed.length < GCS_SEARCH_MIN) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const timer = setTimeout(async () => {
      const result = await fetcher(trimmed).catch((): LookupResult<T[]> => ({ ok: false, error: "failed" }));
      if (latest.current !== trimmed) return;
      setState(result.ok ? { query: trimmed, data: result.data, error: null } : { query: trimmed, data: [], error: result.error });
      setLoading(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [trimmed, fetcher]);

  const current = trimmed.length >= GCS_SEARCH_MIN && state?.query === trimmed ? state : null;
  return { data: current?.data ?? [], error: current?.error ?? null, loading, searched: !!current };
}

/** Finds the visitor's GC Stats player profile (by name, or tournament then team then player) and sends the link request. `team`: asked to link a team page. */
export function PlayerLinkWizard({ reason = "player" }: { reason?: "player" | "team" }) {
  const t = useTranslations("playerLink");
  const [open, setOpen] = useState(false);
  const [declined, setDeclined] = useState(false);
  const [mode, setMode] = useState<Mode>("name");
  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [done, setDone] = useState<"pending" | "approved" | null>(null);

  if (done) {
    return (
      <Notice tone="success" icon={<CheckCircle2Icon className="h-4 w-4" />}>
        {t(done === "approved" ? "done.approved" : "done.pending")}
      </Notice>
    );
  }

  if (!open) {
    return (
      <div className="flex flex-col gap-3 rounded-xl border border-neutral-800 bg-[var(--sc-surface-2)] px-4 py-3.5 sm:flex-row sm:items-center">
        <p className="flex-1 text-[13px] leading-relaxed text-neutral-400">{t(reason === "team" ? (declined ? "declinedTeam" : "questionTeam") : declined ? "declined" : "question")}</p>
        {!declined && (
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setOpen(true)} className={buttonClass("primary")}>
              <SearchIcon className="h-4 w-4" />
              {t("yes")}
            </button>
            <button type="button" onClick={() => setDeclined(true)} className={buttonClass("secondary")}>
              {t("no")}
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <section className="rounded-2xl border border-neutral-800 bg-[var(--sc-surface)] p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-[16px] font-bold tracking-tight text-neutral-50">{t("title")}</h2>
          <p className="mt-1 text-[13px] leading-relaxed text-neutral-500">{t("intro")}</p>
        </div>
        <button type="button" onClick={() => setOpen(false)} className={buttonClass("ghost")}>
          {t("cancel")}
        </button>
      </div>

      <div className="mt-4">
        {candidate ? (
          <Confirm candidate={candidate} onBack={() => setCandidate(null)} onDone={setDone} />
        ) : (
          <>
            <div role="tablist" aria-label={t("modeLabel")} className="mb-4 grid grid-cols-2 gap-1 rounded-[11px] border border-neutral-800 bg-[var(--sc-surface-2)] p-1">
              {(["name", "tournament"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  role="tab"
                  aria-selected={mode === m}
                  onClick={() => setMode(m)}
                  className={cn(
                    "inline-flex h-9 items-center justify-center gap-2 rounded-lg text-[13px] font-semibold transition-all active:scale-[0.97]",
                    mode === m ? "bg-[var(--sc-hover-2)] text-neutral-50" : "text-neutral-500 hover:text-neutral-200"
                  )}
                >
                  {m === "name" ? <UserIcon className="h-4 w-4" /> : <TrophyIcon className="h-4 w-4" />}
                  {t(`mode.${m}`)}
                </button>
              ))}
            </div>
            {mode === "name" ? <NameSearch onPick={setCandidate} /> : <TournamentSearch onPick={setCandidate} />}
          </>
        )}
      </div>
    </section>
  );
}

function NameSearch({ onPick }: { onPick: (c: Candidate) => void }) {
  const t = useTranslations("playerLink");
  const [query, setQuery] = useState("");
  const { data, error, loading, searched } = useLookup<GcsPlayerHit>(query, searchGcsPlayers);

  return (
    <div>
      <SearchField value={query} onChange={setQuery} placeholder={t("namePlaceholder")} loading={loading} label={t("mode.name")} />
      <Results error={error} loading={loading} empty={searched && data.length === 0} hint={query.trim().length < GCS_SEARCH_MIN ? t("minChars", { min: GCS_SEARCH_MIN }) : null}>
        {data.map((p) => (
          <Row
            key={p.id}
            onClick={() => onPick({ id: p.id, handle: p.handle, context: p.subtitle })}
            icon={<UserAvatar user={{ username: p.handle, avatarUrl: p.logoUrl }} size={32} />}
            disabledLabel={p.claimed ? t("claimed") : undefined}
          >
            <span className="flex items-center gap-2">
              {p.countryCode && <span className={`fi fi-${p.countryCode.toLowerCase()} flex-none rounded-[2px]`} style={{ width: 16, height: 12 }} />}
              <span className="truncate">{p.handle}</span>
            </span>
            {p.subtitle && <span className="block truncate text-[12px] font-normal text-neutral-500">{p.subtitle}</span>}
          </Row>
        ))}
      </Results>
    </div>
  );
}

function TournamentSearch({ onPick }: { onPick: (c: Candidate) => void }) {
  const t = useTranslations("playerLink");
  const [query, setQuery] = useState("");
  const [tournament, setTournament] = useState<GcsTournamentHit | null>(null);
  const [entrants, setEntrants] = useState<{ tournamentId: number; data: GcsEntrant[]; error: LookupError | null } | null>(null);
  const [entrant, setEntrant] = useState<GcsEntrant | null>(null);
  const [teamQuery, setTeamQuery] = useState("");
  const { data, error, loading, searched } = useLookup<GcsTournamentHit>(tournament ? "" : query, searchGcsTournaments);

  useEffect(() => {
    if (!tournament) return;
    let active = true;
    getGcsTournamentEntrants(tournament.id)
      .catch((): LookupResult<GcsEntrant[]> => ({ ok: false, error: "failed" }))
      .then((result) => {
        if (active) setEntrants({ tournamentId: tournament.id, data: result.ok ? result.data : [], error: result.ok ? null : result.error });
      });
    return () => {
      active = false;
    };
  }, [tournament]);

  const teams = useMemo(() => {
    const needle = teamQuery.trim().toLowerCase();
    const list = entrants?.data ?? [];
    return needle ? list.filter((e) => e.name.toLowerCase().includes(needle) || e.roster.some((p) => p.handle.toLowerCase().includes(needle))) : list;
  }, [entrants, teamQuery]);

  if (tournament && entrant) {
    return (
      <div>
        <BackButton onClick={() => setEntrant(null)} label={entrant.name} />
        <p className="mb-2 text-[12.5px] text-neutral-500">{t("pickPlayer")}</p>
        <Results error={null} loading={false} empty={entrant.roster.length === 0} emptyLabel={t("emptyRoster")}>
          {entrant.roster.map((p) => (
            <Row key={p.id} onClick={() => onPick({ id: p.id, handle: p.handle, context: `${entrant.name}, ${tournament.name}` })} icon={<UserAvatar user={{ username: p.handle, avatarUrl: null }} size={32} />}>
              {p.handle}
            </Row>
          ))}
        </Results>
      </div>
    );
  }

  if (tournament) {
    const loadingTeams = entrants?.tournamentId !== tournament.id;
    return (
      <div>
        <BackButton
          onClick={() => {
            setTournament(null);
            setEntrants(null);
            setTeamQuery("");
          }}
          label={tournament.name}
        />
        <SearchField value={teamQuery} onChange={setTeamQuery} placeholder={t("teamPlaceholder")} loading={false} label={t("teamPlaceholder")} />
        <Results error={loadingTeams ? null : (entrants?.error ?? null)} loading={loadingTeams} empty={!loadingTeams && teams.length === 0} emptyLabel={t("emptyTeams")}>
          {teams.map((e) => (
            <Row key={e.id} onClick={() => setEntrant(e)} icon={<GcsLogo src={e.logoUrl} name={e.name} kind="team" size={32} />}>
              <span className="block truncate">{e.name}</span>
              <span className="block text-[12px] font-normal text-neutral-500">{t("players", { count: e.roster.length })}</span>
            </Row>
          ))}
        </Results>
      </div>
    );
  }

  return (
    <div>
      <SearchField value={query} onChange={setQuery} placeholder={t("tournamentPlaceholder")} loading={loading} label={t("mode.tournament")} />
      <Results error={error} loading={loading} empty={searched && data.length === 0} hint={query.trim().length < GCS_SEARCH_MIN ? t("minChars", { min: GCS_SEARCH_MIN }) : null}>
        {data.map((tm) => (
          <Row
            key={tm.id}
            onClick={() => {
              setTournament(tm);
              setTeamQuery("");
            }}
            icon={<GcsLogo src={tm.logoUrl} name={tm.name} kind="tournament" size={32} />}
          >
            <span className="block truncate">{tm.name}</span>
            {tm.subtitle && <span className="block truncate text-[12px] font-normal text-neutral-500">{tm.subtitle}</span>}
          </Row>
        ))}
      </Results>
    </div>
  );
}

function Confirm({ candidate, onBack, onDone }: { candidate: Candidate; onBack: () => void; onDone: (status: "pending" | "approved") => void }) {
  const t = useTranslations("playerLink");
  const locale = useLocale();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<LinkPlayerError | null>(null);

  const send = () => {
    setError(null);
    startTransition(async () => {
      const result = await linkGcsPlayer(candidate.id).catch(() => ({ ok: false as const, error: "failed" as const }));
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onDone(result.status);
      router.refresh();
    });
  };

  return (
    <div>
      <BackButton onClick={onBack} label={t("back")} disabled={pending} />
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-neutral-800 bg-[var(--sc-surface-2)] p-3.5">
        <UserAvatar user={{ username: candidate.handle, avatarUrl: null }} size={40} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold text-neutral-50">{candidate.handle}</p>
          {candidate.context && <p className="truncate text-[12.5px] text-neutral-500">{candidate.context}</p>}
        </div>
        <a
          href={gcsPlayerUrl(locale, candidate.id, candidate.handle)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-[var(--sc-accent)] transition-opacity hover:opacity-80 active:opacity-60"
        >
          {t("viewOnGcs")}
          <ExternalLinkIcon className="h-3.5 w-3.5" />
        </a>
      </div>
      <p className="mt-3 text-[13px] leading-relaxed text-neutral-400">{t("confirmText")}</p>

      {error && (
        <div className="mt-3">
          <Notice tone="error" icon={<AlertTriangleIcon className="h-4 w-4" />}>
            {t(`errors.${error}`)}
            {error === "reauth" && <LoginLink label={t("relogin")} small className="mt-2.5" />}
          </Notice>
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" onClick={send} disabled={pending} aria-busy={pending} className={buttonClass("primary")}>
          {pending ? <Loader2Icon className="h-4 w-4 animate-spin" /> : <SendIcon className="h-4 w-4" />}
          {t(pending ? "sending" : "send")}
        </button>
      </div>
    </div>
  );
}

function SearchField({ value, onChange, placeholder, loading, label }: { value: string; onChange: (v: string) => void; placeholder: string; loading: boolean; label: string }) {
  return (
    <div className="relative">
      <TextInput
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={label}
        maxLength={GCS_SEARCH_MAX}
        prefix={<SearchIcon className="h-4 w-4" />}
        autoComplete="off"
        spellCheck={false}
        autoFocus
      />
      {loading && <Loader2Icon className="absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 animate-spin text-neutral-500" />}
    </div>
  );
}

function Results({ error, loading, empty, emptyLabel, hint, children }: { error: LookupError | null; loading: boolean; empty: boolean; emptyLabel?: string; hint?: string | null; children: ReactNode }) {
  const t = useTranslations("playerLink");
  if (loading && !empty) {
    return (
      <div className="mt-3 flex flex-col gap-1.5" aria-busy="true" aria-label={t("loading")}>
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="h-[52px] animate-pulse rounded-xl bg-[var(--sc-surface-2)]" />
        ))}
      </div>
    );
  }
  if (error) {
    return (
      <div className="mt-3">
        <Notice tone="error" icon={<AlertTriangleIcon className="h-4 w-4" />}>
          {t(`lookupErrors.${error}`)}
        </Notice>
      </div>
    );
  }
  if (empty) return <p className="mt-3 text-[13px] text-neutral-500">{emptyLabel ?? t("empty")}</p>;
  if (hint) return <p className="mt-2 text-[12px] text-neutral-600">{hint}</p>;
  return <div className="mt-3 flex max-h-[360px] flex-col gap-1.5 overflow-y-auto">{children}</div>;
}

/** `disabledLabel`: the row cannot be picked, the label says why. */
function Row({ onClick, icon, disabledLabel, children }: { onClick: () => void; icon: ReactNode; disabledLabel?: string; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!!disabledLabel}
      className="flex min-h-[52px] w-full items-center gap-3 rounded-xl border border-neutral-800 bg-[var(--sc-surface-2)] px-3 py-2 text-left text-[13.5px] font-semibold text-neutral-100 transition-all hover:bg-[var(--sc-hover)] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-[var(--sc-surface-2)] disabled:active:scale-100"
    >
      {icon}
      <span className="min-w-0 flex-1">{children}</span>
      {disabledLabel ? (
        <span className="flex flex-none items-center gap-1 text-[11.5px] font-medium text-neutral-500">
          <LockIcon className="h-3.5 w-3.5" />
          {disabledLabel}
        </span>
      ) : (
        <ChevronRightIcon className="h-4 w-4 flex-none text-neutral-600" />
      )}
    </button>
  );
}

function BackButton({ onClick, label, disabled }: { onClick: () => void; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="mb-3 inline-flex max-w-full items-center gap-1.5 rounded-md py-1 text-[13px] font-semibold text-neutral-400 transition-colors hover:text-neutral-100 active:opacity-70 disabled:opacity-50"
    >
      <ArrowLeftIcon className="h-4 w-4 flex-none" />
      <span className="truncate">{label}</span>
    </button>
  );
}

function Notice({ tone, icon, children }: { tone: "error" | "success"; icon: ReactNode; children: ReactNode }) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "flex items-start gap-2.5 rounded-xl border px-3.5 py-3 text-[13px] leading-snug",
        tone === "error" ? "border-red-500/40 bg-red-500/10 text-red-200" : "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
      )}
    >
      <span className={cn("mt-0.5 flex-none", tone === "error" ? "text-red-400" : "text-emerald-400")}>{icon}</span>
      <div className="flex flex-col items-start">{children}</div>
    </div>
  );
}

function buttonClass(variant: "primary" | "secondary" | "ghost") {
  return cn(
    "inline-flex h-[38px] items-center gap-2 rounded-[10px] px-3.5 text-[13.5px] font-semibold transition-all active:scale-[0.97] disabled:opacity-70",
    variant === "primary" && "bg-[var(--sc-accent)] font-bold text-[var(--sc-accent-ink)] hover:brightness-110",
    variant === "secondary" && "border border-neutral-800 bg-[var(--sc-surface)] text-neutral-200 hover:bg-[var(--sc-hover)]",
    variant === "ghost" && "text-neutral-500 hover:bg-[var(--sc-hover)] hover:text-neutral-100"
  );
}
