/**
 * GC-Scouting - use-image-fallback
 *
 * Hook that swaps to a fallback when an image fails to load.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

"use client";

import { useCallback, useEffect, useRef } from "react";

/**
 * `onError` alone misses images that failed before hydration, so the ref also
 * checks the image state on mount.
 */
export function useImageFallback(onFail: () => void) {
  const latest = useRef(onFail);
  useEffect(() => {
    latest.current = onFail;
  });
  const ref = useCallback((img: HTMLImageElement | null) => {
    if (img?.complete && img.naturalWidth === 0) latest.current();
  }, []);
  const onError = useCallback(() => latest.current(), []);
  return { ref, onError };
}
