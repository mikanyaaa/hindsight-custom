import type { GraphData, GraphLink, GraphNode } from "../../components/graph-data";

const LINK_TYPES = ["semantic", "temporal", "entity", "causal"] as const;

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Synthetic memory graph. `degree` is the average number of incident edges,
 * so the link count is `nodeCount * degree / 2` (3_000 nodes at degree 12 is
 * 18_000 links). Identifiers and labels are generated; this is not bank data.
 */
export function createMockMemoryGraph(nodeCount: number, degree = 6, seed = 1): GraphData {
  const count = Math.max(0, Math.floor(nodeCount));
  const random = mulberry32(seed);
  const nodes: GraphNode[] = Array.from({ length: count }, (_, index) => {
    const id = `m${String(index).padStart(6, "0")}`;
    return { id, label: `Memory ${id}` };
  });
  const links: GraphLink[] = [];
  if (count < 2 || degree <= 0) return { nodes, links };
  const target = Math.min(Math.round((count * degree) / 2), (count * (count - 1)) / 2);
  const seen = new Set<string>();
  let guard = 0;
  while (links.length < target && guard < target * 8) {
    guard += 1;
    const a = Math.floor(random() * count);
    let b = Math.floor(random() * count);
    if (b === a) b = (b + 1) % count;
    const lo = Math.min(a, b);
    const hi = Math.max(a, b);
    const key = `${lo}:${hi}`;
    if (seen.has(key)) continue;
    seen.add(key);
    links.push({
      source: nodes[lo].id,
      target: nodes[hi].id,
      type: LINK_TYPES[links.length % LINK_TYPES.length],
      weight: Math.round(random() * 100) / 100,
    });
  }
  return { nodes, links };
}
