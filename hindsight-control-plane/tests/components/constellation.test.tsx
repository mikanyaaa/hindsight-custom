// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, act } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import messages from "@/messages/en.json";
import { layoutWithLines, prepareWithSegments } from "@chenglou/pretext";
import { Constellation } from "@/components/constellation";

vi.mock("@chenglou/pretext", () => ({
  prepareWithSegments: vi.fn((text: string) => ({ text })),
  layoutWithLines: vi.fn((value: { text: string }) => ({ lines: [{ text: value.text }] })),
}));

const graph = {
  nodes: [
    { id: "a", label: "Alpha" },
    { id: "b", label: "Beta" },
  ],
  links: [{ source: "a", target: "b", type: "semantic" }],
};
let frames: Map<number, FrameRequestCallback>;
let nextFrame: number;
const ctx = {
  clearRect: vi.fn(),
  save: vi.fn(),
  restore: vi.fn(),
  scale: vi.fn(),
  fillRect: vi.fn(),
  beginPath: vi.fn(),
  closePath: vi.fn(),
  moveTo: vi.fn(),
  lineTo: vi.fn(),
  quadraticCurveTo: vi.fn(),
  arc: vi.fn(),
  fill: vi.fn(),
  stroke: vi.fn(),
  roundRect: vi.fn(),
  fillText: vi.fn(),
  measureText: vi.fn(() => ({ width: 30 })),
};
function flushFrame() {
  const pending = [...frames.values()];
  frames.clear();
  act(() => pending.forEach((frame) => frame(0)));
}
function wrap(children: React.ReactNode, locale = "en") {
  return (
    <NextIntlClientProvider locale={locale} messages={messages} timeZone="UTC">
      {children}
    </NextIntlClientProvider>
  );
}

beforeEach(() => {
  localStorage.clear();
  frames = new Map();
  nextFrame = 0;
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    frames.set(++nextFrame, callback);
    return nextFrame;
  });
  vi.stubGlobal("cancelAnimationFrame", (id: number) => frames.delete(id));
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("no asset in unit test")));
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    }
  );
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
    ctx as unknown as CanvasRenderingContext2D
  );
  vi.spyOn(HTMLCanvasElement.prototype, "getBoundingClientRect").mockReturnValue({
    width: 800,
    height: 600,
    left: 0,
    top: 0,
    right: 800,
    bottom: 600,
    x: 0,
    y: 0,
    toJSON() {},
  });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("original network rendering", () => {
  it("stops drawing while paused, coalesces input and finishes camera easing", () => {
    localStorage.setItem("constellation-motion", "off");
    const { container, unmount } = render(wrap(<Constellation data={graph} />));
    flushFrame();
    expect(frames.size).toBe(0);
    const draws = ctx.clearRect.mock.calls.length;
    flushFrame();
    expect(ctx.clearRect).toHaveBeenCalledTimes(draws);
    const canvas = container.querySelector("canvas")!;
    fireEvent.wheel(canvas, { deltaY: -100 });
    fireEvent.wheel(canvas, { deltaY: -100 });
    expect(frames.size).toBe(1);
    for (let i = 0; i < 100 && frames.size; i++) flushFrame();
    expect(frames.size).toBe(0);
    expect(ctx.clearRect.mock.calls.length).toBeGreaterThan(draws);
    fireEvent.click(screen.getByTitle(messages.constellation.resumeMotionTitle));
    flushFrame();
    expect(frames.size).toBe(1);
    fireEvent.click(screen.getByTitle(messages.constellation.pauseMotionTitle));
    flushFrame();
    expect(frames.size).toBe(0);
    fireEvent.mouseMove(canvas, { clientX: 100, clientY: 100 });
    expect(frames.size).toBe(1);
    unmount();
    expect(frames.size).toBe(0);
  });

  it("highlights and opens the hit node after a single paused frame", () => {
    localStorage.setItem("constellation-motion", "off");
    const click = vi.fn();
    const { container } = render(wrap(<Constellation data={graph} onNodeClick={click} />));
    flushFrame();
    // The first two arcs are the two node dots; no hovered signal beads yet.
    const [x, y] = ctx.arc.mock.calls[0];
    const canvas = container.querySelector("canvas")!;
    ctx.fillText.mockClear();
    fireEvent.mouseMove(canvas, { clientX: x, clientY: y });
    flushFrame();
    expect(ctx.fillText.mock.calls.some(([text]) => text === "Alpha")).toBe(true);
    expect(container.textContent).toContain("Alpha");
    expect(frames.size).toBe(0);
    fireEvent.mouseDown(canvas, { clientX: x, clientY: y });
    fireEvent.mouseUp(canvas, { clientX: x, clientY: y });
    expect(click).toHaveBeenCalledWith(graph.nodes[0]);
    flushFrame();
    fireEvent.mouseLeave(canvas);
    flushFrame();
    expect(frames.size).toBe(0);
    expect(canvas.style.cursor).toBe("default");
  });

  it("suspends hidden tabs and resumes with a single frame", () => {
    render(wrap(<Constellation data={graph} />));
    flushFrame();
    expect(frames.size).toBe(1);
    const hidden = vi.spyOn(document, "hidden", "get").mockReturnValue(true);
    fireEvent(document, new Event("visibilitychange"));
    expect(frames.size).toBe(0);
    hidden.mockReturnValue(false);
    fireEvent(document, new Event("visibilitychange"));
    expect(frames.size).toBe(1);
    flushFrame();
    expect(frames.size).toBe(1);
  });

  it("redraws paused graphs for resize, updated visual props and fullscreen", () => {
    localStorage.setItem("constellation-motion", "off");
    const { rerender } = render(wrap(<Constellation data={graph} />));
    flushFrame();
    fireEvent(window, new Event("resize"));
    expect(frames.size).toBe(1);
    flushFrame();
    rerender(wrap(<Constellation data={graph} nodeSizeFn={() => 12} heatLegendLabel="Recent" />));
    flushFrame();
    expect(ctx.fillText.mock.calls.some(([text]) => text === "RECENT")).toBe(true);
    expect(ctx.arc.mock.calls.some(([, , radius]) => radius > 10)).toBe(true);
    fireEvent.click(screen.getByTitle(messages.constellation.enterFullscreenTitle));
    expect(frames.size).toBe(1);
    flushFrame();
    expect(frames.size).toBe(0);
  });

  it("reuses card text layout across ambient frames and prepares only visible cards", () => {
    const single = { nodes: [{ id: "a", label: "A visible card" }], links: [] };
    render(wrap(<Constellation data={single} />));
    flushFrame();
    expect(prepareWithSegments).toHaveBeenCalledTimes(1);
    expect(layoutWithLines).toHaveBeenCalledTimes(1);
    for (let i = 0; i < 10; i++) flushFrame();
    expect(prepareWithSegments).toHaveBeenCalledTimes(1);
    expect(layoutWithLines).toHaveBeenCalledTimes(1);
  });

  it("does not prepare thousands of offscreen card labels on initial fit", () => {
    const large = {
      nodes: Array.from({ length: 5000 }, (_, i) => ({ id: `memory-${i}`, label: `Fact ${i}` })),
      links: [],
    };
    render(wrap(<Constellation data={large} />));
    flushFrame();
    expect(prepareWithSegments).not.toHaveBeenCalled();
    expect(layoutWithLines).not.toHaveBeenCalled();
  });

  it("does not run an ambient loop for an empty graph", () => {
    render(wrap(<Constellation data={{ nodes: [], links: [] }} />));
    flushFrame();
    expect(frames.size).toBe(0);
  });
});
