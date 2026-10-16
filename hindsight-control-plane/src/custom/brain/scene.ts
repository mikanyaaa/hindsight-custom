import type { ConstellationProps } from "../../components/constellation";
import type { BrainLinkStyle, BrainNodeStyle, BrainRenderer } from "./render-model";

const LINK_COLOURS: Record<string, string> = {
  semantic: "#0074d9",
  temporal: "#009296",
  entity: "#f59e0b",
  causal: "#8b5cf6",
};

/** Same data scale as the existing renderer: cool blue → lavender → orange-red. */
function heatColour(value: number): string {
  const stops = [
    [56, 130, 220],
    [170, 130, 200],
    [240, 100, 60],
  ];
  const segment = Math.max(0, Math.min(1, value)) * 2;
  const index = Math.min(Math.floor(segment), 1);
  const fraction = segment - index;
  return `rgb(${stops[index].map((v, channel) => Math.round(v + (stops[index + 1][channel] - v) * fraction)).join(", ")})`;
}

/** Prepare only the existing brain drawing contract; no upstream text/hull/layout copy. */
export function prepareBrainScene(props: ConstellationProps, renderer: BrainRenderer) {
  const counts = new Map<string, number>();
  for (const link of props.data.links) {
    counts.set(link.source, (counts.get(link.source) ?? 0) + 1);
    counts.set(link.target, (counts.get(link.target) ?? 0) + 1);
  }
  const maxCount = Math.max(1, ...counts.values());
  const indices = new Map(props.data.nodes.map((node, index) => [node.id, index]));
  const nodes: BrainNodeStyle[] = props.data.nodes.map((node) => {
    const point = renderer.positions.get(node.id)!;
    const scope = props.clusterKeyFn?.(node);
    const count = counts.get(node.id) ?? 0;
    const colour =
      (scope != null && props.clusterColorFn?.(scope)) ||
      props.nodeColorFn?.(node) ||
      node.color ||
      "#0074d9";
    return {
      node,
      wx: point.x,
      wy: point.y,
      linkCount: count,
      heatColor:
        scope != null
          ? colour
          : heatColour(props.nodeHeatFn ? props.nodeHeatFn(node) : Math.sqrt(count / maxCount)),
    };
  });
  const links: BrainLinkStyle[] = [];
  const neighbours = new Map<number, Set<number>>();
  for (const link of props.data.links) {
    const a = indices.get(link.source);
    const b = indices.get(link.target);
    if (a === undefined || b === undefined) continue;
    const type = link.type || "semantic";
    links.push({
      a,
      b,
      type,
      color: props.linkColorFn?.(link) || link.color || LINK_COLOURS[type] || "#0074d9",
    });
    if (!neighbours.has(a)) neighbours.set(a, new Set());
    if (!neighbours.has(b)) neighbours.set(b, new Set());
    neighbours.get(a)!.add(b);
    neighbours.get(b)!.add(a);
  }
  return { nodes, links, neighbours };
}

export type BrainScene = ReturnType<typeof prepareBrainScene>;
