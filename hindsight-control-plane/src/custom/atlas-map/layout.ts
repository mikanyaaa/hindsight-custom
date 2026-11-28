import type { GraphData, GraphNode } from "@/components/graph-data";

export interface Point {
  x: number;
  y: number;
}

export interface AtlasNode extends Point {
  memory: GraphNode;
  name: string;
  tone: number;
  radius: number;
  featured: boolean;
  label?: string;
}

interface Edge {
  source: number;
  target: number;
  strength: number;
}

interface Community {
  members: number[];
  degree: number;
  neighbors: Map<number, number>;
}

interface Bloom extends Point {
  rx: number;
  ry: number;
  tone: number;
  featured: boolean;
}

const goldenAngle = Math.PI * (3 - Math.sqrt(5));

function nodeName(node: GraphNode) {
  const text: unknown = node.metadata?.text;
  const name = (typeof text === "string" && text.trim()) || node.label?.trim() || node.id;
  return name.replace(/\s+/g, " ");
}

function shortLabel(node: GraphNode) {
  const context: unknown = node.metadata?.context;
  const name = nodeName(node);
  const label =
    typeof context === "string" &&
    context.trim().length > 0 &&
    !/^(none|n\/?a)$/i.test(context.trim())
      ? context.replace(/\s+/g, " ").trim()
      : name;
  const characters = Array.from(label);
  if (characters.length <= 24) return label;
  const prefix = characters.slice(0, 24).join("");
  const boundary = prefix.lastIndexOf(" ");
  return `${(boundary > 14 ? prefix.slice(0, boundary) : prefix).trimEnd()}…`;
}

// Merging only where the weighted modularity improves keeps sparse banks sparse:
// unlinked memories stay unlinked, and a coherent graph can have a single hub.
function findCommunities(degrees: number[], edges: Edge[]) {
  const groups = new Map<number, Community>(
    degrees.map((degree, index) => [index, { members: [index], degree, neighbors: new Map() }])
  );
  const totalDegree = degrees.reduce((sum, degree) => sum + degree, 0);
  for (const { source, target, strength } of edges) {
    groups.get(source)!.neighbors.set(target, strength);
    groups.get(target)!.neighbors.set(source, strength);
  }

  while (true) {
    let bestGain = 1e-8;
    let pair: [number, number] | undefined;
    for (const [id, group] of groups) {
      for (const [other, between] of group.neighbors) {
        if (other <= id) continue;
        const expected = (group.degree * groups.get(other)!.degree) / totalDegree;
        const gain = between - expected;
        if (gain > bestGain) {
          pair = [id, other];
          bestGain = gain;
        }
      }
    }
    if (!pair) break;

    const [id, other] = pair;
    const group = groups.get(id)!;
    const merged = groups.get(other)!;
    group.members.push(...merged.members);
    group.degree += merged.degree;
    group.neighbors.delete(other);
    for (const [neighbor, strength] of merged.neighbors) {
      if (neighbor === id) continue;
      const combined = (group.neighbors.get(neighbor) ?? 0) + strength;
      group.neighbors.set(neighbor, combined);
      const reverse = groups.get(neighbor)!.neighbors;
      reverse.delete(other);
      reverse.set(id, combined);
    }
    groups.delete(other);
  }

  return [...groups.values()].sort(
    (a, b) => b.members.length - a.members.length || b.degree - a.degree
  );
}

function clusterPositions(count: number, compact: boolean) {
  if (count === 1) return [{ x: 0.48, y: 0.53 }];
  if (count === 2) {
    return compact
      ? [
          { x: 0.34, y: 0.34 },
          { x: 0.62, y: 0.67 },
        ]
      : [
          { x: 0.26, y: 0.55 },
          { x: 0.71, y: 0.45 },
        ];
  }
  return compact
    ? [
        { x: 0.32, y: 0.28 },
        { x: 0.61, y: 0.51 },
        { x: 0.36, y: 0.75 },
      ]
    : [
        { x: 0.19, y: 0.48 },
        { x: 0.5, y: 0.66 },
        { x: 0.79, y: 0.4 },
      ];
}

function openPosition(occupied: Point[], width: number, height: number, seed: number) {
  let best = { x: width * 0.5, y: height * 0.5 };
  let bestDistance = -1;
  // A low-discrepancy sequence leaves room around dense regions while placing
  // isolated memories independently of the clusters and their colors.
  for (let index = seed * 29; index < (seed + 1) * 29; index++) {
    const x = 24 + ((0.5 + index * 0.754877666) % 1) * (width - 48);
    const y = 58 + ((0.5 + index * 0.569840291) % 1) * (height - 117);
    let nearest = Math.min(x, width - x, (y - 43) * 2, (height - y - 40) * 2) ** 2;
    for (const point of occupied) {
      nearest = Math.min(nearest, (point.x - x) ** 2 + (point.y - y) ** 2);
    }
    if (nearest > bestDistance) {
      bestDistance = nearest;
      best = { x, y };
    }
  }
  return best;
}

// When relation data is dense, preserve one strongest incident edge for every
// linked memory before filling the line budget with the remaining strongest ties.
function visibleEdges(edges: Edge[], count: number) {
  const limit = Math.max(220, count * 4);
  if (edges.length <= limit) return edges;
  const ranked = [...edges].sort((a, b) => b.strength - a.strength);
  const drawn = new Set<Edge>();
  const seen = new Set<number>();
  for (const edge of ranked) {
    if (!seen.has(edge.source) || !seen.has(edge.target)) drawn.add(edge);
    seen.add(edge.source);
    seen.add(edge.target);
  }
  for (const edge of ranked) {
    if (drawn.size >= limit) break;
    drawn.add(edge);
  }
  return [...drawn];
}

export function analyzeAtlas(data: GraphData) {
  const memories = [...new Map(data.nodes.map((node) => [node.id, node])).values()].sort((a, b) =>
    a.id < b.id ? -1 : a.id === b.id ? 0 : 1
  );
  const indexById = new Map(memories.map((node, index) => [node.id, index]));
  const pairs = new Map<number, Edge>();
  for (const link of data.links) {
    const from = indexById.get(link.source);
    const to = indexById.get(link.target);
    if (from === undefined || to === undefined || from === to) continue;
    const source = Math.min(from, to);
    const target = Math.max(from, to);
    const key = source * memories.length + target;
    const rawWeight = link.weight;
    const weight =
      rawWeight && Number.isFinite(rawWeight) ? Math.min(2, Math.max(0.15, rawWeight)) : 1;
    const strength = weight * (link.type === "temporal" ? 0.27 : 1);
    const current = pairs.get(key);
    if (!current || strength > current.strength) pairs.set(key, { source, target, strength });
  }
  const edges = [...pairs.entries()].sort(([a], [b]) => a - b).map(([, edge]) => edge);
  const degrees = memories.map(() => 0);
  for (const edge of edges) {
    degrees[edge.source] += edge.strength;
    degrees[edge.target] += edge.strength;
  }

  const communities = findCommunities(degrees, edges);
  const linked = communities.filter((community) => community.members.length > 1);
  const toneById = new Map<string, number>();
  for (const community of communities) {
    const index = linked.indexOf(community);
    const strongest = linked
      .slice(0, 3)
      .map((major) => community.neighbors.get(major.members[0]) ?? 0);
    const best = Math.max(...strongest);
    const tone = index < 0 ? 3 : index < 3 ? index : best ? strongest.indexOf(best) : index % 3;
    for (const member of community.members) toneById.set(memories[member].id, tone);
  }
  return { memories, degrees, communities, edges, linkedCount: linked.length, toneById };
}

export type AtlasModel = ReturnType<typeof analyzeAtlas>;

export function layoutAtlas(model: AtlasModel, width: number, height: number) {
  const { memories, degrees, communities, edges, linkedCount, toneById } = model;
  const compact = width < 640;
  const compactFactor = compact ? 0.72 : 1;
  const major = linkedCount > 0 ? clusterPositions(Math.min(3, linkedCount), compact) : [];
  const occupied: Point[] = [];
  const blooms: Bloom[] = [];
  const nodes: AtlasNode[] = [];

  for (const community of communities) {
    const count = community.members.length;
    const clusterIndex = blooms.length;
    if (count === 1) {
      const index = community.members[0];
      const memory = memories[index];
      const solitary = memories.length === 1;
      const position = solitary
        ? { x: width * 0.46, y: height * 0.5 }
        : openPosition(occupied, width, height, occupied.length);
      occupied.push(position);
      nodes[index] = {
        ...position,
        memory,
        name: nodeName(memory),
        tone: 3,
        radius: (solitary ? 9 : degrees[index] === 0 ? 3.1 : 4.3) * compactFactor,
        featured: false,
        label: solitary ? shortLabel(memory) : undefined,
      };
      continue;
    }

    const anchor = major[clusterIndex];
    const center = anchor
      ? { x: width * anchor.x, y: height * anchor.y }
      : openPosition(occupied, width, height, clusterIndex);
    const tone = toneById.get(memories[community.members[0]].id)!;
    const density = Math.min(1, Math.sqrt(count / (anchor ? 27 : 20)));
    const rx = anchor
      ? width * (compact ? 0.24 : major.length === 1 ? 0.31 : 0.147) * (0.33 + 0.67 * density)
      : Math.min(width * 0.085, 34 + count * 2.6) * compactFactor;
    const ry = anchor
      ? height * (compact ? 0.141 : major.length === 1 ? 0.3 : 0.257) * (0.34 + 0.66 * density)
      : Math.min(height * 0.102, 21 + count * 2) * compactFactor;
    blooms.push({ ...center, rx, ry, tone, featured: Boolean(anchor) });

    const ranked = [...community.members].sort((a, b) => degrees[b] - degrees[a] || a - b);
    for (const [rank, index] of ranked.entries()) {
      const memory = memories[index];
      const hub = rank === 0;
      const angle = rank * goldenAngle + clusterIndex * 2.11;
      const spread = hub ? 0 : 0.22 + 0.78 * Math.sqrt(rank / (count - 1));
      const jitter = 0.88 + ((index * 167 + 19) % 29) / 120;
      const featured = hub && Boolean(anchor);
      const radius = featured
        ? (8 + Math.min(10, Math.sqrt(count) * 1.6)) * compactFactor
        : (2.65 + Math.sqrt(degrees[index] / degrees[ranked[0]]) * (hub ? 4 : 5.7)) * compactFactor;
      const position = {
        x: Math.min(width - 19, Math.max(19, center.x + Math.cos(angle) * rx * spread * jitter)),
        y: Math.min(height - 36, Math.max(31, center.y + Math.sin(angle) * ry * spread * jitter)),
      };
      occupied.push(position);
      nodes[index] = {
        ...position,
        memory,
        name: nodeName(memory),
        tone,
        radius,
        featured,
        label: featured ? shortLabel(memory) : undefined,
      };
    }
  }

  return {
    nodes,
    blooms,
    edges: visibleEdges(edges, nodes.length).map(({ source, target, strength }) => ({
      source: nodes[source],
      target: nodes[target],
      strength,
    })),
  };
}
