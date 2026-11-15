"use client";

import { useEffect, useRef } from "react";

/**
 * Run `callback` on a timer only while the document is visible.
 *
 * A hidden tab clears the timer, so it makes no further requests. Becoming
 * visible again runs `callback` immediately and restarts the timer. The hook
 * does not call `callback` on mount — callers keep their own first load.
 */
export function useVisiblePoll(callback: () => void, intervalMs: number | null | undefined): void {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    if (intervalMs == null || intervalMs <= 0) return;

    let timer: ReturnType<typeof setInterval> | null = null;

    const stop = () => {
      if (timer != null) {
        clearInterval(timer);
        timer = null;
      }
    };

    const start = () => {
      stop();
      timer = setInterval(() => callbackRef.current(), intervalMs);
    };

    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        stop();
        return;
      }
      callbackRef.current();
      start();
    };

    if (document.visibilityState !== "hidden") start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [intervalMs]);
}
