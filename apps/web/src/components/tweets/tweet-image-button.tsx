/**
 * GC-Scouting - tweet-image-button
 *
 * Button that shares or downloads the image of a tweet.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { CheckIcon, ClipboardCopyIcon, Loader2Icon, Share2Icon } from "lucide-react";
import { cn } from "@/lib/utils";

type Mode = "share" | "copy";
type State = "idle" | "pending" | "done" | "error";

const doneStyle = "border-[color-mix(in_oklab,var(--sc-accent)_45%,transparent)] bg-[color-mix(in_oklab,var(--sc-accent)_14%,transparent)] text-[var(--sc-accent)]";

/** Touch devices that can share files get the share sheet (X app with the image attached), the others copy the image to paste in the tweet. */
function detectMode(): Mode {
  const probe = new File([], "probe.png", { type: "image/png" });
  const canShare = typeof navigator.canShare === "function" && navigator.canShare({ files: [probe] });
  return canShare && window.matchMedia("(pointer: coarse)").matches ? "share" : "copy";
}

/**
 * Hands the post's share image over to X, since a tweet intent cannot attach media.
 * Meant to sit in a wrapping flex row: its message takes a line of its own.
 */
export function TweetImageButton({ postId, text, onShared, className }: { postId: number; text: string; onShared?(): void; className?: string }) {
  const t = useTranslations("tweetImage");
  const [mode, setMode] = useState<Mode>("copy");
  const [state, setState] = useState<State>("idle");
  const image = useRef<Promise<Blob> | null>(null);
  const src = `/api/posts/${postId}/image`;

  useEffect(() => setMode(detectMode()), []);

  // Started on hover or touch so the image is ready by the click, the share sheet needs a recent user gesture.
  function load(): Promise<Blob> {
    if (!image.current) {
      const promise = fetch(src).then(async (response) => {
        if (!response.ok) throw new Error(`Share image ${response.status}`);
        return new Blob([await response.arrayBuffer()], { type: "image/png" });
      });
      promise.catch(() => {
        if (image.current === promise) image.current = null;
      });
      image.current = promise;
    }
    return image.current;
  }

  async function handOver() {
    setState("pending");
    try {
      if (mode === "share") {
        const file = new File([await load()], `gc-scouting-${postId}.png`, { type: "image/png" });
        await navigator.share({ files: [file], text });
        onShared?.();
      } else {
        // The pending blob is given as is: awaiting it first would lose the click for the clipboard.
        await navigator.clipboard.write([new ClipboardItem({ "image/png": load() })]);
      }
      setState("done");
    } catch (error) {
      setState(error instanceof DOMException && error.name === "AbortError" ? "idle" : "error");
    }
  }

  const done = state === "done";
  const Icon = mode === "share" ? Share2Icon : ClipboardCopyIcon;

  return (
    <>
      <button
        type="button"
        onPointerEnter={() => void load()}
        onPointerDown={() => void load()}
        onFocus={() => void load()}
        onClick={handOver}
        disabled={state === "pending"}
        aria-busy={state === "pending"}
        className={cn(className, done && doneStyle)}
      >
        {state === "pending" ? <Loader2Icon className="h-3.5 w-3.5 animate-spin" /> : done ? <CheckIcon className="h-3.5 w-3.5" /> : <Icon className="h-3.5 w-3.5" />}
        {state === "pending" ? t("preparing") : done ? t(mode === "share" ? "shared" : "copied") : t(mode)}
      </button>
      {done && mode === "copy" && (
        <p aria-live="polite" className="basis-full text-[12.5px] text-neutral-400">
          {t("pasteHint")}
        </p>
      )}
      {state === "error" && (
        <p role="alert" className="basis-full text-[12.5px] text-red-400">
          {t("failed")}{" "}
          <a href={src} download={`gc-scouting-${postId}.png`} className="font-semibold underline underline-offset-2 hover:text-red-300 active:opacity-70">
            {t("download")}
          </a>
        </p>
      )}
    </>
  );
}
