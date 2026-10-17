import { describe, expect, it } from "vitest";
import { convertHindsightGraphData } from "@/components/graph-data";

describe("graph data conversion", () => {
  it("preserves labels, first duplicate metadata, fallback IDs and edge attributes", () => {
    const first = { id: "one", text: "A".repeat(50), context: "first" };
    const result = convertHindsightGraphData({
      nodes: [
        { data: { id: "one" } },
        { data: { id: "two", label: "Explicit", color: "#123456" } },
        { data: { id: "missing-long-id" } },
      ],
      table_rows: [first, { id: "one", text: "Duplicate" }, { id: "two", text: "Other" }],
      edges: [{ data: { source: "one", target: "two", lineStyle: "dashed", similarity: 0.7 } }],
    });
    expect(result.nodes.map((node) => node.label)).toEqual([
      "A".repeat(40) + "...",
      "Explicit",
      "missing-",
    ]);
    expect(result.nodes[0].metadata).toBe(first);
    expect(result.nodes[1].color).toBe("#123456");
    expect(result.links[0]).toMatchObject({
      source: "one",
      target: "two",
      type: "temporal",
      weight: 0.7,
    });
    expect(convertHindsightGraphData({})).toEqual({ nodes: [], links: [] });
  });

  it("indexes a large row collection once instead of scanning it per node", () => {
    let reads = 0;
    const table_rows = Array.from({ length: 5000 }, (_, i) => ({
      get id() {
        reads++;
        return String(i);
      },
      text: `Memory ${i}`,
    }));
    const nodes = Array.from({ length: 5000 }, (_, i) => ({ data: { id: String(i) } }));
    const result = convertHindsightGraphData({ nodes, table_rows });
    expect(result.nodes[4999].label).toBe("Memory 4999");
    expect(reads).toBeLessThanOrEqual(10000);
  });
});
