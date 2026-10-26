/**
 * GC-Scouting - select
 *
 * Styled select and multi select with search.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

"use client";

import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export type SelectOption<T extends string> = { value: T; label: string; icon?: ReactNode };

/** Closes on outside click and Escape. */
function useDismiss(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(close);
  useEffect(() => {
    closeRef.current = close;
  });
  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) closeRef.current();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeRef.current();
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  return ref;
}

/**
 * Keyboard support of the listbox: arrows, Home/End, Enter or Space to pick, and typeahead.
 * Focus stays on the trigger (or the search input), the highlighted option goes through `aria-activedescendant`.
 */
function useListNav<T extends string>({
  open,
  setOpen,
  listId,
  items,
  selectedIndex,
  onPick,
  resetKey,
}: {
  open: boolean;
  setOpen: (open: boolean) => void;
  listId: string;
  items: (SelectOption<T> & { disabled?: boolean })[];
  selectedIndex: number;
  onPick: (value: T) => void;
  /** Changes when the visible options change (search). */
  resetKey: unknown;
}) {
  const [active, setActive] = useState(-1);
  const typed = useRef({ text: "", at: 0 });
  // A button clicks on Space keyup: skip that click once Space has picked an option.
  const spacePicked = useRef(false);
  const optionId = (index: number) => `${listId}-option-${index}`;

  // Highlight the selected option, or the first one, when the list opens or is filtered.
  useEffect(() => {
    if (open) setActive(selectedIndex >= 0 ? selectedIndex : items.findIndex((o) => !o.disabled));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, resetKey]);

  useEffect(() => {
    if (open && active >= 0) document.getElementById(`${listId}-option-${active}`)?.scrollIntoView({ block: "nearest" });
  }, [open, active, listId]);

  const step = (from: number, delta: 1 | -1) => {
    for (let i = from + delta; i >= 0 && i < items.length; i += delta) if (!items[i]!.disabled) return i;
    return from;
  };

  const onKeyDown = (e: ReactKeyboardEvent) => {
    const inInput = e.target instanceof HTMLInputElement;
    if (!open) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        setOpen(true);
      }
      return;
    }
    switch (e.key) {
      case "ArrowDown":
      case "ArrowUp":
        e.preventDefault();
        setActive((i) => step(i, e.key === "ArrowDown" ? 1 : -1));
        return;
      case "Home":
      case "End":
        if (inInput) return;
        e.preventDefault();
        setActive(e.key === "Home" ? step(-1, 1) : step(items.length, -1));
        return;
      case "Enter":
      case " ": {
        if (e.key === " " && inInput) return;
        e.preventDefault();
        spacePicked.current = e.key === " ";
        const item = items[active];
        if (item && !item.disabled) onPick(item.value);
        return;
      }
      case "Tab":
        setOpen(false);
        return;
    }
    if (!inInput && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const now = Date.now();
      typed.current = { text: (now - typed.current.at < 700 ? typed.current.text : "") + e.key.toLowerCase(), at: now };
      const match = items.findIndex((o) => !o.disabled && o.label.toLowerCase().startsWith(typed.current.text));
      if (match >= 0) setActive(match);
    }
  };

  const onKeyUp = (e: ReactKeyboardEvent) => {
    if (e.key === " " && spacePicked.current) {
      e.preventDefault();
      spacePicked.current = false;
    }
  };

  return { active, setActive, optionId, activeId: open && items[active] ? optionId(active) : undefined, onKeyDown, onKeyUp };
}

function Trigger({ open, active, invalid, onClick, label, children, listId, activeId, id }: { open: boolean; active: boolean; invalid?: boolean; onClick: () => void; label: string; children: ReactNode; listId: string; activeId?: string; id?: string }) {
  return (
    <button
      id={id}
      type="button"
      role="combobox"
      aria-invalid={invalid || undefined}
      aria-label={label}
      aria-haspopup="listbox"
      aria-expanded={open}
      aria-controls={listId}
      aria-activedescendant={activeId}
      onClick={onClick}
      className={cn(
        "flex h-[38px] w-full items-center gap-2 rounded-[10px] border bg-[var(--sc-surface)] px-3 text-left text-[13.5px] transition-all hover:bg-[var(--sc-hover)] active:scale-[0.98]",
        invalid ? "border-red-500/70" : open ? "border-[var(--sc-hover-2)] bg-[var(--sc-hover)]" : "border-neutral-800",
        active ? "font-semibold text-[var(--sc-accent)]" : "font-medium text-neutral-400"
      )}
    >
      <span className="flex min-w-0 flex-1 items-center gap-2 truncate">{children}</span>
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" className={cn("flex-none text-neutral-500 transition-transform", open && "rotate-180")}>
        <path d="M6 9l6 6 6-6" />
      </svg>
    </button>
  );
}

function Panel({ children, align }: { children: ReactNode; align: "start" | "end" }) {
  return (
    <div
      className={cn(
        "absolute top-[calc(100%+6px)] z-50 w-full min-w-[200px] rounded-xl border border-neutral-800 bg-[var(--sc-surface-3)] p-1.5 shadow-[0_20px_48px_rgba(0,0,0,.7)]",
        align === "end" ? "right-0" : "left-0"
      )}
    >
      {children}
    </div>
  );
}

function OptionRow({
  id,
  selected,
  highlighted,
  disabled,
  onClick,
  onHover,
  children,
  multi,
}: {
  id: string;
  selected: boolean;
  highlighted: boolean;
  disabled?: boolean;
  onClick: () => void;
  onHover: () => void;
  children: ReactNode;
  multi?: boolean;
}) {
  return (
    <button
      id={id}
      type="button"
      role="option"
      tabIndex={-1}
      aria-selected={selected}
      disabled={disabled}
      onClick={onClick}
      onMouseEnter={onHover}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13.5px] transition-colors hover:bg-[var(--sc-hover)] active:bg-[var(--sc-hover-2)] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent",
        highlighted && "bg-[var(--sc-hover)]",
        selected ? "font-semibold text-[var(--sc-accent)]" : "font-medium text-neutral-300"
      )}
    >
      {multi && (
        <span
          className={cn(
            "flex h-4 w-4 flex-none items-center justify-center rounded-[5px] border transition-colors",
            selected ? "border-[var(--sc-accent)] bg-[var(--sc-accent)] text-[var(--sc-accent-ink)]" : "border-neutral-700"
          )}
        >
          {selected && (
            <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12.5l4.5 4.5L19 7.5" />
            </svg>
          )}
        </span>
      )}
      {children}
    </button>
  );
}

function SearchInput({ value, onChange, placeholder, listId, activeId }: { value: string; onChange: (value: string) => void; placeholder?: string; listId: string; activeId?: string }) {
  return (
    <input
      autoFocus
      role="combobox"
      aria-expanded
      aria-controls={listId}
      aria-autocomplete="list"
      aria-activedescendant={activeId}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      aria-label={placeholder}
      className="mb-1.5 h-9 w-full rounded-lg border border-neutral-800 bg-[var(--sc-surface-2)] px-2.5 text-[13.5px] text-neutral-100 outline-none placeholder:text-neutral-600 focus:border-[var(--sc-accent)]"
    />
  );
}

function useSearch<T extends string>(options: SelectOption<T>[]) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? options.filter((o) => o.label.toLowerCase().includes(q) || o.value.toLowerCase().includes(q)) : options;
  }, [options, query]);
  return { query, setQuery, filtered };
}

export function Select<T extends string>({
  value,
  onChange,
  options,
  label,
  align = "start",
  placeholder,
  searchable,
  searchPlaceholder,
  emptyLabel,
  invalid,
  id,
  className,
}: {
  value: T;
  onChange: (value: T) => void;
  options: SelectOption<T>[];
  label: string;
  align?: "start" | "end";
  /** Shown when `value` matches no option. */
  placeholder?: string;
  searchable?: boolean;
  searchPlaceholder?: string;
  emptyLabel?: string;
  invalid?: boolean;
  id?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useDismiss(open, () => setOpen(false));
  const listId = useId();
  const current = options.find((o) => o.value === value);
  const { query, setQuery, filtered } = useSearch(options);
  const pick = (next: T) => {
    onChange(next);
    setOpen(false);
  };
  const nav = useListNav({ open, setOpen, listId, items: filtered, selectedIndex: filtered.findIndex((o) => o.value === value), onPick: pick, resetKey: filtered });

  return (
    <div ref={ref} onKeyDown={nav.onKeyDown} onKeyUp={nav.onKeyUp} className={cn("relative", className)}>
      <Trigger id={id} open={open} active={false} invalid={invalid} onClick={() => setOpen((v) => !v)} label={label} listId={listId} activeId={searchable ? undefined : nav.activeId}>
        {current?.icon}
        {current ? <span className="truncate text-neutral-100">{current.label}</span> : <span className="truncate text-neutral-500">{placeholder}</span>}
      </Trigger>
      {open && (
        <Panel align={align}>
          {searchable && <SearchInput value={query} onChange={setQuery} placeholder={searchPlaceholder} listId={listId} activeId={nav.activeId} />}
          <div id={listId} role="listbox" aria-label={label} className="flex max-h-72 flex-col gap-0.5 overflow-y-auto">
            {filtered.length === 0 && <p className="px-2.5 py-2 text-[13px] text-neutral-500">{emptyLabel}</p>}
            {filtered.map((o, i) => (
              <OptionRow
                key={o.value}
                id={nav.optionId(i)}
                selected={o.value === value}
                highlighted={i === nav.active}
                onHover={() => nav.setActive(i)}
                onClick={() => pick(o.value)}
              >
                {o.icon}
                <span className="truncate">{o.label}</span>
              </OptionRow>
            ))}
          </div>
        </Panel>
      )}
    </div>
  );
}

export function MultiSelect<T extends string>({
  values,
  onChange,
  options,
  label,
  placeholder,
  summary,
  searchable,
  searchPlaceholder,
  emptyLabel,
  clearLabel,
  max,
  maxHint,
  invalid,
  id,
  className,
}: {
  values: readonly T[];
  onChange: (values: T[]) => void;
  options: SelectOption<T>[];
  label: string;
  /** Shown when nothing is selected. */
  placeholder: string;
  /** Shown when several values are selected. */
  summary: (count: number) => string;
  searchable?: boolean;
  searchPlaceholder?: string;
  emptyLabel?: string;
  clearLabel?: string;
  max?: number;
  maxHint?: string;
  invalid?: boolean;
  id?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useDismiss(open, () => setOpen(false));
  const listId = useId();
  const { query, setQuery, filtered } = useSearch(options);

  const selected = options.filter((o) => values.includes(o.value));
  const full = max !== undefined && values.length >= max;

  const toggle = (value: T) => onChange(values.includes(value) ? values.filter((v) => v !== value) : [...values, value]);
  const items = filtered.map((o) => ({ ...o, disabled: full && !values.includes(o.value) }));
  const nav = useListNav({ open, setOpen, listId, items, selectedIndex: -1, onPick: toggle, resetKey: filtered });

  return (
    <div ref={ref} onKeyDown={nav.onKeyDown} onKeyUp={nav.onKeyUp} className={cn("relative", className)}>
      <Trigger id={id} open={open} active={selected.length > 0} invalid={invalid} onClick={() => setOpen((v) => !v)} label={label} listId={listId} activeId={searchable ? undefined : nav.activeId}>
        {selected.length === 0 && placeholder}
        {selected.length === 1 && (
          <>
            {selected[0]!.icon}
            <span className="truncate">{selected[0]!.label}</span>
          </>
        )}
        {selected.length > 1 && (
          <>
            {selected.every((o) => o.icon) && (
              <span className="flex flex-none items-center gap-1">
                {selected.slice(0, 5).map((o) => (
                  <span key={o.value} className="flex">
                    {o.icon}
                  </span>
                ))}
              </span>
            )}
            <span className="truncate">{summary(selected.length)}</span>
          </>
        )}
      </Trigger>
      {open && (
        <Panel align="start">
          {searchable && <SearchInput value={query} onChange={setQuery} placeholder={searchPlaceholder} listId={listId} activeId={nav.activeId} />}
          <div id={listId} role="listbox" aria-label={label} aria-multiselectable="true" className="flex max-h-72 flex-col gap-0.5 overflow-y-auto">
            {items.map((o, i) => {
              const isSelected = values.includes(o.value);
              return (
                <OptionRow
                  key={o.value}
                  id={nav.optionId(i)}
                  multi
                  selected={isSelected}
                  highlighted={i === nav.active}
                  disabled={o.disabled}
                  onHover={() => nav.setActive(i)}
                  onClick={() => toggle(o.value)}
                >
                  {o.icon}
                  <span className="truncate">{o.label}</span>
                </OptionRow>
              );
            })}
            {filtered.length === 0 && <p className="px-2.5 py-2 text-[13px] text-neutral-500">{emptyLabel}</p>}
          </div>
          {(values.length > 0 || (full && maxHint)) && (
            <div className="mt-1.5 flex items-center gap-2 border-t border-neutral-800 px-1 pt-1.5">
              {full && maxHint && <span className="text-[12px] text-neutral-500">{maxHint}</span>}
              {values.length > 0 && clearLabel && (
                <button
                  type="button"
                  onClick={() => onChange([])}
                  className="ml-auto rounded-md px-2 py-1 text-[12.5px] font-semibold text-neutral-400 transition-colors hover:bg-[var(--sc-hover)] hover:text-neutral-100 active:scale-[0.97]"
                >
                  {clearLabel}
                </button>
              )}
            </div>
          )}
        </Panel>
      )}
    </div>
  );
}
