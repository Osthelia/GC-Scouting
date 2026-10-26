/**
 * GC-Scouting - gcs-logo
 *
 * GC Stats team or tournament logo with fallback.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

"use client";

import { useState } from "react";
import { initials } from "@/lib/posts";
import { cn } from "@/lib/utils";
import { useImageFallback } from "@/lib/use-image-fallback";

const DEFAULT_LOGO = { team: "/logos/teams/default.webp", tournament: "/logos/tournaments/default.webp" };

/** Team or tournament logo from GC Stats: default logo when missing, initials if that fails too. */
export function GcsLogo({ src, name, kind, size = 30, className }: { src: string | null; name: string; kind: "team" | "tournament"; size?: number; className?: string }) {
  const [step, setStep] = useState<"src" | "default" | "initials">(src ? "src" : "default");
  const fallback = useImageFallback(() => setStep((current) => (current === "src" ? "default" : "initials")));
  const url = step === "src" ? src! : DEFAULT_LOGO[kind];

  return (
    <span className={cn("flex flex-none items-center justify-center overflow-hidden rounded-lg", className)} style={{ width: size, height: size }}>
      {step === "initials" ? (
        <span className="flex h-full w-full items-center justify-center bg-[var(--sc-surface-3)] text-[10px] font-black text-neutral-500">{initials(name)}</span>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt={name}
          width={size}
          height={size}
          loading="lazy"
          {...fallback}
          className="h-full w-full object-contain"
        />
      )}
    </span>
  );
}
