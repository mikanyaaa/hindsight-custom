// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { withHomePanels } from "../../../src/custom/home/view";
vi.mock("../../../src/custom/home/panels.css", () => ({}));
afterEach(cleanup);
it("preserves upstream props, navigation and bank updates without implementing data fetching", async () => {
  const navigate = vi.fn();
  const Home = withHomePanels(({ bankId, onNavigate }) => (
    <button onClick={() => onNavigate("data")}>{bankId}</button>
  ));
  const { container, rerender } = render(<Home bankId="one" onNavigate={navigate} />);
  await waitFor(() =>
    expect(container.querySelector('[data-home-layout="warm-glass"]')).not.toBeNull()
  );
  fireEvent.click(screen.getByText("one"));
  expect(navigate).toHaveBeenCalledWith("data");
  rerender(<Home bankId="two" onNavigate={navigate} />);
  expect(screen.queryByText("one")).toBeNull();
  expect(screen.getByText("two")).toBeTruthy();
});
it("selects the original component directly unless the exact build flag is true", () => {
  const source = readFileSync("src/app/[locale]/banks/[bankId]/page.tsx", "utf8");
  const selection = source.match(/const HomeView =([\s\S]+?);/)![1];
  // Execute the actual small hook expression for every supported flag state.
  for (const value of [undefined, "false", "TRUE", "1", "", "true"]) {
    const upstream = () => null;
    const wrapped = () => null;
    const wrap = vi.fn(() => wrapped);
    const result = new Function(
      "process",
      "withHomePanels",
      "UpstreamHomeView",
      `return (${selection});`
    )({ env: { NEXT_PUBLIC_HINDSIGHT_THEME_WARM_GLASS: value } }, wrap, upstream);
    expect(result).toBe(value === "true" ? wrapped : upstream);
    expect(wrap).toHaveBeenCalledTimes(value === "true" ? 1 : 0);
  }
});
