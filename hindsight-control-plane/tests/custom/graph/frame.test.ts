// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import {
  GRAPH_BACKING_PIXELS,
  GRAPH_DPR_CAP,
  ambientDelayMs,
  ambientUsesNextFrame,
  graphDevicePixelRatio,
  motionStartsPaused,
  snapshotTransform,
} from "@/custom/graph/frame";
import { createMockMemoryGraph } from "@/custom/graph/dataset";

describe("graph frame budget", () => {
  it("caps the backing store on large retina canvases and leaves small ones native", () => {
    const previous = window.devicePixelRatio;
    Object.defineProperty(window, "devicePixelRatio", { configurable: true, value: 3 });
    const large = graphDevicePixelRatio(1440, 700);
    expect(large).toBeLessThanOrEqual(GRAPH_DPR_CAP);
    expect(1440 * 700 * large * large).toBeLessThanOrEqual(GRAPH_BACKING_PIXELS + 1);
    expect(graphDevicePixelRatio(400, 300)).toBe(GRAPH_DPR_CAP);
    Object.defineProperty(window, "devicePixelRatio", { configurable: true, value: 1 });
    expect(graphDevicePixelRatio(1440, 700)).toBe(1);
    Object.defineProperty(window, "devicePixelRatio", { configurable: true, value: previous });
  });

  it("waits for visible drift and backs off after an expensive sample", () => {
    const overview = ambientDelayMs(0.17, 2);
    expect(overview).toBeGreaterThan(100);
    expect(overview).toBeLessThanOrEqual(240);
    expect(ambientDelayMs(2, 2)).toBeLessThanOrEqual(40);
    expect(ambientUsesNextFrame(ambientDelayMs(4, 1))).toBe(true);
    expect(ambientUsesNextFrame(overview)).toBe(false);
    expect(ambientDelayMs(1, 40)).toBeGreaterThan(ambientDelayMs(1, 2));
    expect(ambientDelayMs(0.2, 30)).toBeLessThanOrEqual(240);
    expect(ambientDelayMs(0.2, 400)).toBe(1000);
  });

  it("lets an explicit motion choice override reduced motion", () => {
    expect(motionStartsPaused(null, true)).toBe(true);
    expect(motionStartsPaused(null, false)).toBe(false);
    expect(motionStartsPaused("on", true)).toBe(false);
    expect(motionStartsPaused("off", false)).toBe(true);
  });

  it("scales a settled frame around the camera center", () => {
    const snap = { W: 800, H: 600, dpr: 2, panX: 0, panY: 0, zoom: 1 };
    expect(snapshotTransform(snap, { ...snap, panX: 10 })).toEqual({ scale: 1, tx: 20, ty: 0 });
    expect(snapshotTransform(snap, { ...snap, zoom: 2 }).scale).toBe(2);
  });
});

describe("mock memory graph", () => {
  it("builds proportional synthetic graphs without real identifiers", () => {
    const small = createMockMemoryGraph(3000, 6, 7);
    const large = createMockMemoryGraph(10000, 6, 7);
    expect(small.nodes).toHaveLength(3000);
    expect(small.links).toHaveLength(9000);
    expect(large.nodes).toHaveLength(10000);
    expect(large.links).toHaveLength(30000);
    expect(createMockMemoryGraph(3000, 6, 7)).toEqual(small);
    expect(small.nodes[0]).toEqual({ id: "m000000", label: "Memory m000000" });
    const ids = new Set(small.nodes.map((node) => node.id));
    for (const link of small.links) {
      expect(ids.has(link.source)).toBe(true);
      expect(ids.has(link.target)).toBe(true);
      expect(link.source).not.toBe(link.target);
    }
    expect(new Set(small.links.map((link) => link.type)).size).toBeGreaterThan(1);
  });
});
