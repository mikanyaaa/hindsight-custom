import { describe, expect, it } from "vitest";
import {
  BRAIN_BOUNDS,
  BRAIN_GEOMETRY,
  brainHalfThickness,
  isInsideHemisphere,
  projectBrainPoint,
} from "../geometry";

describe("brain geometry", () => {
  it("defines two lobed hemispheres separated by an empty fissure", () => {
    expect(isInsideHemisphere({ x: -0.5, y: 0 }, "left")).toBe(true);
    expect(isInsideHemisphere({ x: 0.5, y: 0 }, "right")).toBe(true);
    expect(isInsideHemisphere({ x: -0.5, y: 0 }, "right")).toBe(false);
    for (let y = -0.8; y <= 0.8; y += 0.02) {
      for (const hemisphere of ["left", "right"] as const) {
        expect(isInsideHemisphere({ x: 0, y }, hemisphere)).toBe(false);
      }
    }
    // The basal indentation and offset crown distinguish the shape from two ellipses.
    expect(isInsideHemisphere({ x: -0.35, y: 0.65 }, "left")).toBe(false);
    expect(isInsideHemisphere({ x: -0.55, y: 0.65 }, "left")).toBe(true);
    expect(isInsideHemisphere({ x: -0.4, y: -0.7 }, "left")).toBe(true);
    expect(isInsideHemisphere({ x: -0.9, y: -0.7 }, "left")).toBe(false);
  });

  it("keeps decorative furrows inside the corresponding contour and free of graph IDs", () => {
    expect(BRAIN_GEOMETRY.furrows).toHaveLength(6);
    for (const furrow of BRAIN_GEOMETRY.furrows) {
      for (const point of furrow) {
        expect(isInsideHemisphere(point, point.x < 0 ? "left" : "right")).toBe(true);
        expect(point).not.toHaveProperty("id");
      }
    }
    expect(Object.isFrozen(BRAIN_GEOMETRY.hemispheres.left[0])).toBe(true);
    expect(Object.isFrozen(BRAIN_GEOMETRY.furrows[0])).toBe(true);
  });

  it("rejects exterior and non-finite points", () => {
    for (const point of [
      { x: 2, y: 0 },
      { x: 0, y: 2 },
      { x: NaN, y: 0 },
      { x: 0.5, y: Infinity },
    ]) {
      expect(isInsideHemisphere(point, "left")).toBe(false);
      expect(isInsideHemisphere(point, "right")).toBe(false);
      expect(brainHalfThickness(point, "left")).toBe(0);
    }
  });

  it("tapers thickness at the edge and bounds it in the interior", () => {
    expect(brainHalfThickness({ x: -0.5, y: 0 }, "left")).toBe(0.24);
    expect(brainHalfThickness({ x: -0.05, y: 0.05 }, "left")).toBeLessThan(0.01);
    for (const hemisphere of ["left", "right"] as const) {
      for (const point of BRAIN_GEOMETRY.hemispheres[hemisphere]) {
        expect(brainHalfThickness(point, hemisphere)).toBeLessThan(1e-12);
      }
    }
  });

  it("keeps the entire fallback rectangle strictly inside both hemispheres", () => {
    for (const hemisphere of ["left", "right"] as const) {
      const sign = hemisphere === "left" ? -1 : 1;
      for (let x = 0.42; x <= 0.501; x += 0.01) {
        for (let y = -0.08; y <= 0.081; y += 0.01) {
          expect(brainHalfThickness({ x: sign * x, y }, hemisphere)).toBeGreaterThan(0.1);
        }
      }
    }
  });

  it("uses a fixed orthographic three-quarter projection with meaningful depth", () => {
    expect(projectBrainPoint({ x: 0, y: 0, z: 0 })).toEqual({ x: 0, y: 0, depth: 0 });
    const projected = projectBrainPoint({ x: 1, y: 2, z: 3 });
    expect(projected.x).toBeCloseTo(1.9657530508);
    expect(projected.y).toBeCloseTo(1.2907163479);
    expect(projected.x ** 2 + projected.y ** 2 + projected.depth ** 2).toBeCloseTo(14);
    expect(projectBrainPoint({ x: 0, y: 0, z: 0.2 }).depth).toBeGreaterThan(
      projectBrainPoint({ x: 0, y: 0, z: -0.2 }).depth
    );
  });

  it("contains projected contours and depth extremes within fixed bounds", () => {
    for (const hemisphere of ["left", "right"] as const) {
      for (const point of BRAIN_GEOMETRY.hemispheres[hemisphere]) {
        for (const z of [-0.24, 0, 0.24]) {
          const projected = projectBrainPoint({ ...point, z });
          expect(projected.x).toBeGreaterThanOrEqual(BRAIN_BOUNDS.minX);
          expect(projected.x).toBeLessThanOrEqual(BRAIN_BOUNDS.maxX);
          expect(projected.y).toBeGreaterThanOrEqual(BRAIN_BOUNDS.minY);
          expect(projected.y).toBeLessThanOrEqual(BRAIN_BOUNDS.maxY);
        }
      }
    }
  });
});
