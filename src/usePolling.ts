import { useEffect, useRef } from "react";

/** How often a screen checks for changes housemates made. */
export const POLL_INTERVAL_MS = 10_000;

/**
 * Keeps a screen current without a manual refresh: calls `refresh` every 10 seconds while
 * the page is visible, once more when the user comes back to it, and stops when the screen
 * closes. `refresh` should load quietly and only replace data that loaded: no "Loading…",
 * no error for a failed check (design note 2026-11-15, "Polling").
 */
export function usePolling(refresh: () => void, enabled = true) {
  // Always the latest refresh, so callers don't have to memoize it.
  const latest = useRef(refresh);
  useEffect(() => {
    latest.current = refresh;
  });

  useEffect(() => {
    if (!enabled) return;
    let timer: ReturnType<typeof setInterval> | undefined;
    const start = () => {
      timer ??= setInterval(() => latest.current(), POLL_INTERVAL_MS);
    };
    const stop = () => {
      clearInterval(timer);
      timer = undefined;
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        latest.current();
        start();
      } else {
        stop();
      }
    };

    if (document.visibilityState !== "hidden") start();
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [enabled]);
}
