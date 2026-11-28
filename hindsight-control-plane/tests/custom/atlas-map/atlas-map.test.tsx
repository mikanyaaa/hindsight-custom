// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AtlasMap } from "@/custom/atlas-map/atlas-map";
import { analyzeAtlas } from "@/custom/atlas-map/layout";

vi.mock("next-intl", () => ({
  useLocale: () => "en",
  useTranslations: () => (key: string) => key,
}));

const model = analyzeAtlas({
  nodes: [
    { id: "search", label: "Search ranking decisions", metadata: { context: "Search" } },
    { id: "run", label: "Evaluation run" },
  ],
  links: [{ source: "search", target: "run" }],
});

describe("Atlas map controls", () => {
  it("exposes real memory names and opens the selected memory with the keyboard", () => {
    const open = vi.fn();
    render(<AtlasMap model={model} onNodeClick={open} />);
    const first = screen.getByRole("button", { name: "Evaluation run" });
    const second = screen.getByRole("button", { name: "Search ranking decisions" });
    expect(first.getAttribute("tabindex")).toBe("0");
    expect(second.getAttribute("tabindex")).toBe("-1");
    fireEvent.keyDown(first, { key: "ArrowLeft" });
    expect(document.activeElement).toBe(second);
    fireEvent.keyDown(second, { key: "Enter" });
    expect(open.mock.lastCall?.[0]).toMatchObject({ id: "search" });
  });

  it("distinguishes unavailable, empty, and pending graphs", () => {
    const { rerender } = render(<AtlasMap model={null} error />);
    expect(screen.getByRole("status").textContent).toContain("couldn’t load");
    rerender(<AtlasMap model={null} loading />);
    expect(screen.getByRole("status").textContent).toBe("loading");
    rerender(<AtlasMap model={analyzeAtlas({ nodes: [], links: [] })} />);
    expect(screen.getByRole("status").textContent).toBe("constellationEmpty");
  });
});
