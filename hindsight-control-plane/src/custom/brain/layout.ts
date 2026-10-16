import {
  BRAIN_BOUNDS,
  BRAIN_GEOMETRY_VERSION,
  brainHalfThickness,
  isInsideHemisphere,
  projectBrainPoint,
} from "./geometry";
import type { BrainLayout, BrainNodeInput, BrainNodePosition, Hemisphere, Point3 } from "./types";

/** Independent full-key hashes per dimension/attempt avoid inheriting a single 32-bit seed collision. */
function unitHash(key: string, lane: number): number {
  let hash = (0x811c9dc5 ^ Math.imul(lane + 1, 0x9e3779b9)) >>> 0;
  for (let index = 0; index < key.length; index++) {
    hash = Math.imul(hash ^ key.charCodeAt(index), 0x01000193);
    hash ^= hash >>> 13;
  }
  hash = Math.imul(hash ^ (hash >>> 16), 0x85ebca6b);
  hash = Math.imul(hash ^ (hash >>> 13), 0xc2b2ae35);
  return ((hash ^ (hash >>> 16)) >>> 0) / 0x100000000;
}

function positionForNode(node: BrainNodeInput): BrainNodePosition {
  // A structured key distinguishes missing/empty groups and separator-containing IDs without ambiguity.
  const key = JSON.stringify([BRAIN_GEOMETRY_VERSION, node.group ?? null, node.id]);
  const hemisphere: Hemisphere = unitHash(key, 0) < 0.5 ? "left" : "right";
  const sign = hemisphere === "left" ? -1 : 1;
  let position: Point3 | undefined;
  for (let attempt = 0; attempt < 12; attempt++) {
    const point = {
      x: sign * (0.025 + unitHash(key, 1 + attempt * 3) * 1.015),
      y: -0.86 + unitHash(key, 2 + attempt * 3) * 1.63,
    };
    if (isInsideHemisphere(point, hemisphere)) {
      position = {
        ...point,
        z: (unitHash(key, 3 + attempt * 3) * 2 - 1) * brainHalfThickness(point, hemisphere),
      };
      break;
    }
  }
  if (!position) {
    // This small rectangle lies strictly inside either hemisphere. Independent fallback lanes
    // keep rejected IDs distinct without moving neighbours or consulting the visible node set.
    position = {
      x: sign * (0.42 + unitHash(key, 40) * 0.08),
      y: -0.08 + unitHash(key, 41) * 0.16,
      z: 0,
    };
  }
  return { id: node.id, hemisphere, position, projected: projectBrainPoint(position) };
}

/** O(N) in node count with bounded sampling; no force simulation or pairwise collision relaxation. */
export function createBrainLayout(nodes: readonly BrainNodeInput[]): BrainLayout {
  const ids = new Set<string>();
  const positions = nodes.map((node) => {
    if (ids.has(node.id)) throw new Error(`Duplicate brain node ID: ${node.id}`);
    ids.add(node.id);
    return positionForNode(node);
  });
  return { version: BRAIN_GEOMETRY_VERSION, nodes: positions, bounds: BRAIN_BOUNDS };
}
