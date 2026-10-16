import type { BrainBounds, Hemisphere, Point2, Point3, ProjectedPoint } from "./types";

// Bump this whenever contour, projection, hashing or sampling changes: saved positions depend on it.
export const BRAIN_GEOMETRY_VERSION = "brain-v1";

interface CubicCurve {
  readonly from: Point2;
  readonly control1: Point2;
  readonly control2: Point2;
  readonly to: Point2;
}

// Original stylised shape: a domed crown, lobed outer edge and tucked-in basal contour.
// This is decorative geometry, not an anatomical model or a biological classification.
const leftCurves: readonly CubicCurve[] = [
  {
    from: { x: -0.055, y: -0.62 },
    control1: { x: -0.16, y: -0.86 },
    control2: { x: -0.51, y: -0.85 },
    to: { x: -0.66, y: -0.67 },
  },
  {
    from: { x: -0.66, y: -0.67 },
    control1: { x: -0.91, y: -0.65 },
    control2: { x: -1, y: -0.37 },
    to: { x: -0.92, y: -0.18 },
  },
  {
    from: { x: -0.92, y: -0.18 },
    control1: { x: -1.04, y: 0.03 },
    control2: { x: -0.95, y: 0.32 },
    to: { x: -0.81, y: 0.38 },
  },
  {
    from: { x: -0.81, y: 0.38 },
    control1: { x: -0.78, y: 0.66 },
    control2: { x: -0.53, y: 0.77 },
    to: { x: -0.4, y: 0.61 },
  },
  {
    from: { x: -0.4, y: 0.61 },
    control1: { x: -0.3, y: 0.53 },
    control2: { x: -0.26, y: 0.74 },
    to: { x: -0.13, y: 0.65 },
  },
  {
    from: { x: -0.13, y: 0.65 },
    control1: { x: -0.035, y: 0.52 },
    control2: { x: -0.08, y: 0.22 },
    to: { x: -0.045, y: 0.05 },
  },
  {
    from: { x: -0.045, y: 0.05 },
    control1: { x: -0.025, y: -0.15 },
    control2: { x: -0.1, y: -0.39 },
    to: { x: -0.055, y: -0.62 },
  },
];

function sampleCurve(curve: CubicCurve): readonly Point2[] {
  return Array.from({ length: 16 }, (_, index) => {
    const t = index / 16;
    const s = 1 - t;
    return Object.freeze({
      x:
        s ** 3 * curve.from.x +
        3 * s ** 2 * t * curve.control1.x +
        3 * s * t ** 2 * curve.control2.x +
        t ** 3 * curve.to.x,
      y:
        s ** 3 * curve.from.y +
        3 * s ** 2 * t * curve.control1.y +
        3 * s * t ** 2 * curve.control2.y +
        t ** 3 * curve.to.y,
    });
  });
}

const left = Object.freeze(leftCurves.flatMap(sampleCurve));
const right = Object.freeze(left.map(({ x, y }) => Object.freeze({ x: -x, y })));
const leftFurrows: readonly (readonly Point2[])[] = [
  [
    { x: -0.76, y: -0.36 },
    { x: -0.61, y: -0.46 },
    { x: -0.42, y: -0.37 },
    { x: -0.23, y: -0.43 },
  ],
  [
    { x: -0.83, y: 0.05 },
    { x: -0.66, y: -0.04 },
    { x: -0.52, y: 0.08 },
    { x: -0.26, y: -0.02 },
  ],
  [
    { x: -0.68, y: 0.37 },
    { x: -0.53, y: 0.27 },
    { x: -0.39, y: 0.39 },
    { x: -0.2, y: 0.29 },
  ],
];

/** Decorative curves are separate from data nodes and can never acquire graph IDs. */
export const BRAIN_GEOMETRY = Object.freeze({
  hemispheres: Object.freeze({ left, right }),
  fissure: Object.freeze([
    Object.freeze({ x: 0, y: -0.62 }),
    Object.freeze({ x: -0.012, y: -0.25 }),
    Object.freeze({ x: 0.012, y: 0.08 }),
    Object.freeze({ x: 0, y: 0.65 }),
  ]),
  furrows: Object.freeze(
    leftFurrows.flatMap((points) => {
      const curve = [
        ...sampleCurve({
          from: points[0],
          control1: points[1],
          control2: points[2],
          to: points[3],
        }),
        Object.freeze({ ...points[3] }),
      ];
      return [
        Object.freeze(curve),
        Object.freeze(curve.map(({ x, y }) => Object.freeze({ x: -x, y }))),
      ];
    })
  ),
});

/** Interior membership in the sampled closed contour (boundary points are not sampling targets). */
export function isInsideHemisphere(point: Point2, hemisphere: Hemisphere): boolean {
  if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) return false;
  const contour = BRAIN_GEOMETRY.hemispheres[hemisphere];
  let inside = false;
  for (let i = 0, j = contour.length - 1; i < contour.length; j = i++) {
    const a = contour[i];
    const b = contour[j];
    if (
      a.y > point.y !== b.y > point.y &&
      point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x
    ) {
      inside = !inside;
    }
  }
  return inside;
}

/** Rounded thickness tapers to zero at the contour, preserving the silhouette when projected. */
export function brainHalfThickness(point: Point2, hemisphere: Hemisphere): number {
  if (!isInsideHemisphere(point, hemisphere)) return 0;
  const contour = BRAIN_GEOMETRY.hemispheres[hemisphere];
  let distance = Infinity;
  for (let i = 0; i < contour.length; i++) {
    const a = contour[i];
    const b = contour[(i + 1) % contour.length];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const t = Math.max(
      0,
      Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / (dx * dx + dy * dy))
    );
    distance = Math.min(distance, Math.hypot(point.x - a.x - t * dx, point.y - a.y - t * dy));
  }
  return Math.min(0.24, distance * 0.9);
}

const yaw = Math.PI / 9;
const pitch = Math.PI / 12;

/** Fixed orthographic three-quarter view; no viewport, node count or camera state involved. */
export function projectBrainPoint(point: Point3): ProjectedPoint {
  const rotatedX = point.x * Math.cos(yaw) + point.z * Math.sin(yaw);
  const rotatedZ = -point.x * Math.sin(yaw) + point.z * Math.cos(yaw);
  return {
    x: rotatedX,
    y: point.y * Math.cos(pitch) - rotatedZ * Math.sin(pitch),
    depth: point.y * Math.sin(pitch) + rotatedZ * Math.cos(pitch),
  };
}

// Project the containing cuboid, not the current nodes: bounds stay stable under every filter.
const corners = [-1.04, 1.04].flatMap((x) =>
  [-0.86, 0.77].flatMap((y) => [-0.24, 0.24].map((z) => projectBrainPoint({ x, y, z })))
);
export const BRAIN_BOUNDS: BrainBounds = Object.freeze({
  minX: Math.min(...corners.map((point) => point.x)),
  minY: Math.min(...corners.map((point) => point.y)),
  maxX: Math.max(...corners.map((point) => point.x)),
  maxY: Math.max(...corners.map((point) => point.y)),
});
