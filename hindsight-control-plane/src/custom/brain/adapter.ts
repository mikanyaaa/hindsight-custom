import type { GraphData, GraphNode } from "../../components/graph-data";
import { createBrainLayout } from "./layout";
import { BRAIN_BOUNDS } from "./geometry";

const WORLD_SCALE = 360;

export function adaptBrainData(data: GraphData, groupKey?: (node: GraphNode) => string | null) {
  // Deduplicate by real ID and select deterministically, independently of response order.
  const unique = new Map<string, GraphNode>();
  for (const node of data.nodes) if (!unique.has(node.id)) unique.set(node.id, node);
  const nodes = [...unique.values()]
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    .slice(0, 500);
  const ids = new Set(nodes.map((node) => node.id));
  const byType = new Map<string, typeof data.links>();
  for (const link of data.links) {
    if (!ids.has(link.source) || !ids.has(link.target)) continue;
    const type = link.type ?? "semantic";
    const bucket = byType.get(type) ?? [];
    bucket.push(link);
    byType.set(type, bucket);
  }
  const buckets = [...byType.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([, bucket]) =>
      bucket.sort((a, b) => {
        const weight = (b.weight ?? 0) - (a.weight ?? 0);
        if (weight) return weight;
        const left = JSON.stringify([a.source, a.target, a.entity, a.color]);
        const right = JSON.stringify([b.source, b.target, b.entity, b.color]);
        return left < right ? -1 : left > right ? 1 : 0;
      })
    );
  // Interleave types after ranking by weight: an edge budget cannot erase a rare type.
  const links: typeof data.links = [];
  let activeBuckets = buckets;
  for (let index = 0; activeBuckets.length; index++) {
    const next = [];
    for (const bucket of activeBuckets) {
      links.push(bucket[index]);
      if (index + 1 < bucket.length) next.push(bucket);
    }
    activeBuckets = next;
  }
  // Keep parallel link types, self-links, direction and original metadata intact.
  const graph: GraphData = { nodes, links };
  const layout = createBrainLayout(
    nodes.map((node) => ({ id: node.id, group: groupKey?.(node) ?? undefined }))
  );
  const centerX = (BRAIN_BOUNDS.minX + BRAIN_BOUNDS.maxX) / 2;
  const centerY = (BRAIN_BOUNDS.minY + BRAIN_BOUNDS.maxY) / 2;
  const toWorld = (point: { x: number; y: number }) => ({
    x: (point.x - centerX) * WORLD_SCALE,
    y: (point.y - centerY) * WORLD_SCALE,
  });
  return {
    graph,
    positions: new Map(
      layout.nodes.map((node) => [
        node.id,
        { ...toWorld(node.projected), depth: node.projected.depth },
      ])
    ),
    toWorld,
    width: (BRAIN_BOUNDS.maxX - BRAIN_BOUNDS.minX) * WORLD_SCALE,
    height: (BRAIN_BOUNDS.maxY - BRAIN_BOUNDS.minY) * WORLD_SCALE,
    loadedNodes: data.nodes.length,
    loadedLinks: data.links.length,
  };
}

export type BrainData = ReturnType<typeof adaptBrainData>;
