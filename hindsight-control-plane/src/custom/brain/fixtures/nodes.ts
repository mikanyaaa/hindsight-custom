import type { BrainNodeInput } from "../types";

/** Synthetic IDs only; never retain graph fixtures in a live memory bank. */
export function brainNodes(count: number): readonly BrainNodeInput[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `memory-${index}`,
    ...(index % 4 === 0 ? {} : { group: `scope-${index % 13}` }),
  }));
}

// Same lane-0 hash (0.827334011439234) in brain-v1 with no group. Later dimensions
// must hash the full identity again rather than generate everything from that seed.
export const COLLIDING_NODES: readonly BrainNodeInput[] = [
  { id: "collision-1383661985-1ib5" },
  { id: "collision-3740372709-1rhx" },
];
