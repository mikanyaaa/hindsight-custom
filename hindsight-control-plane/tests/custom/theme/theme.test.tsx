// @vitest-environment jsdom
import React from "react";
import { readFileSync } from "node:fs";
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, waitFor, cleanup } from "@testing-library/react";
import RootLayout from "../../../src/app/layout";
import Layer from "../../../src/custom/theme/layer";

vi.mock("../../../src/app/globals.css", () => ({}));
vi.mock("../../../src/custom/theme/warm-glass.css", () => ({}));
vi.mock("../../../src/custom/theme/assets/lofi-city.webp", () => ({
  default: { src: "/city.webp" },
}));
afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
});

describe("opt-in theme", () => {
  it.each([undefined, "false", "TRUE", "1", ""])(
    "returns upstream children with flag %s",
    (value) => {
      vi.stubEnv("NEXT_PUBLIC_HINDSIGHT_THEME_WARM_GLASS", value);
      const child = <div>upstream</div>;
      expect(RootLayout({ children: child })).toBe(child);
      expect(document.documentElement.hasAttribute("data-theme-layer")).toBe(false);
      expect(document.querySelector('link[rel="stylesheet"]')).toBeNull();
    }
  );
  it("loads the layer only for exact true", async () => {
    vi.stubEnv("NEXT_PUBLIC_HINDSIGHT_THEME_WARM_GLASS", "true");
    const child = <div>upstream</div>;
    const result = await RootLayout({ children: child });
    expect(React.isValidElement(result) && result.type).toBe(Layer);
  });
  it("applies the root scope and lazy local backdrop, then cleans up", async () => {
    const { unmount } = render(
      <Layer>
        <div>upstream</div>
      </Layer>
    );
    await waitFor(() => expect(document.documentElement.dataset.themeLayer).toBe("warm-glass"));
    await waitFor(() =>
      expect(document.documentElement.style.getPropertyValue("--warm-city")).toContain("/city.webp")
    );
    unmount();
    expect(document.documentElement.dataset.themeLayer).toBeUndefined();
    expect(document.documentElement.style.getPropertyValue("--warm-city")).toBe("");
  });
});

const css = readFileSync("src/custom/theme/warm-glass.css", "utf8");
it("positions the current upstream content wrapper above the blur without trapping fullscreen", () => {
  const source = readFileSync("src/app/[locale]/banks/[bankId]/page.tsx", "utf8");
  const [, mainClass, contentClass] = source.match(
    /<main className="([^"]+)">\s*<div className="([^"]+)"/
  )!;
  const style = document.createElement("style");
  style.textContent = css;
  document.head.append(style);
  document.documentElement.dataset.themeLayer = "warm-glass";
  try {
    const { container } = render(
      <main className={mainClass}>
        <div className={contentClass}>Readable settings</div>
      </main>
    );
    const content = container.querySelector("main > div")!;
    expect(getComputedStyle(content).position).toBe("relative");
    // An explicit z-index would create a stacking context around fixed graphs.
    expect(["", "auto"]).toContain(getComputedStyle(content).zIndex);
    expect(["", "none"]).toContain(getComputedStyle(content).getPropertyValue("backdrop-filter"));
  } finally {
    style.remove();
    delete document.documentElement.dataset.themeLayer;
  }
});
const rgb = (hex: string) => hex.match(/[a-f\d]{2}/gi)!.map((x) => parseInt(x, 16));
const luminance = (color: number[]) =>
  color
    .map((c) => {
      const s = c / 255;
      return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    })
    .reduce((sum, c, i) => sum + c * [0.2126, 0.7152, 0.0722][i], 0);
const contrast = (a: number[], b: number[]) => {
  const x = luminance(a),
    y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};
it("keeps normal, muted and primary text above 4.5:1 over worst-case image extremes", () => {
  // Parse actual CSS, not duplicate palette fixtures. Black/white bound every image
  // pixel for these monotonic foreground/surface pairs, including the unblurred fallback.
  const blocks = css
    .split("/* Blur")[0]
    .matchAll(/\[data-theme-layer="warm-glass"\](?:\.dark)?\s*\{([^}]+)\}/g);
  let palettes = 0;
  for (const [, block] of blocks) {
    const panel = block.match(/--warm-panel: rgb\((\d+) (\d+) (\d+) \/ (\d+)%\)/);
    if (!panel) continue;
    palettes++;
    const surface = panel.slice(1, 4).map(Number),
      alpha = Number(panel[4]) / 100;
    for (const token of ["foreground", "muted-foreground", "primary"]) {
      const foreground = rgb(block.match(new RegExp(`--${token}: (#[a-f0-9]{6})`))![1]);
      for (const background of [0, 255]) {
        expect(
          contrast(
            foreground,
            surface.map((c) => c * alpha + background * (1 - alpha))
          ),
          token
        ).toBeGreaterThanOrEqual(4.5);
      }
    }
  }
  expect(palettes).toBe(2);
});
it("keeps wallpaper URLs out of CSS and provides accessibility fallbacks", () => {
  expect(css).not.toContain("url(");
  expect(css).toContain("prefers-reduced-motion");
  expect(css).toContain("prefers-reduced-transparency");
  expect(css).toContain("@supports not");
});
