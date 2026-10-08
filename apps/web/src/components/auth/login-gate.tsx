/**
 * GC-Scouting - login-gate
 *
 * Call to action shown to visitors who must sign in first.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

import { LockIcon } from "lucide-react";
import { LoginLink } from "./login-link";

/** Card shown in place of a page that needs a GC Stats login. */
export function LoginGate({ title, text, cta, next }: { title: string; text: string; cta: string; next: string }) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-neutral-800 bg-[var(--sc-surface)] px-6 py-12 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-xl border border-neutral-800 bg-[var(--sc-surface-2)] text-[var(--sc-accent)]">
        <LockIcon className="h-5 w-5" />
      </span>
      <h2 className="mt-5 text-[20px] font-bold tracking-tight text-neutral-50">{title}</h2>
      <p className="mt-2 max-w-md text-[14px] leading-relaxed text-neutral-500">{text}</p>
      <LoginLink label={cta} next={next} className="mt-6" />
    </div>
  );
}
