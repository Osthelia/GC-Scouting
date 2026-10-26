/**
 * GC-Scouting - tier-list-editor
 *
 * Drag and drop editor of the agent tier list.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

"use client";

import { useId, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { CircleHelpIcon, ExternalLinkIcon, RotateCcwIcon } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { TIERS, groupByTier, type TierList } from "@/lib/tiers";
import { VALORANT_AGENTS, VALORANT_ROLES } from "@/lib/agents";
import { AgentIcon } from "@/components/post/agent-icon";
import { cn } from "@/lib/utils";

const POOL = "pool";
const ICON_SIZE = 56;

/** Drag and drop tierlist. An agent can also be picked with a click, then dropped with a click on a row. */
export function TierListEditor({ value, onChange, invalid }: { value: TierList; onChange: (value: TierList) => void; invalid?: boolean }) {
  const t = useTranslations("newPost.tierList");
  const tTiers = useTranslations("tiers");
  const tClasses = useTranslations("agentClasses");
  const [dragging, setDragging] = useState<string | null>(null);
  const [picked, setPicked] = useState<string | null>(null);

  // A stable id keeps the drag description ids equal between server and client.
  const dndId = useId();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 6 } }),
    useSensor(KeyboardSensor)
  );

  const rows = groupByTier(value);
  const pool = VALORANT_AGENTS.filter((a) => value[a.slug] === undefined);
  const ranked = VALORANT_AGENTS.length - pool.length;

  const move = (slug: string, target: string) => {
    const next = { ...value };
    // Re-inserted so the agent lands at the end of its row.
    delete next[slug];
    if (target !== POOL) next[slug] = Number(target);
    onChange(next);
    setPicked(null);
  };

  const onDragEnd = (e: DragEndEvent) => {
    setDragging(null);
    if (e.over) move(String(e.active.id), String(e.over.id));
  };

  const onRowClick = (target: string) => {
    if (picked) move(picked, target);
  };

  return (
    <DndContext id={dndId} sensors={sensors} onDragStart={(e) => setDragging(String(e.active.id))} onDragEnd={onDragEnd} onDragCancel={() => setDragging(null)}>
      <div className="group relative mb-3 inline-flex">
        <Link
          href="/tierlist"
          target="_blank"
          rel="noopener noreferrer"
          aria-describedby="tier-list-guide-tooltip"
          className="inline-flex h-[30px] items-center gap-1.5 rounded-lg border border-[color-mix(in_oklab,var(--sc-accent)_35%,transparent)] bg-[color-mix(in_oklab,var(--sc-accent)_8%,transparent)] px-2.5 text-[12.5px] font-semibold text-[var(--sc-accent)] transition-all hover:bg-[color-mix(in_oklab,var(--sc-accent)_16%,transparent)] active:scale-[0.95]"
        >
          <CircleHelpIcon className="h-3.5 w-3.5" />
          {t("guide")}
          <ExternalLinkIcon className="h-3 w-3 opacity-70" />
        </Link>
        <span
          id="tier-list-guide-tooltip"
          role="tooltip"
          className="pointer-events-none absolute top-full left-0 z-20 mt-1.5 w-[260px] rounded-lg border border-neutral-800 bg-[var(--sc-surface-2)] px-3 py-2 text-[12px] leading-relaxed text-neutral-300 opacity-0 shadow-[0_8px_24px_rgba(0,0,0,.45)] transition-opacity group-focus-within:opacity-100 group-hover:opacity-100"
        >
          {t("guideTooltip")}
        </span>
      </div>

      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[12.5px] text-neutral-500">{picked ? t("pickedHint") : t("hint")}</p>
        <div className="flex items-center gap-2">
          <span className={cn("text-[12.5px] font-semibold tabular-nums", ranked ? "text-[var(--sc-accent)]" : "text-neutral-400")}>
            {t("progress", { count: ranked })}
          </span>
          <button
            type="button"
            onClick={() => {
              onChange({});
              setPicked(null);
            }}
            disabled={ranked === 0}
            className="inline-flex h-[30px] items-center gap-1.5 rounded-lg border border-neutral-800 bg-[var(--sc-surface)] px-2.5 text-[12.5px] font-semibold text-neutral-400 transition-all hover:bg-[var(--sc-hover)] hover:text-neutral-100 active:scale-[0.95] disabled:pointer-events-none disabled:opacity-40"
          >
            <RotateCcwIcon className="h-3.5 w-3.5" />
            {t("reset")}
          </button>
        </div>
      </div>

      <div className={cn("overflow-hidden rounded-xl border bg-[var(--sc-surface-2)] select-none", invalid ? "border-red-500/70" : "border-neutral-800")}>
        {TIERS.map((tier, i) => (
          <DropRow key={tier.key} id={String(i)} active={!!picked} onClick={() => onRowClick(String(i))}>
            <div
              className="flex w-[88px] flex-none items-center justify-center px-2 py-1.5 text-center text-[11.5px] leading-tight font-bold text-[#141414] sm:w-[112px]"
              style={{ background: tier.color }}
            >
              {tTiers(tier.key)}
            </div>
            <div className="flex min-h-[68px] flex-1 flex-wrap content-center gap-1.5 p-1.5">
              {rows[i]!.map((slug) => (
                <DraggableAgent key={slug} slug={slug} picked={picked === slug} hidden={dragging === slug} onPick={() => setPicked((p) => (p === slug ? null : slug))} />
              ))}
            </div>
          </DropRow>
        ))}
      </div>

      <DropRow id={POOL} active={!!picked} onClick={() => onRowClick(POOL)} className="mt-3 rounded-xl border border-dashed border-neutral-800 select-none">
        {pool.length === 0 ? (
          <p className="flex min-h-[76px] flex-1 items-center px-3 text-[12.5px] text-neutral-600">{t("poolEmpty")}</p>
        ) : (
          <div className="grid flex-1 gap-x-4 gap-y-3 p-2 sm:grid-cols-2">
            {VALORANT_ROLES.map((role) => (
              <div key={role}>
                <p className="mb-1.5 px-0.5 text-[11.5px] font-bold tracking-wide text-neutral-500 uppercase">{tClasses(role)}</p>
                <div className="flex min-h-[56px] flex-wrap content-start gap-1.5">
                  {pool
                    .filter((a) => a.role === role)
                    .map(({ slug }) => (
                      <DraggableAgent key={slug} slug={slug} picked={picked === slug} hidden={dragging === slug} onPick={() => setPicked((p) => (p === slug ? null : slug))} />
                    ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </DropRow>

      <DragOverlay dropAnimation={null}>{dragging && <AgentIcon slug={dragging} size={ICON_SIZE} className="scale-110 shadow-[0_12px_30px_rgba(0,0,0,.6)] ring-2 ring-[var(--sc-accent)]" />}</DragOverlay>
    </DndContext>
  );
}

function DropRow({ id, active, onClick, className, children }: { id: string; active: boolean; onClick: () => void; className?: string; children: ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      onClick={onClick}
      className={cn(
        "flex border-b border-neutral-800 transition-colors last:border-b-0",
        isOver && "bg-[color-mix(in_oklab,var(--sc-accent)_10%,transparent)]",
        active && "cursor-pointer hover:bg-[var(--sc-hover)]",
        className
      )}
    >
      {children}
    </div>
  );
}

function DraggableAgent({ slug, picked, hidden, onPick }: { slug: string; picked: boolean; hidden: boolean; onPick: () => void }) {
  const { attributes, listeners, setNodeRef } = useDraggable({ id: slug });
  return (
    <button
      ref={setNodeRef}
      type="button"
      {...attributes}
      {...listeners}
      aria-pressed={picked}
      onClick={(e) => {
        // The row click would drop the agent right away.
        e.stopPropagation();
        onPick();
      }}
      className={cn(
        "touch-manipulation rounded-md transition-all hover:brightness-110 active:scale-[0.92]",
        picked && "ring-2 ring-[var(--sc-accent)] ring-offset-2 ring-offset-[var(--sc-surface-2)]",
        hidden && "opacity-30"
      )}
    >
      <AgentIcon slug={slug} size={ICON_SIZE} />
    </button>
  );
}
