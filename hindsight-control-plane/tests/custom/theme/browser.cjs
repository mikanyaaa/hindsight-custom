/* Manual Playwright smoke check (Node + in-page browser globals); not part of vitest. */
/* eslint-disable @typescript-eslint/no-require-imports */
/* global require, process, console, URL, document, getComputedStyle, innerWidth, localStorage */
const { chromium } = require("playwright");
const fs = require("fs");
const output = process.env.OUTPUT_DIR || "/tmp/hindsight-glass-preview";
const baseUrl = process.env.BASE_URL || "http://localhost:9999";
const assert = require("node:assert/strict");
(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
    headless: true,
    args: ["--no-sandbox"],
  });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1080 },
    colorScheme: "dark",
  });
  try {
    const errors = [];
    page.on("pageerror", (e) => {
      errors.push(e.message);
      console.log("PAGE ERROR", e.message);
    });
    const banks = [
      {
        bank_id: "atlas",
        name: "Atlas · Research memory",
        fact_count: 1248,
        created_at: "2026-10-01T10:00:00Z",
        last_write_at: "2026-10-17T10:00:00Z",
      },
      {
        bank_id: "studio",
        name: "Studio · Product decisions",
        fact_count: 486,
        created_at: "2026-10-05T10:00:00Z",
      },
    ];
    await page.route("**/api/**", async (route) => {
      const url = new URL(route.request().url());
      const p = url.pathname;
      let data = {};
      if (p.endsWith("/version")) data = { api_version: "1.0.0", features: { observations: true } };
      else if (p === "/api/banks") data = { banks, total: 2 };
      else if (p.endsWith("/memories-timeseries")) data = { items: [], buckets: [], series: [] };
      else if (p.startsWith("/api/stats/"))
        data = {
          bank_id: "atlas",
          total_nodes: 1248,
          total_links: 3820,
          total_documents: 64,
          nodes_by_fact_type: { world: 820, experience: 428 },
          links_by_link_type: { semantic: 2200, entity: 1200, temporal: 420 },
          pending_operations: 0,
          failed_operations: 0,
          pending_consolidation: 0,
          failed_consolidation: 0,
          total_observations: 96,
          last_consolidated_at: "2026-10-17T10:00:00Z",
          last_memory_write_at: "2026-10-17T10:00:00Z",
        };
      else if (p === "/api/graph")
        data = {
          nodes: Array.from({ length: 40 }, (_, i) => ({
            data: { id: String(i), label: "Memory " + i, type: i % 2 ? "world" : "experience" },
          })),
          edges: Array.from({ length: 60 }, (_, i) => ({
            data: { source: String(i % 40), target: String((i * 7 + 3) % 40) },
          })),
        };
      else if (p === "/api/knowledge-base/tree")
        data = {
          roots: [
            {
              id: "research",
              name: "Research notes",
              kind: "page",
              children: [],
              tags: [],
              is_stale: false,
              timestamp: "2026-10-17T10:00:00Z",
            },
            {
              id: "principles",
              name: "Product principles",
              kind: "page",
              children: [],
              tags: [],
              is_stale: false,
              timestamp: "2026-10-17T10:00:00Z",
            },
          ],
        };
      else if (p.startsWith("/api/knowledge-base/pages/"))
        data = {
          id: p.split("/").pop(),
          name: "Research notes",
          tags: [],
          body: "Review evidence and decisions.",
          markdown: "Review evidence and decisions.",
          timestamp: "2026-10-17T10:00:00Z",
        };
      else if (p === "/api/documents")
        data = {
          items: [
            {
              id: "research/interaction-patterns.md",
              tags: [],
              metadata: {},
              memory_count: 20,
              created_at: "2026-10-17T09:00:00Z",
            },
            {
              id: "decisions/memory-architecture.md",
              tags: [],
              metadata: {},
              memory_count: 10,
              created_at: "2026-10-16T10:00:00Z",
            },
          ],
          total: 2,
        };
      else if (/\/(tags|mental-models|directives|operations)$/.test(p))
        data = { items: [], tags: [], total: 0 };
      else if (p.startsWith("/api/banks/")) data = { ...banks[0], config: {}, disposition: {} };
      else if (p === "/api/list") data = { items: [], total: 0 };
      else if (p === "/api/entities") data = { items: [], total: 0 };
      await route.fulfill({ json: data });
    });
    const requests = [];
    page.on("request", (r) => requests.push(r.url()));
    await page.goto(`${baseUrl}/en/banks/atlas`, { waitUntil: "networkidle", timeout: 120000 });
    await page.waitForTimeout(800);
    const enabled = process.env.THEME === "true";
    assert.equal(
      await page.locator("html").getAttribute("data-theme-layer"),
      enabled ? "warm-glass" : null
    );
    const homeEnabled = process.env.HOME_PANELS === "true";
    if (homeEnabled) await page.locator('[data-home-layout="warm-glass"]').waitFor();
    else assert.equal(await page.locator("[data-home-layout]").count(), 0);
    if (!enabled) {
      assert.equal(
        requests.some((u) => /lofi-city/.test(u)),
        false
      );
      const css = await page.evaluate(() =>
        [...document.styleSheets]
          .flatMap((s) => {
            try {
              return [...s.cssRules].map((r) => r.cssText);
            } catch {
              return [];
            }
          })
          .join("\n")
      );
      assert.equal(css.includes('data-theme-layer="warm-glass"'), false);
      if (!homeEnabled) assert.equal(css.includes('data-home-layout="warm-glass"'), false);
    }
    if (process.env.SIDEBAR === "true") {
      assert.equal(await page.locator('aside a[aria-current="page"]').count(), 1);
      assert.equal(await page.locator("aside a[aria-label]").count(), 8);
      const rail = page.locator("aside");
      const initial = await rail.getAttribute("aria-expanded");
      await rail.focus();
      await page.keyboard.press("Enter");
      assert.notEqual(await rail.getAttribute("aria-expanded"), initial);
      await page.keyboard.press("Space");
      assert.equal(await rail.getAttribute("aria-expanded"), initial);
    }
    fs.mkdirSync(output, { recursive: true });
    await page.getByRole("button", { name: "Fullscreen", exact: true }).click();
    const fullscreen = page.locator("canvas").first().locator("..");
    assert.equal(
      await fullscreen.evaluate((el) => el.contains(document.elementFromPoint(10, 10))),
      true
    );
    await page.keyboard.press("Escape");
    for (const view of [
      "data",
      "knowledge",
      "recall",
      "reflect",
      "documents",
      "entities",
      "profile",
      "home",
    ]) {
      await page.locator(`aside a[href$="?view=${view}"]`).click();
      await page.waitForURL(`**?view=${view}`);
      if (view === "data" && process.env.BRAIN === "true") {
        await page.getByRole("button", { name: "Brain", exact: true }).click();
        await page.getByRole("button", { name: "Fullscreen", exact: true }).click();
        const brainCanvas = page.locator("canvas").first().locator("..");
        assert.equal(
          await brainCanvas.evaluate((el) => el.contains(document.elementFromPoint(10, 10))),
          true
        );
        await page.keyboard.press("Escape");
        await page.getByRole("button", { name: "Network", exact: true }).click();
      }
    }
    for (const scheme of ["dark", "light"]) {
      await page.evaluate((s) => {
        localStorage.setItem("theme", s);
        document.documentElement.classList.toggle("dark", s === "dark");
      }, scheme);
      for (const width of [390, 768, 1440]) {
        await page.setViewportSize({ width, height: 1000 });
        await page.waitForTimeout(150);
        const sizes = await page.evaluate(() => ({
          scroll: document.documentElement.scrollWidth,
          width: innerWidth,
        }));
        assert.ok(sizes.scroll <= sizes.width, JSON.stringify({ scheme, ...sizes }));
        await page.screenshot({ path: `${output}/${scheme}-${width}.png` });
      }
    }
    if (enabled) {
      assert.match(
        await page.locator("aside").evaluate((el) => getComputedStyle(el).backdropFilter),
        /blur/
      );
      assert.match(
        await page
          .locator("main")
          .evaluate((el) => getComputedStyle(el, "::before").backdropFilter),
        /blur/
      );
      assert.match(
        await page.locator("html").evaluate((el) => el.style.getPropertyValue("--warm-city")),
        /lofi-city/
      );
      const cdp = await page.context().newCDPSession(page);
      await cdp.send("Emulation.setEmulatedMedia", {
        features: [{ name: "prefers-reduced-transparency", value: "reduce" }],
      });
      await page.waitForFunction(
        () => getComputedStyle(document.querySelector("aside")).backdropFilter === "none"
      );
      assert.equal(
        await page.locator("aside").evaluate((el) => getComputedStyle(el).backdropFilter),
        "none"
      );
      assert.equal(
        await page
          .locator("main")
          .evaluate((el) => getComputedStyle(el, "::before").backdropFilter),
        "none"
      );
      for (const dark of [true, false]) {
        await page.evaluate((d) => document.documentElement.classList.toggle("dark", d), dark);
        assert.match(
          await page.locator("aside").evaluate((el) => getComputedStyle(el).backgroundColor),
          /^rgb\(/
        );
      }
    }
    assert.deepEqual(errors, []);
    console.log("PASS production browser", { enabled, requests: requests.length });
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
