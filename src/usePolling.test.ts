import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POLL_INTERVAL_MS, usePolling } from "./usePolling.ts";

let visibility: DocumentVisibilityState = "visible";

function setVisibility(next: DocumentVisibilityState) {
  visibility = next;
  document.dispatchEvent(new Event("visibilitychange"));
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
  visibility = "visible";
  vi.spyOn(document, "visibilityState", "get").mockImplementation(() => visibility);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("usePolling", () => {
  it("refreshes every 10 seconds, and stops when the screen closes", () => {
    const refresh = vi.fn();
    const { unmount } = renderHook(() => usePolling(refresh));

    vi.advanceTimersByTime(POLL_INTERVAL_MS - 1);
    expect(refresh).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(refresh).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(POLL_INTERVAL_MS);
    expect(refresh).toHaveBeenCalledTimes(2);

    unmount();
    vi.advanceTimersByTime(POLL_INTERVAL_MS * 3);
    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it("pauses while the app is in the background, and refreshes as soon as the user comes back", () => {
    const refresh = vi.fn();
    renderHook(() => usePolling(refresh));

    setVisibility("hidden");
    vi.advanceTimersByTime(POLL_INTERVAL_MS * 3);
    expect(refresh).not.toHaveBeenCalled();

    setVisibility("visible");
    expect(refresh).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(POLL_INTERVAL_MS);
    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it("waits while turned off, and uses the latest refresh function", () => {
    const first = vi.fn();
    const second = vi.fn();
    const { rerender } = renderHook(({ refresh, enabled }) => usePolling(refresh, enabled), {
      initialProps: { refresh: first, enabled: false },
    });

    vi.advanceTimersByTime(POLL_INTERVAL_MS * 2);
    expect(first).not.toHaveBeenCalled();

    rerender({ refresh: second, enabled: true });
    vi.advanceTimersByTime(POLL_INTERVAL_MS);
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });
});
