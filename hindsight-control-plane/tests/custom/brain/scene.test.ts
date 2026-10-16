import { expect, it } from "vitest";
import { adaptBrainData } from "@/custom/brain/adapter";
import { createBrainRenderer } from "@/custom/brain/renderer";
import { prepareBrainScene } from "@/custom/brain/scene";

const data = {
  nodes: [{ id: "a" }, { id: "b" }, { id: "c" }],
  links: [
    { source: "a", target: "b", type: "semantic" },
    { source: "b", target: "c", type: "unknown" },
  ],
};
const renderer = createBrainRenderer(adaptBrainData(data));

it("preserves the existing connectivity, recency and link colour scales", () => {
  const scene = prepareBrainScene({ data }, renderer);
  expect(scene.nodes.map((node) => node.heatColor)).toEqual([
    "rgb(199, 118, 142)",
    "rgb(240, 100, 60)",
    "rgb(199, 118, 142)",
  ]);
  expect(scene.links.map((link) => link.color)).toEqual(["#0074d9", "#0074d9"]);
  const recency = prepareBrainScene(
    { data, nodeHeatFn: () => 0.5, linkColorFn: () => "#123456" },
    renderer
  );
  expect(recency.nodes.every((node) => node.heatColor === "rgb(170, 130, 200)")).toBe(true);
  expect(recency.links.every((link) => link.color === "#123456")).toBe(true);
});

it("preserves scope colours, real positions and adjacency without preparing upstream text or hulls", () => {
  const scene = prepareBrainScene(
    {
      data,
      clusterKeyFn: () => "scope",
      clusterColorFn: () => "#abcdef",
      nodeColorFn: () => "#123456",
    },
    renderer
  );
  for (const node of scene.nodes) {
    expect(node.heatColor).toBe("#abcdef");
    const position = renderer.positions.get(node.node.id)!;
    expect(node.wx).toBe(position.x);
    expect(node.wy).toBe(position.y);
  }
  expect([...scene.neighbours.get(1)!]).toEqual([0, 2]);
});
