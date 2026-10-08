/**
 * GC-Scouting - field
 *
 * Form field wrapper (label, required marker, error) and text inputs.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

import type { InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

/** Form field: label (red star when required), control, hint or error message. */
export function Field({
  label,
  htmlFor,
  required,
  hint,
  error,
  aside,
  children,
  className,
}: {
  label: string;
  htmlFor?: string;
  required?: boolean;
  hint?: ReactNode;
  error?: string;
  /** Shown on the right of the label (counter, action). */
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <div className="mb-1.5 flex items-end justify-between gap-3">
        <label htmlFor={htmlFor} className="text-[13px] font-semibold text-neutral-300">
          {label}
          {required && <span className="ml-0.5 text-red-500">*</span>}
        </label>
        {aside}
      </div>
      {children}
      {error ? (
        <p role="alert" className="mt-1.5 text-[12.5px] font-medium text-red-400">
          {error}
        </p>
      ) : (
        hint && <p className="mt-1.5 text-[12px] leading-snug text-neutral-500">{hint}</p>
      )}
    </div>
  );
}

const inputClass = (invalid?: boolean) =>
  cn(
    "w-full rounded-[10px] border bg-[var(--sc-surface)] px-3 text-[13.5px] text-neutral-100 outline-none transition-colors placeholder:text-neutral-600 hover:bg-[var(--sc-hover)] focus:border-[var(--sc-accent)] focus:bg-[var(--sc-surface)]",
    invalid ? "border-red-500/70" : "border-neutral-800"
  );

export function TextInput({ invalid, className, prefix, ...props }: Omit<InputHTMLAttributes<HTMLInputElement>, "prefix"> & { invalid?: boolean; prefix?: ReactNode }) {
  if (!prefix) return <input {...props} aria-invalid={invalid || undefined} className={cn(inputClass(invalid), "h-[38px]", className)} />;
  return (
    <div className="relative">
      <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-neutral-500">{prefix}</span>
      <input {...props} aria-invalid={invalid || undefined} className={cn(inputClass(invalid), "h-[38px] pl-9", className)} />
    </div>
  );
}

export function TextArea({ invalid, className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }) {
  return <textarea {...props} aria-invalid={invalid || undefined} className={cn(inputClass(invalid), "min-h-[140px] resize-y py-2.5 leading-relaxed", className)} />;
}
