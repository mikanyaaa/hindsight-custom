// @vitest-environment jsdom
import React from "react";
import { readFileSync, statSync } from "node:fs";
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, cleanup, screen, fireEvent, act } from "@testing-library/react";
import {
  THEME_COOKIE,
  THEME_INIT_SCRIPT,
  THEME_STORAGE_KEY,
  readResolvedTheme,
  themeFromCookie,
} from "../../../src/custom/theme/init";
import { ThemeProvider, useTheme } from "../../../src/lib/theme-context";

const tokens = readFileSync("src/custom/theme/tokens.css", "utf8");
const globals = readFileSync("src/app/globals.css", "utf8");
const rootLayout = readFileSync("src/app/layout.tsx", "utf8");
const localeLayout = readFileSync("src/app/[locale]/layout.tsx", "utf8");
const fonts = readFileSync("src/custom/theme/fonts.ts", "utf8");

afterEach(() => {
  cleanup();
  document.documentElement.className = "";
  document.cookie = `${THEME_COOKIE}=; Path=/; Max-Age=0`;
  localStorage.clear();
  vi.unstubAllGlobals();
});

function block(source: string, selector: string): string {
  const start = source.indexOf(selector);
  if (start < 0) throw new Error(`missing ${selector}`);
  const open = source.indexOf("{", start);
  let depth = 0;
  for (let i = open; i < source.length; i++) {
    if (source[i] === "{") depth++;
    else if (source[i] === "}") {
      depth--;
      if (depth === 0) return source.slice(open + 1, i);
    }
  }
  throw new Error(`unclosed ${selector}`);
}

function value(body: string, name: string): string {
  const match = body.match(new RegExp(`${name}:\\s*([^;]+);`));
  if (!match) throw new Error(`missing ${name}`);
  return match[1].trim();
}

const rgb = (hex: string) => {
  const h = hex.replace("#", "");
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
};
const luminance = (channels: number[]) =>
  channels
    .map((channel) => {
      const s = channel / 255;
      return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    })
    .reduce((sum, channel, i) => sum + channel * [0.2126, 0.7152, 0.0722][i], 0);
const contrast = (a: number[], b: number[]) => {
  const x = luminance(a);
  const y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};
const mix = (base: number[], over: number[], alpha: number) =>
  base.map((channel, i) => channel * alpha + over[i] * (1 - alpha));

describe("quiet paper tokens", () => {
  const light = block(tokens, ":root");
  const dark = block(tokens, ".dark");

  it("uses one accent and the paper surfaces", () => {
    expect(value(light, "--background")).toBe("#faf9f7");
    expect(value(light, "--primary")).toBe("#5b47d6");
    expect(value(dark, "--background")).toBe("#090a0d");
    expect(value(dark, "--primary")).toBe("#78b3ff");
    expect(value(light, "--primary-gradient")).toBe("var(--primary)");
    expect(value(light, "--hs-brand-blue")).toBe("var(--primary)");
    expect(value(light, "--hs-brand-teal")).toBe("var(--primary)");
    expect(value(light, "--hs-fg-on-accent")).toBe("var(--primary-foreground)");
  });

  it("defines three radii and a 12px to 32px type scale", () => {
    const theme = block(tokens, "@theme inline");
    expect(value(theme, "--radius-sm")).toBe("6px");
    expect(value(theme, "--radius-md")).toBe("10px");
    expect(value(theme, "--radius-lg")).toBe("14px");
    expect(value(theme, "--radius-xl")).toBe("14px");
    expect(value(theme, "--text-xs")).toBe("0.75rem");
    expect(value(theme, "--text-sm")).toBe("0.875rem");
    expect(value(theme, "--text-base")).toBe("1rem");
    expect(value(theme, "--text-lg")).toBe("1.125rem");
    expect(value(theme, "--text-xl")).toBe("1.25rem");
    expect(value(theme, "--text-2xl")).toBe("1.5rem");
    expect(value(theme, "--text-3xl")).toBe("2rem");
    for (const step of ["4xl", "5xl", "6xl", "7xl", "8xl", "9xl"]) {
      expect(value(theme, `--text-${step}`)).toBe("2rem");
    }
  });

  it("keeps text and fills at WCAG AA in both themes, including glassy popovers", () => {
    for (const body of [light, dark]) {
      const page = rgb(value(body, "--background"));
      const card = rgb(value(body, "--card"));
      const ink = rgb(value(body, "--foreground"));
      const muted = rgb(value(body, "--muted-foreground"));
      const accent = rgb(value(body, "--primary"));
      const onAccent = rgb(value(body, "--primary-foreground"));
      const popover = rgb(value(body, "--popover"));
      expect(contrast(ink, page)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(ink, card)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(muted, page)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(muted, card)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(accent, page)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(onAccent, accent)).toBeGreaterThanOrEqual(4.5);
      const glassy = mix(popover, accent, 0.86);
      expect(contrast(ink, glassy)).toBeGreaterThanOrEqual(4.5);
      expect(
        contrast(rgb(value(body, "--destructive-foreground")), rgb(value(body, "--destructive")))
      ).toBeGreaterThanOrEqual(4.5);
      expect(contrast(rgb(value(body, "--destructive")), page)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("paints a grain tile and a 4% accent glow, with no photograph or turbulence", () => {
    expect(tokens).toContain('url("./grain.png")');
    expect(tokens).toContain("color-mix(in srgb, var(--primary) 4%, transparent)");
    expect(tokens.match(/url\([^)]+\)/g)).toEqual(['url("./grain.png")']);
    expect(tokens).not.toContain("feTurbulence");
    expect(tokens).not.toContain("webp");
    const grain = statSync("src/custom/theme/grain.png").size;
    expect(grain).toBeGreaterThan(0);
    expect(grain).toBeLessThan(2048);
  });

  it("blurs only floating layers and keeps the page shell sharp", () => {
    const rules = [...tokens.matchAll(/([^{}]+)\{([^{}]+)\}/g)];
    const blurred = rules.filter(([, , body]) => /backdrop-filter:\s*blur/.test(body));
    expect(blurred.length).toBeGreaterThan(0);
    for (const [, selector] of blurred) {
      expect(selector).not.toMatch(/\bmain\b/);
      expect(selector).not.toMatch(/\baside\b/);
    }
    expect(blurred.some(([selector]) => selector.includes('[role="dialog"]'))).toBe(true);
    expect(blurred.some(([selector]) => selector.includes('[role="menu"]'))).toBe(true);
    expect(
      blurred.some(([selector]) => selector.includes("data-radix-popper-content-wrapper"))
    ).toBe(true);
    const sharp = rules.filter(
      ([, selector, body]) => /\b(main|aside)\b/.test(selector) && /backdrop-filter/.test(body)
    );
    expect(sharp.length).toBeGreaterThan(0);
    for (const [, , body] of sharp) {
      expect(body).toContain("backdrop-filter: none");
      expect(body).not.toContain("blur");
    }
    expect(tokens).toContain("prefers-reduced-transparency");
    expect(tokens).toContain("prefers-reduced-motion");
  });

  it("removes the blue palette from the critical stylesheets", () => {
    const combined = `${globals}\n${tokens}`.toLowerCase();
    for (const banned of ["#0074d9", "#080c17", "#f3f5f9", "#5bb0ff", "#dce8ff", "#009296"]) {
      if (banned === "#009296") {
        // Chart series keep one teal. It is not a second brand stop.
        expect(combined.match(/#009296/g)?.length).toBe(1);
        continue;
      }
      expect(combined).not.toContain(banned);
    }
    expect(globals).not.toContain("--primary:");
    expect(globals).toContain('@import "../custom/theme/tokens.css"');
    expect(globals.indexOf('@import "tailwindcss"')).toBeLessThan(
      globals.indexOf('@import "../custom/theme/tokens.css"')
    );
    expect(rootLayout).not.toContain("import(");
    expect(rootLayout).not.toContain("WARM_GLASS");
  });
});

describe("theme before paint", () => {
  it("reads an explicit choice, then the cookie, then the operating system", () => {
    expect(themeFromCookie(undefined)).toBeNull();
    expect(themeFromCookie("dark")).toBe("dark");
    expect(themeFromCookie("nope")).toBeNull();
    localStorage.setItem(THEME_STORAGE_KEY, "dark");
    document.cookie = `${THEME_COOKIE}=light`;
    expect(readResolvedTheme()).toBe("dark");
    localStorage.removeItem(THEME_STORAGE_KEY);
    expect(readResolvedTheme()).toBe("light");
    document.cookie = `${THEME_COOKIE}=; Path=/; Max-Age=0`;
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: query.includes("dark"),
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }));
    expect(readResolvedTheme()).toBe("dark");
  });

  it("applies the class from the blocking script before any effect", () => {
    localStorage.setItem(THEME_STORAGE_KEY, "dark");
    expect(document.documentElement.classList.contains("dark")).toBe(false);
    new Function(THEME_INIT_SCRIPT)();
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(document.cookie).toContain(`${THEME_COOKIE}=dark`);
    expect(localeLayout).toContain("THEME_INIT_SCRIPT");
    expect(localeLayout).toContain('data-theme="quiet-paper"');
    expect(localeLayout.indexOf("<body")).toBeLessThan(localeLayout.indexOf("<script"));
    expect(localeLayout.indexOf("<script")).toBeLessThan(localeLayout.indexOf("<SidebarCollapsedProvider"));
    expect(fonts).toContain('display: "swap"');
    expect(fonts).toContain('adjustFontFallback: "Arial"');
    expect(fonts).toContain("geist-sans-latin.woff2");
    expect(fonts).toContain("geist-mono-latin.woff2");
  });

  it("toggles the class, storage and cookie together", () => {
    function Probe() {
      const { theme, toggleTheme } = useTheme();
      return <button onClick={toggleTheme}>{theme}</button>;
    }
    render(
      <ThemeProvider initialTheme="light">
        <Probe />
      </ThemeProvider>
    );
    expect(screen.getByRole("button").textContent).toBe("light");
    act(() => {
      fireEvent.click(screen.getByRole("button"));
    });
    expect(screen.getByRole("button").textContent).toBe("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
    expect(document.cookie).toContain(`${THEME_COOKIE}=dark`);
  });
});
