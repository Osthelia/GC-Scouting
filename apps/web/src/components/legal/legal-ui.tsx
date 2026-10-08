/**
 * GC-Scouting - legal-ui
 *
 * Layout blocks shared by the legal pages.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Link } from "@/i18n/navigation";

// Building blocks shared by the legal notice, the privacy policy and the tierlist guide.

export function LegalPage({ title, intro, updated, children }: { title: string; intro?: string; updated?: string; children: ReactNode }) {
  return (
    <div className="mx-auto max-w-[860px] px-4 py-10 sm:px-6 sm:py-14">
      <h1 className="text-[28px] font-bold tracking-tight text-neutral-50 sm:text-[34px]">{title}</h1>
      {updated && (
        <span className="mt-3 inline-flex rounded-full border border-neutral-800 bg-[var(--sc-surface)] px-3 py-1 text-xs font-medium text-neutral-500">
          {updated}
        </span>
      )}
      {intro && <p className="mt-4 max-w-2xl text-[14.5px] leading-relaxed text-neutral-400">{intro}</p>}
      <div className="mt-8 flex flex-col gap-5">{children}</div>
    </div>
  );
}

export function LegalSection({ icon: Icon, title, children }: { icon: LucideIcon; title: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-neutral-800 bg-[var(--sc-surface)] p-5 sm:p-6">
      <div className="mb-4 flex items-center gap-3">
        <span className="flex h-9 w-9 flex-none items-center justify-center rounded-lg border border-neutral-800 bg-[var(--sc-surface-2)] text-[var(--sc-accent)]">
          <Icon className="h-[17px] w-[17px]" />
        </span>
        <h2 className="text-base font-semibold tracking-tight text-neutral-50">{title}</h2>
      </div>
      <div className="flex flex-col gap-4">{children}</div>
    </section>
  );
}

export function LegalText({ children }: { children: ReactNode }) {
  return <p className="text-sm leading-relaxed text-neutral-400">{children}</p>;
}

export function LegalList({ items }: { items: ReactNode[] }) {
  return (
    <ul className="flex flex-col gap-2">
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-2.5 text-sm leading-relaxed text-neutral-400">
          <span className="mt-2 h-1 w-1 flex-none rounded-full bg-[var(--sc-accent)]" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

export function LegalCallout({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl border-l-2 border-[var(--sc-accent)] bg-[var(--sc-surface-2)] px-4 py-3 text-[13px] leading-relaxed text-neutral-400">{children}</div>
  );
}

export function LegalFields({ fields }: { fields: { label: string; value: ReactNode }[] }) {
  return (
    <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {fields.map((field) => (
        <div key={field.label}>
          <dt className="text-xs font-medium text-neutral-500">{field.label}</dt>
          <dd className="mt-0.5 text-sm font-medium break-words text-neutral-50">{field.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function LegalLink({ href, children }: { href: string; children: ReactNode }) {
  const className =
    "font-medium text-neutral-50 underline decoration-[var(--sc-accent)] decoration-2 underline-offset-2 transition-colors hover:text-[var(--sc-accent)] active:opacity-70";
  if (href.startsWith("/")) {
    return (
      <Link href={href} className={className}>
        {children}
      </Link>
    );
  }
  const web = href.startsWith("http");
  return (
    <a href={href} target={web ? "_blank" : undefined} rel={web ? "noopener noreferrer" : undefined} className={className}>
      {children}
    </a>
  );
}

/** Rich text tags shared by the legal messages. */
export const legalRich = {
  b: (chunks: ReactNode) => <strong className="font-semibold text-neutral-200">{chunks}</strong>,
};
