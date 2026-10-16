import { describe, expect, it, vi } from "vitest";
import { adaptBrainData } from "@/custom/brain/adapter";
import { createBrainRenderer } from "@/custom/brain/renderer";
import { cameraMoving, watchBrainCanvas } from "@/custom/brain/render-model";
import { brainRequestLimit } from "@/custom/brain/feature";
import { brainMessages } from "@/custom/brain/messages";
import { locales } from "@/i18n/config";
import type { GraphData } from "@/components/graph-data";

const graph: GraphData = {
  nodes: [{ id: "a", label: '<script>"a"</script>' }, { id: "b" }],
  links: [
    { source: "a", target: "b", type: "causal", weight: 2, metadata: { evidence: "real" } },
    { source: "a", target: "b", type: "semantic" },
    { source: "a", target: "a", type: "entity" },
    { source: "absent", target: "a" },
  ],
};

describe("brain adapter and shared canvas/SVG model", () => {
  it("keeps real identities, parallel types, loops, direction and metadata without mutation", () => {
    const original = JSON.stringify(graph);
    const data = adaptBrainData(graph);
    expect(data.graph.nodes).toHaveLength(2);
    expect(data.graph.links).toHaveLength(3);
    expect(data.graph.links).toContain(graph.links[0]);
    expect(data.graph.links).toContain(graph.links[2]);
    expect(JSON.stringify(graph)).toBe(original);
    expect(
      adaptBrainData({ nodes: [...graph.nodes, graph.nodes[0]], links: [] }).graph.nodes
    ).toHaveLength(2);
  });

  it("caps nodes deterministically and keeps coordinates through filters and scope changes", () => {
    const nodes = Array.from({ length: 600 }, (_, i) => ({ id: String(i).padStart(4, "0") }));
    const a = adaptBrainData({ nodes, links: [] });
    expect(a.graph.nodes).toHaveLength(500);
    expect(adaptBrainData({ nodes: [...nodes].reverse(), links: [] }).graph).toEqual(a.graph);
    const b = adaptBrainData({ nodes: nodes.slice(0, 20), links: [] });
    for (const [id, point] of b.positions) expect(a.positions.get(id)).toEqual(point);
    expect(createBrainRenderer(a).fitZoom(800, 600)).toBe(createBrainRenderer(b).fitZoom(800, 600));
    expect(adaptBrainData(graph, () => "work").positions.get("a")).not.toEqual(
      adaptBrainData(graph, () => "home").positions.get("a")
    );
  });

  it("uses a positive API limit only for brain mode", () => {
    for (const limit of [0, 20, 1000]) expect(brainRequestLimit(limit, false)).toBe(limit);
    expect(brainRequestLimit(0, true)).toBe(500);
    expect(brainRequestLimit(1000, true)).toBe(500);
    expect(brainRequestLimit(20, true)).toBe(20);
  });

  it("shares exact screen coordinates, colours, radii and real edge paths between Canvas and SVG", () => {
    const data = adaptBrainData(graph);
    const renderer = createBrainRenderer(data);
    const nodes = data.graph.nodes.map((node) => ({
      node,
      wx: data.positions.get(node.id)!.x,
      wy: data.positions.get(node.id)!.y,
      heatColor: "#0074d9",
      linkCount: 3,
    }));
    const links = data.graph.links.map((link) => ({
      a: nodes.findIndex((n) => n.node.id === link.source),
      b: nodes.findIndex((n) => n.node.id === link.target),
      color: "#009296",
      type: link.type!,
    }));
    const view = { W: 800, H: 600, panX: 12, panY: -8, zoom: 0.7 };
    const x = new Float32Array(nodes.map((node) => 400 + 12 + node.wx * view.zoom));
    const y = new Float32Array(nodes.map((node) => 300 - 8 + node.wy * view.zoom));
    const ctx = {
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      quadraticCurveTo: vi.fn(),
      stroke: vi.fn(),
      arc: vi.fn(),
      fill: vi.fn(),
    };
    expect(renderer.links(ctx as unknown as CanvasRenderingContext2D, x, y, links, -1)).toBe(3);
    renderer.node(
      ctx as unknown as CanvasRenderingContext2D,
      nodes[0],
      x[0],
      y[0],
      false,
      false,
      false
    );
    expect(ctx.arc).toHaveBeenCalledWith(x[0], y[0], 1.6, 0, Math.PI * 2);
    const svg = renderer.svg(view, nodes, links, -1);
    expect(svg).toContain(`cx="${x[0]}" cy="${y[0]}" r="1.6" fill="#0074d9"`);
    for (const [cx, cy, bx, by] of ctx.quadraticCurveTo.mock.calls)
      expect(svg).toContain(`Q${cx} ${cy} ${bx} ${by}`);
    expect(svg).toContain('data-source="a" data-target="b" data-type="causal"');
    expect(svg).toContain("&lt;script&gt;&quot;a&quot;&lt;/script&gt;");
    expect(svg).not.toContain("<script>");
    nodes[0].heatColor = "url(https://example.invalid/paint)";
    expect(renderer.svg(view, nodes, links, -1)).not.toContain("example.invalid");
  });

  it("keeps empty banks empty and bounds the edge budget including hover", () => {
    const empty = createBrainRenderer(adaptBrainData({ nodes: [], links: [] }));
    const view = { W: 800, H: 600, panX: 0, panY: 0, zoom: 1 };
    expect(empty.svg(view, [], [], -1)).not.toMatch(/circle|polygon|polyline/);
    const ctx = {
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      quadraticCurveTo: vi.fn(),
      stroke: vi.fn(),
    };
    const links = Array.from({ length: 5100 }, () => ({
      a: 0,
      b: 1,
      color: "#0074d9",
      type: "semantic",
    }));
    expect(
      empty.links(
        ctx as unknown as CanvasRenderingContext2D,
        new Float32Array([1, 2]),
        new Float32Array([3, 4]),
        links,
        0
      )
    ).toBe(5000);
    expect(cameraMoving({ ...view, targetPanX: 0, targetPanY: 0, targetZoom: 1 })).toBe(false);
  });

  it("gives rare link types a place within a deterministic budget", () => {
    const input = {
      ...graph,
      links: [...Array.from({ length: 6000 }, () => graph.links[1]), graph.links[0]],
    };
    const data = adaptBrainData(input);
    expect(data.graph.links.slice(0, 2)).toContain(graph.links[0]);
  });

  it("removes all custom event listeners during cleanup", () => {
    const target = new EventTarget();
    const redraw = vi.fn();
    const stop = watchBrainCanvas(target as HTMLCanvasElement, redraw);
    target.dispatchEvent(new Event("mousemove"));
    expect(redraw).toHaveBeenCalledTimes(1);
    stop();
    target.dispatchEvent(new Event("mousemove"));
    expect(redraw).toHaveBeenCalledTimes(1);
  });

  it("defines the isolated namespace in all supported locales", () => {
    expect(Object.keys(brainMessages).sort()).toEqual([...locales].sort());
    for (const messages of Object.values(brainMessages))
      expect(Object.keys(messages)).toEqual(Object.keys(brainMessages.en));
  });
});
