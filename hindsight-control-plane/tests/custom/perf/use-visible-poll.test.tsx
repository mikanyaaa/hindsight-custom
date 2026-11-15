// @vitest-environment jsdom
import { render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useVisiblePoll } from "@/custom/perf/use-visible-poll";

function Probe({ onTick, intervalMs }: { onTick: () => void; intervalMs: number | null }) {
  useVisiblePoll(onTick, intervalMs);
  return null;
}

function setVisibility(value: DocumentVisibilityState) {
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => value });
  document.dispatchEvent(new Event("visibilitychange"));
}

afterEach(() => {
  vi.useRealTimers();
  setVisibility("visible");
});

describe("useVisiblePoll", () => {
  it("does not fetch on mount and pauses while the tab is hidden", () => {
    vi.useFakeTimers();
    const onTick = vi.fn();
    render(<Probe onTick={onTick} intervalMs={1000} />);

    expect(onTick).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1000);
    expect(onTick).toHaveBeenCalledTimes(1);

    setVisibility("hidden");
    vi.advanceTimersByTime(10_000);
    expect(onTick).toHaveBeenCalledTimes(1);

    setVisibility("visible");
    expect(onTick).toHaveBeenCalledTimes(2);
    vi.advanceTimersByTime(1000);
    expect(onTick).toHaveBeenCalledTimes(3);
  });

  it("does not schedule when the interval is empty", () => {
    vi.useFakeTimers();
    const onTick = vi.fn();
    render(<Probe onTick={onTick} intervalMs={null} />);
    vi.advanceTimersByTime(10_000);
    setVisibility("visible");
    expect(onTick).not.toHaveBeenCalled();
  });
});
