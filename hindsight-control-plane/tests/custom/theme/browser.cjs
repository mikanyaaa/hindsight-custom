/* Manual Playwright smoke check (Node + in-page browser globals); not part of vitest. */
/* eslint-disable @typescript-eslint/no-require-imports */
/* global require, process, console, URL, document, getComputedStyle, innerWidth */
const { chromium } = require("playwright");
const fs = require("fs");
const output = process.env.OUTPUT_DIR || "/tmp/hindsight-glass-preview";
const baseUrl = process.env.BASE_URL || "http://localhost:9999";
const assert = require("node:assert/strict");
(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH,
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
        name: "Studio",
        fact_count: 1248,
        created_at: "2026-10-01T10:00:00Z",
        last_write_at: "2026-10-17T10:00:00Z",
      },
      {
        bank_id: "studio",
        name: "Research archive",
        fact_count: 486,
        created_at: "2026-10-05T10:00:00Z",
      },
    ];
    // Fictional connected communities exercise the same graph response the bank receives.
    const topics = ["Search", "Research", "Release"];
    const titles = ["Search ranking decisions", "Onboarding interview notes", "Release checklist"];
    const groupSizes = [54, 46, 40];
    const memories = titles.map((text, i) => ({
      id: `${i}-0`,
      text,
      tags: [topics[i]],
      fact_type: ["world", "experience", "observation"][i],
      date: new Date(Date.now() - (i + 1) * 86400000).toISOString(),
    }));
    const nodes = [];
    const edges = [];
    function link(source, target) {
      edges.push({ data: { source, target, weight: 1 } });
    }
    topics.forEach((topic, group) => {
      const hub = `${group}-0`;
      if (group > 0) link(`${group - 1}-0`, hub);
      for (let i = 0; i < groupSizes[group]; i++) {
        const id = `${group}-${i}`;
        nodes.push({ data: { id, label: i ? `${topic} note ${i}` : topic } });
        if (!i) continue;
        link(hub, id);
        if (i > 2 && i % 3 !== 0) link(`${group}-${i - 1}`, id);
        if (i > 10 && i % 4 === 0) link(`${group}-7`, id);
      }
    });
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
          total_links: 384,
          total_documents: 36,
          nodes_by_fact_type: { world: 820, experience: 428 },
          links_by_link_type: { semantic: 244, entity: 108, temporal: 32 },
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
          nodes,
          edges,
          table_rows: nodes.map(({ data }) => ({
            id: data.id, text: data.label, tags: [topics[Number(data.id.split("-")[0])]],
            entities: topics[Number(data.id.split("-")[0])], fact_type: "world",
          })),
        };
      else if (p === "/api/pages/tree")
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
      else if (p.startsWith("/api/pages/") && p !== "/api/pages/tree")
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
      else if (p.startsWith("/api/memories/")) {
        const memory = memories.find((item) => item.id === p.split("/").pop());
        data = { ...memory, type: memory?.fact_type, entities: [], context: "", state: "valid" };
      }
      else if (p === "/api/list") data = { items: memories, total: memories.length };
      else if (p === "/api/entities") data = { items: [], total: 0 };
      await route.fulfill({ json: data });
    });
    const requests = [];
    page.on("request", (r) => requests.push(r.url()));
    await page.goto(`${baseUrl}/en/banks/atlas`, { waitUntil: "networkidle", timeout: 120000 });
    await page.waitForTimeout(800);
    assert.equal(await page.locator("html").getAttribute("data-theme"), "quiet-paper");
    assert.equal(await page.locator("html").getAttribute("data-theme-layer"), null);
    assert.equal(await page.locator("[data-home-layout]").count(), 0);
    assert.equal(
      requests.some((u) => /lofi-city|feTurbulence/.test(u)),
      false
    );
    const painted = await page.evaluate(() => ({
      primary: getComputedStyle(document.documentElement).getPropertyValue("--primary").trim(),
      main: getComputedStyle(document.querySelector("main")).backdropFilter,
    }));
    const dark = await page.evaluate(() => document.documentElement.classList.contains("dark"));
    assert.equal(painted.primary, dark ? "#78b3ff" : "#5b47d6");
    assert.equal(painted.main, "none");
    const nav = page.locator(".atlas-bank-nav");
    await nav.waitFor();
    assert.equal(await nav.locator('[aria-current="page"]').count(), 1);
    const map = page.getByRole("region", { name: "Memory map" });
    const camera = map.locator("svg > g[transform]");
    await camera.waitFor();
    const initialTransform = await camera.getAttribute("transform");
    await map.getByRole("button", { name: "Zoom in" }).click();
    assert.notEqual(await camera.getAttribute("transform"), initialTransform);
    await map.getByRole("button", { name: "Fit map to view" }).click();
    assert.equal(await camera.getAttribute("transform"), initialTransform);
    await map.getByRole("button", { name: "Search", exact: true }).focus();
    await page.keyboard.press("Enter");
    await page.getByRole("dialog").getByText(titles[0], { exact: true }).waitFor();
    await page.keyboard.press("Escape");
    fs.mkdirSync(output, { recursive: true });
    for (const view of [
      "data",
      "pages",
      "recall",
      "reflect",
      "documents",
      "entities",
      "profile",
      "home",
    ]) {
      if (["reflect", "documents", "entities", "profile"].includes(view)) {
        await nav.getByRole("button", { name: /more/i }).click();
        await page.locator(`[role="menu"] a[href$="?view=${view}"]`).click();
      } else {
        await nav.locator(`a[href$="?view=${view}"]`).click();
      }
      await page.waitForURL(`**?view=${view}`);
      if (view === "data") {
        await page.getByRole("button", { name: "Fullscreen", exact: true }).click();
        const fullscreen = page.locator("canvas").first().locator("..");
        assert.ok(await fullscreen.evaluate((el) => el.contains(document.elementFromPoint(10, 10))));
        await page.keyboard.press("Escape");
      }
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
      if (scheme === "light") {
        await page.getByRole("button", { name: /light mode|light theme/i }).click();
        await page.reload();
      }
      assert.equal(await page.locator("html").evaluate(el => el.classList.contains("dark")), scheme === "dark");
      for (const width of [390, 768, 1024, 1440]) {
        await page.setViewportSize({ width, height: width < 500 ? 844 : 960 });
        await page.waitForTimeout(150);
        const sizes = await page.evaluate(() => ({
          scroll: document.documentElement.scrollWidth,
          width: innerWidth,
        }));
        assert.ok(sizes.scroll <= sizes.width, JSON.stringify({ scheme, ...sizes }));
        await page.screenshot({ path: `${output}/${scheme}-${width}.png` });
      }
    }
    assert.deepEqual(errors, []);
    console.log("PASS production browser", { requests: requests.length });
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
