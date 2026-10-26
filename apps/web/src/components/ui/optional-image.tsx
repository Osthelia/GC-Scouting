/**
 * GC-Scouting - optional-image
 *
 * Image that hides itself when it fails to load.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

"use client";

import { useState, type ImgHTMLAttributes } from "react";
import { useImageFallback } from "@/lib/use-image-fallback";

/** Image that is removed when it can't load. */
export function OptionalImage(props: Omit<ImgHTMLAttributes<HTMLImageElement>, "onError">) {
  const [failed, setFailed] = useState(false);
  const fallback = useImageFallback(() => setFailed(true));
  if (failed) return null;
  // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
  return <img {...props} {...fallback} />;
}
