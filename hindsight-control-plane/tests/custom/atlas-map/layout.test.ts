import { describe, expect, it } from "vitest";
import type { GraphData } from "@/components/graph-data";
import { analyzeAtlas, layoutAtlas } from "@/custom/atlas-map/layout";

const connected = (): GraphData => {
  const topics = ["Search", "Research", "Release"];
  const nodes = topics.flatMap((topic) =>
    Array.from({ length: 8 }, (_, index) => ({
      id: `${topic}-${index}`,
      label: `${topic} memory ${index}`,
      metadata: { context: topic, text: `${topic} memory ${index}` },
    }))
  );
  const links = topics.flatMap((topic) =>
    Array.from({ length: 7 }, (_, index) => ({
      source: `${topic}-0`,
      target: `${topic}-${index + 1}`,
      weight: 1,
    }))
  );
  return {
    nodes: [...nodes, { id: "isolated", label: "A standalone memory" }],
    links: [...links, { source: "Search-1", target: "Research-1", weight: 0.3, type: "temporal" }],
  };
};

describe("Atlas memory topology", () => {
  it("keeps real relationships and shares stable community colors across viewport sizes", () => {
    const data = connected();
    const model = analyzeAtlas(data);
    const desktop = layoutAtlas(model, 1440, 475);
    const mobile = layoutAtlas(model, 350, 360);
    const hubs = (layout: typeof desktop) => layout.nodes.filter((node) => node.featured);
    expect(desktop.nodes).toHaveLength(data.nodes.length);
    expect(desktop.edges).toHaveLength(data.links.length);
    expect(
      hubs(desktop)
        .map((node) => node.label)
        .sort()
    ).toEqual(["Release", "Research", "Search"]);
    expect(new Set(hubs(desktop).map((node) => node.tone)).size).toBe(3);
    expect(desktop.nodes.find(({ memory }) => memory.id === "isolated")?.tone).toBe(3);
    for (const node of mobile.nodes) {
      expect(node.tone).toBe(model.toneById.get(node.memory.id));
      expect(node.x).toBeGreaterThanOrEqual(0);
      expect(node.x).toBeLessThan(350);
      expect(node.y).toBeGreaterThanOrEqual(0);
      expect(node.y).toBeLessThan(360);
    }
    expect(hubs(desktop).map((node) => node.x)).not.toEqual(hubs(mobile).map((node) => node.x));
  });

  it("does not add relationships or community treatments to an unlinked bank", () => {
    const nodes = [
      { id: "id", label: "A memory" },
      { id: "other", label: "Another memory" },
    ];
    const layout = layoutAtlas(
      analyzeAtlas({
        nodes,
        links: [
          { source: "id", target: "unknown" },
          { source: "id", target: "id" },
        ],
      }),
      350,
      360
    );
    expect(layout.nodes.map((node) => node.name)).toEqual(["A memory", "Another memory"]);
    expect(layout.nodes.every((node) => node.tone === 3 && !node.featured)).toBe(true);
    expect(layout.edges).toEqual([]);
    expect(layout.blooms).toEqual([]);
  });

  it("preserves at least one real relationship per linked node under a dense line budget", () => {
    const nodes = Array.from({ length: 50 }, (_, index) => ({ id: String(index) }));
    const links = nodes.flatMap((node, index) =>
      nodes.slice(index + 1).map(({ id }) => ({ source: node.id, target: id }))
    );
    const result = layoutAtlas(analyzeAtlas({ nodes, links }), 1200, 400);
    expect(result.edges.length).toBeLessThan(links.length);
    expect(
      new Set(result.edges.flatMap((edge) => [edge.source.memory.id, edge.target.memory.id])).size
    ).toBe(nodes.length);
    const known = new Set(links.map(({ source, target }) => [source, target].sort().join(":")));
    expect(
      result.edges.every(({ source, target }) =>
        known.has([source.memory.id, target.memory.id].sort().join(":"))
      )
    ).toBe(true);
  });
});
