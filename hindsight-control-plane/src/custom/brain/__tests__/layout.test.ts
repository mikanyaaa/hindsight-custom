import { afterEach, describe, expect, it, vi } from "vitest";
import * as geometry from "../geometry";
import { brainNodes, COLLIDING_NODES } from "../fixtures/nodes";
import { createBrainLayout } from "../layout";
import type { BrainNodeInput } from "../types";

afterEach(() => vi.restoreAllMocks());

describe("deterministic brain layout", () => {
  it("pins brain-v1 coordinates so algorithm changes require an explicit version decision", () => {
    const layout = createBrainLayout([{ id: "memory-0" }]);
    expect(layout.version).toBe("brain-v1");
    const node = layout.nodes[0];
    expect(node.hemisphere).toBe("right");
    expect(node.position.x).toBeCloseTo(0.1111002976, 9);
    expect(node.position.y).toBeCloseTo(-0.2693110517, 9);
    expect(node.position.z).toBeCloseTo(-0.0077234654, 9);
    expect(node.projected.x).toBeCloseTo(0.1017585491, 9);
    expect(node.projected.y).toBeCloseTo(-0.2484213277, 9);
    expect(node.projected.depth).toBeCloseTo(-0.113416984, 9);
  });

  it.each([0, 1, 20, 200, 500])(
    "preserves exactly %i real IDs with finite positions inside the contour",
    (count) => {
      const input = brainNodes(count);
      const layout = createBrainLayout(input);
      expect(layout.version).toBe("brain-v1");
      expect(layout.nodes.map((node) => node.id)).toEqual(input.map((node) => node.id));
      expect(layout).toEqual(createBrainLayout(input));
      expect(layout.bounds).toEqual(createBrainLayout([]).bounds);
      expect(
        new Set(layout.nodes.map(({ projected }) => `${projected.x},${projected.y}`)).size
      ).toBe(count);
      for (const node of layout.nodes) {
        for (const value of [...Object.values(node.position), ...Object.values(node.projected)])
          expect(Number.isFinite(value)).toBe(true);
        expect(geometry.isInsideHemisphere(node.position, node.hemisphere)).toBe(true);
        expect(Math.abs(node.position.z)).toBeLessThanOrEqual(
          geometry.brainHalfThickness(node.position, node.hemisphere)
        );
        expect(node.projected).toEqual(geometry.projectBrainPoint(node.position));
        expect(node.projected.x).toBeGreaterThanOrEqual(layout.bounds.minX);
        expect(node.projected.x).toBeLessThanOrEqual(layout.bounds.maxX);
        expect(node.projected.y).toBeGreaterThanOrEqual(layout.bounds.minY);
        expect(node.projected.y).toBeLessThanOrEqual(layout.bounds.maxY);
      }
    }
  );

  it("keeps positions and bounds through reorder, filtering and new neighbours or scopes", () => {
    const input = brainNodes(500);
    const baseline = createBrainLayout(input);
    const byId = new Map(baseline.nodes.map((node) => [node.id, node]));
    for (const changed of [
      [...input].reverse(),
      input.filter((_, index) => index % 3 === 0),
      [...input, { id: "new", group: "new-scope" }],
    ]) {
      const layout = createBrainLayout(changed);
      expect(layout.bounds).toEqual(baseline.bounds);
      for (const node of layout.nodes.filter((node) => node.id !== "new"))
        expect(node).toEqual(byId.get(node.id));
    }
  });

  it("supports absent and empty groups, Unicode and separator-containing identities", () => {
    const input: readonly BrainNodeInput[] = Object.freeze([
      Object.freeze({ id: "no-group" }),
      Object.freeze({ id: "empty-group", group: "" }),
      Object.freeze({ id: "記憶 🧠", group: "Grüße" }),
      Object.freeze({ id: 'a|b\u0000["c"]', group: "d" }),
      Object.freeze({ id: 'b\u0000["c"]', group: "d|a" }),
    ]);
    expect(createBrainLayout(input).nodes).toHaveLength(input.length);
    const sameId = "記憶 🧠";
    const variants = [{ id: sameId }, { id: sameId, group: "" }, { id: sameId, group: "work" }];
    const positions = variants.map((node) => createBrainLayout([node]).nodes[0].projected);
    expect(new Set(positions.map((point) => JSON.stringify(point))).size).toBe(3);
  });

  it("does not collapse primary hash collisions or displace neighbours", () => {
    const nodes = createBrainLayout(COLLIDING_NODES).nodes;
    expect(nodes[0].hemisphere).toBe(nodes[1].hemisphere);
    expect(nodes[0].projected).not.toEqual(nodes[1].projected);
    for (const node of nodes) expect(createBrainLayout([{ id: node.id }]).nodes[0]).toEqual(node);
  });

  it("bounds rejected samples and falls back inside the contour with stable ID-specific positions", () => {
    const membership = vi.spyOn(geometry, "isInsideHemisphere").mockReturnValue(false);
    const fallback = createBrainLayout(COLLIDING_NODES);
    expect(membership).toHaveBeenCalledTimes(12 * COLLIDING_NODES.length);
    membership.mockRestore();
    expect(fallback.nodes[0].projected).not.toEqual(fallback.nodes[1].projected);
    for (const node of fallback.nodes)
      expect(geometry.isInsideHemisphere(node.position, node.hemisphere)).toBe(true);
    vi.spyOn(geometry, "isInsideHemisphere").mockReturnValue(false);
    expect(createBrainLayout([...COLLIDING_NODES].reverse()).nodes).toEqual(
      [...fallback.nodes].reverse()
    );
  });

  it("rejects duplicate IDs rather than silently losing or creating graph identities", () => {
    expect(() => createBrainLayout([{ id: "same" }, { id: "same", group: "other" }])).toThrow(
      "Duplicate brain node ID"
    );
  });
});
