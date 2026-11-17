import { describe, expect, it } from "vitest";
import {
  bothEndpointsOnScreen,
  clearStrokeBatch,
  createStrokeBatch,
  hoverPickRadius,
  pickNode,
  pointerNeedsFrame,
  pushCurve,
} from "@/custom/graph/lod";

describe("graph level of detail", () => {
  it("keeps an edge only when both ends are inside the padded view", () => {
    expect(bothEndpointsOnScreen(10, 10, 40, 50, 1440, 900, 60)).toBe(true);
    expect(bothEndpointsOnScreen(-40, 10, 20, 20, 1440, 900, 60)).toBe(true);
    expect(bothEndpointsOnScreen(-400, 10, 20, 20, 1440, 900, 60)).toBe(false);
    expect(bothEndpointsOnScreen(-2000, 40, -1800, 80, 1440, 900, 60)).toBe(false);
    // Opposite sides of the window: the segment crosses the view, and rasterizing
    // thousands of those spans is the zoom long task. They are not drawn.
    expect(bothEndpointsOnScreen(-2000, 400, 3000, 500, 1440, 900, 60)).toBe(false);
  });

  it("drops a zoomed crossing web and keeps the fitted overview", () => {
    let crossing = 0;
    for (let i = 0; i < 15000; i++) {
      if (bothEndpointsOnScreen(-2000, (i % 900) - 100, 3000, i % 900, 1440, 900, 60)) crossing += 1;
    }
    expect(crossing).toBe(0);

    let overview = 0;
    for (let i = 0; i < 6000; i++) {
      const x = 80 + (i % 70) * 18;
      const y = 70 + (i % 40) * 18;
      if (bothEndpointsOnScreen(x, y, x + 12, y + 8, 1440, 900, 60)) overview += 1;
    }
    expect(overview).toBe(6000);
  });

  it("repaints a pointer move only while dragging or when the hit node changes", () => {
    expect(pointerNeedsFrame(true, -1, -1)).toBe(true);
    expect(pointerNeedsFrame(false, -1, -1)).toBe(false);
    expect(pointerNeedsFrame(false, 4, 4)).toBe(false);
    expect(pointerNeedsFrame(false, -1, 2)).toBe(true);
    expect(hoverPickRadius(0.2)).toBe(30);
    expect(hoverPickRadius(2)).toBe(80);
  });

  it("picks the nearest visible node and ignores the rest", () => {
    const screenX = [10, 40, 48];
    const screenY = [10, 10, 10];
    const visible = [1, 1, 0];
    expect(pickNode(42, 10, screenX, screenY, visible, 3, 30)).toBe(1);
    expect(pickNode(100, 100, screenX, screenY, visible, 3, 30)).toBe(-1);
    expect(pickNode(48, 10, screenX, screenY, visible, 3, 30)).toBe(1);
  });

  it("batches curves by colour without allocating a point per segment", () => {
    const batch = createStrokeBatch(4);
    expect(pushCurve(batch, "#2255aa", 0, 0, 10, 0)).toBe(true);
    expect(pushCurve(batch, "#aa5522", 0, 0, 0, 10)).toBe(true);
    expect(pushCurve(batch, "#2255aa", 1, 1, 2, 2)).toBe(true);
    expect(batch.count).toBe(3);
    expect(batch.colors).toEqual(["#2255aa", "#aa5522"]);
    expect(batch.colorIds[0]).toBe(0);
    expect(batch.colorIds[1]).toBe(1);
    expect(batch.coords[2]).toBeCloseTo(5);
    expect(batch.coords[3]).toBeCloseTo(-0.8);
    clearStrokeBatch(batch);
    expect(batch.count).toBe(0);
    expect(batch.colors).toEqual(["#2255aa", "#aa5522"]);
    const full = createStrokeBatch(1);
    expect(pushCurve(full, "#000000", 0, 0, 1, 1)).toBe(true);
    expect(pushCurve(full, "#000000", 0, 0, 1, 1)).toBe(false);
  });
});
