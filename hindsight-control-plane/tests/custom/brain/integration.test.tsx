// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, renderHook, screen, act } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { renderToString } from "react-dom/server";
import messages from "@/messages/en.json";
import { brainMessages } from "@/custom/brain/messages";
import BrainProvider from "@/custom/brain/integration";
import { Constellation } from "@/components/constellation";
import { createBrainRenderer } from "@/custom/brain/renderer";
import { adaptBrainData } from "@/custom/brain/adapter";
import { useBrainMode } from "@/custom/brain/preference";

const flag = vi.hoisted(() => ({ enabled: true }));
vi.mock("@/custom/brain/feature", async (original) => ({
  ...(await original<typeof import("@/custom/brain/feature")>()),
  get BRAIN_ENABLED() {
    return flag.enabled;
  },
}));
vi.mock("@chenglou/pretext", () => ({
  prepare: (text: string) => ({ text }),
  prepareWithSegments: (text: string) => ({ text }),
  layout: () => ({ height: 15 }),
  layoutWithLines: (value: { text: string }) => ({ lines: [{ text: value.text }] }),
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
  flag.enabled = true;
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

describe("optional brain integration", () => {
  it("server-renders the default network and inherits messages with a custom-locale fallback", () => {
    const html = renderToString(wrap(<BrainProvider data={graph} />, "en-GB"));
    expect(html).toContain("Memory layout");
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain(messages.constellation.exportSvgLabel);
  });
  it("defaults to the existing renderer and exposes keyboard-operable mode buttons", () => {
    const change = vi.fn();
    render(wrap(<BrainProvider data={graph} onLayoutModeChange={change} />));
    expect(screen.getByRole("button", { name: "Network" }).getAttribute("aria-pressed")).toBe(
      "true"
    );
    fireEvent.click(screen.getByRole("button", { name: "Brain" }));
    expect(change).toHaveBeenCalledWith("brain");
    expect(screen.queryByRole("status")).toBeNull();
    flushFrame();
    expect(frames.size).toBe(1); // Upstream network retains its original motion loop.
  });

  it.each(Object.keys(brainMessages))(
    "inherits renderer messages and translates the isolated namespace (%s)",
    (locale) => {
      render(wrap(<BrainProvider data={graph} layoutMode="brain" />, locale));
      expect(
        screen.getByRole("button", {
          name: brainMessages[locale as keyof typeof brainMessages].brain,
        })
      ).toBeTruthy();
      expect(screen.getByTitle(messages.constellation.exportSvgTitle)).toBeTruthy();
      flushFrame();
      expect(screen.getByText(messages.constellation.linkTypeSemantic)).toBeTruthy();
    }
  );

  it("draws and hit-tests the fixed positions, opens the same node and leaves no ambient frame", () => {
    const click = vi.fn();
    const { container, unmount } = render(
      wrap(<BrainProvider data={graph} layoutMode="brain" onNodeClick={click} />)
    );
    flushFrame();
    expect(frames.size).toBe(0);
    expect(fetch).not.toHaveBeenCalled();
    const data = adaptBrainData(graph);
    const renderer = createBrainRenderer(data);
    const p = data.positions.get("a")!;
    const zoom = renderer.fitZoom(800, 600);
    const x = 400 + p.x * zoom;
    const y = 300 + p.y * zoom;
    const canvas = container.querySelector("canvas")!;
    fireEvent.mouseMove(canvas, { clientX: x, clientY: y });
    flushFrame();
    fireEvent.mouseDown(canvas, { clientX: x, clientY: y });
    fireEvent.mouseUp(canvas, { clientX: x, clientY: y });
    flushFrame();
    expect(click).toHaveBeenCalledWith(graph.nodes[0]);
    expect(frames.size).toBe(0);
    expect(container.querySelector('div[style*="pointer-events: none"]')).toBeNull();
    unmount();
    expect(frames.size).toBe(0);
  });

  it("gives SVG export the live camera and same prepared colours", async () => {
    const data = adaptBrainData(graph);
    const renderer = createBrainRenderer(data);
    const svg = vi.spyOn(renderer, "svg");
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:test");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    render(wrap(<Constellation data={data.graph} brainRenderer={renderer} />));
    flushFrame();
    fireEvent.click(screen.getByTitle(messages.constellation.exportSvgTitle));
    expect(svg).toHaveBeenCalledWith(
      expect.objectContaining({ W: 800, H: 600 }),
      expect.arrayContaining([expect.objectContaining({ node: graph.nodes[0] })]),
      expect.any(Array),
      -1,
      undefined
    );
    expect(fetch).not.toHaveBeenCalled();
  });

  it("ignores a supplied brain renderer and stored brain preference when the flag is off", () => {
    flag.enabled = false;
    localStorage.setItem("hindsight-brain-layout", "brain");
    const read = vi.spyOn(Storage.prototype, "getItem");
    const write = vi.spyOn(Storage.prototype, "setItem");
    const renderer = createBrainRenderer(adaptBrainData(graph));
    const custom = vi.spyOn(renderer, "decoration");
    render(wrap(<BrainProvider data={graph} layoutMode="brain" brainRenderer={renderer} />));
    flushFrame();
    expect(custom).not.toHaveBeenCalled();
    expect(screen.queryByRole("group", { name: "Memory layout" })).toBeNull();
    const hook = renderHook(() => useBrainMode());
    expect(hook.result.current.layoutMode).toBe("network");
    act(() => hook.result.current.onLayoutModeChange("brain"));
    expect(read).not.toHaveBeenCalledWith("hindsight-brain-layout");
    expect(write).not.toHaveBeenCalled();
  });

  it("keeps a denied preference store usable and never writes memory contents", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    const write = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    const hook = renderHook(() => useBrainMode());
    act(() => hook.result.current.onLayoutModeChange("brain"));
    expect(hook.result.current.layoutMode).toBe("brain");
    expect(write).toHaveBeenCalledWith("hindsight-brain-layout", "brain");
  });

  it("leaves Euler views on the existing renderer", () => {
    render(wrap(<BrainProvider data={graph} layoutMode="brain" nodeGroupsFn={() => ["page"]} />));
    expect(screen.queryByRole("group", { name: "Memory layout" })).toBeNull();
    expect(screen.queryByRole("status")).toBeNull();
  });
});
