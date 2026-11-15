import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { GRAPH_FACT, GRAPH_LINK, GRAPH_NODE, graphPalette, inkOn } from "@/custom/theme/graph-palette";

const tokens = readFileSync("src/custom/theme/tokens.css", "utf8");

function token(name: string): string {
  const match = tokens.match(new RegExp(`${name}:\\s*([^;]+);`));
  if (!match) throw new Error(`missing ${name}`);
  return match[1].trim();
}

describe("graph palette", () => {
  it("uses the paper surfaces, the accent and the chart series", () => {
    const light = graphPalette(false);
    const dark = graphPalette(true);
    expect(light.background).toBe(token("--background"));
    expect(dark.background).toBe("#0e0e11");
    expect(light.foreground).toBe(token("--foreground"));
    expect(dark.foreground).toBe("#f3f1ea");
    expect(light.accent).toBe(token("--primary"));
    expect(dark.accent).toBe("#a699ff");
    expect(dark.onAccent).toBe("#1c1b19");
    expect(GRAPH_LINK.semantic).toBe(token("--chart-1"));
    expect(GRAPH_LINK.temporal).toBe(token("--hs-chart-semantic"));
    expect(GRAPH_LINK.entity).toBe(token("--chart-4"));
    expect(GRAPH_LINK.causal).toBe(token("--chart-3"));
    expect(GRAPH_NODE).toBe(GRAPH_LINK.semantic);
    expect(GRAPH_FACT.world).toBe(token("--chart-1"));
    expect(GRAPH_FACT.experience).toBe(token("--chart-2"));
    expect(GRAPH_FACT.observation).toBe(token("--chart-3"));
    expect(GRAPH_FACT.entity).toBe(token("--chart-5"));
    expect(light.background).not.toBe("#09090b");
    expect(dark.background).not.toBe("#09090b");
  });

  it("picks ink that stays readable on a saturated fill", () => {
    expect(inkOn("#f59e0b")).toBe("#1c1b19");
    expect(inkOn("#2c82f5")).toBe("#ffffff");
    expect(inkOn("#a699ff")).toBe("#1c1b19");
    expect(inkOn("not-a-color")).toBe("#ffffff");
  });
});
