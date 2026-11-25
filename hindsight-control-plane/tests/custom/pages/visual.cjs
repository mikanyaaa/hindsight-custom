/* Local visual regression for every control-plane page.
   Not part of vitest and not run from GitHub Actions.
   From hindsight-control-plane/:
     node tests/custom/pages/visual.cjs
   BASE_URL defaults to http://localhost:9999.
   OUTPUT_DIR, when set, receives one PNG per page, width and theme.
   Every API call is answered with the fictional data in this file. */
/* eslint-disable @typescript-eslint/no-require-imports */
/* global require, process, console, URL, document, getComputedStyle, innerWidth, NodeFilter */
const { chromium } = require("playwright");
const { mkdirSync } = require("node:fs");
const assert = require("node:assert/strict");

const baseUrl = process.env.BASE_URL || "http://localhost:9999";
const outputDir = process.env.OUTPUT_DIR || "";
const NOW = Date.parse("2026-11-15T12:00:00.000Z");
const DAY = 24 * 60 * 60 * 1000;

/** Pages a person can open. Bank views match the frame navigation ids. */
const PAGES = [
  { id: "banks", path: "/en/dashboard", ready: "Memory banks", frame: false },
  { id: "login", path: "/en/login", ready: "Enter your access key to continue", frame: false },
  { id: "home", path: "/en/banks/beispiel?view=home", ready: "New in the last 7 days", frame: true },
  { id: "data", path: "/en/banks/beispiel?view=data", ready: "total memories", frame: true },
  { id: "pages", path: "/en/banks/beispiel?view=pages", ready: "Beispiel page", frame: true },
  { id: "recall", path: "/en/banks/beispiel?view=recall", ready: "Ready to Recall", frame: true },
  { id: "reflect", path: "/en/banks/beispiel?view=reflect", ready: "Ready to Reflect", frame: true },
  { id: "documents", path: "/en/banks/beispiel?view=documents", ready: "beispiel-note", frame: true },
  { id: "entities", path: "/en/banks/beispiel?view=entities", ready: "Entities", frame: true },
  { id: "profile", path: "/en/banks/beispiel?view=profile", ready: "Bank Configuration", frame: true },
];

const WIDTHS = [
  { name: "1440", width: 1440, height: 900 },
  { name: "390", width: 390, height: 844 },
];

function iso(daysAgo) {
  return new Date(NOW - daysAgo * DAY).toISOString();
}

const bank = {
  bank_id: "beispiel",
  name: "Beispiel bank",
  fact_count: 4,
  created_at: iso(40),
  updated_at: iso(1),
};

const memories = [
  {
    id: "mem-1",
    text: "Beispiel memory one is a fictional fact.",
    fact_type: "world",
    type: "world",
    tags: ["demo"],
    date: iso(1),
    created_at: iso(1),
    mentioned_at: iso(1),
    occurred_start: iso(1),
    context: "Beispiel context",
    entities: ["Beispiel place"],
    document_id: "beispiel-note",
    proof_count: 1,
  },
  {
    id: "mem-2",
    text: "Beispiel memory two is another fictional fact.",
    fact_type: "experience",
    type: "experience",
    tags: ["harness:cursor-cli"],
    date: iso(2),
    created_at: iso(2),
    mentioned_at: iso(2),
    occurred_start: iso(2),
    context: "Beispiel context",
    entities: ["Beispiel place"],
    document_id: "beispiel-note",
    proof_count: 2,
  },
];

const graphNodes = memories.map((memory) => ({
  data: { id: memory.id, label: memory.text.slice(0, 28), type: memory.fact_type },
}));
const graphEdges = [
  { data: { source: "mem-1", target: "mem-2", weight: 1, type: "semantic" } },
];

function mockBody(pathname) {
  if (pathname.endsWith("/version")) {
    return {
      api_version: "1.2.0",
      features: {
        observations: true,
        mcp: false,
        worker: false,
        bank_config_api: true,
        file_upload_api: true,
        document_export_api: false,
        document_import_api: false,
        audit_log: false,
        llm_trace: false,
        store_document_text: true,
      },
    };
  }
  if (pathname.endsWith("/memories-timeseries")) {
    return { bank_id: "beispiel", period: "day", buckets: [], series: [] };
  }
  if (pathname.includes("/stats/")) {
    return {
      bank_id: "beispiel",
      total_nodes: memories.length,
      total_links: 1,
      total_documents: 1,
      nodes_by_fact_type: { world: 1, experience: 1, observation: 0 },
      links_by_link_type: { semantic: 1 },
      pending_operations: 0,
      failed_operations: 0,
      pending_consolidation: 0,
      failed_consolidation: 0,
      total_observations: 0,
      last_consolidated_at: iso(1),
    };
  }
  if (pathname.includes("/entities/graph")) {
    return {
      nodes: [
        { data: { id: "ent-1", label: "Beispiel place", mentionCount: 2, color: "#2c82f5" } },
      ],
      edges: [],
      total_entities: 1,
      total_edges: 0,
      limit: 100,
    };
  }
  if (pathname.startsWith("/api/graph")) {
    return {
      nodes: graphNodes,
      edges: graphEdges,
      table_rows: memories,
      total_units: memories.length,
      limit: 100,
    };
  }
  if (pathname.startsWith("/api/pages/") && !pathname.endsWith("/tree")) {
    return {
      id: "page-1",
      name: "Beispiel page",
      type: "page",
      description: null,
      tags: ["demo"],
      timestamp: iso(1),
      body: "Fictional page body.",
      markdown: "Fictional page body.",
    };
  }
  if (pathname.endsWith("/api/pages/tree") || pathname.endsWith("/pages/tree")) {
    return {
      roots: [
        {
          id: "page-1",
          kind: "page",
          name: "Beispiel page",
          parent_id: null,
          mental_model_id: "mm-1",
          managed: false,
          description: null,
          tags: ["demo"],
          timestamp: iso(1),
          is_stale: false,
          trigger: null,
          children: [],
        },
      ],
    };
  }
  if (pathname.includes("/mental-models")) {
    return {
      items: [
        {
          id: "mm-1",
          name: "Beispiel model",
          tags: ["demo"],
          is_stale: false,
          last_refreshed_at: iso(1),
          trigger: { refresh_after_consolidation: true },
        },
      ],
      total: 1,
    };
  }
  if (pathname.includes("/documents")) {
    return {
      items: [
        {
          id: "beispiel-note",
          tags: ["demo"],
          metadata: {},
          memory_unit_count: 2,
          text_length: 240,
          created_at: iso(3),
          updated_at: iso(1),
        },
      ],
      total: 1,
    };
  }
  if (pathname.includes("/entities")) {
    return {
      items: [
        {
          id: "ent-1",
          canonical_name: "Beispiel place",
          mention_count: 2,
          first_seen: iso(10),
          last_seen: iso(1),
        },
      ],
      total: 1,
    };
  }
  if (pathname.includes("/operations")) return { operations: [], total: 0, limit: 20, offset: 0 };
  if (pathname.includes("/directives")) return { items: [], total: 0, limit: 100, offset: 0 };
  if (pathname.includes("/tags")) return { items: [{ tag: "demo", count: 2 }], total: 1 };
  if (pathname.includes("/aliases")) return { bank_id: "beispiel", aliases: [] };
  if (pathname.includes("/config")) {
    return {
      bank_id: "beispiel",
      config: {
        reflect_mission: "Remember fictional examples.",
        disposition_skepticism: 3,
        disposition_literalism: 3,
        disposition_empathy: 3,
      },
      overrides: {},
    };
  }
  if (pathname === "/api/banks" || pathname.endsWith("/api/banks")) {
    return { banks: [bank], total: 1 };
  }
  if (pathname.includes("/api/list")) return { items: memories, total: memories.length, limit: 100, offset: 0 };
  if (pathname.endsWith("/health")) return { status: "healthy" };
  return { items: [], total: 0, operations: [], roots: [], banks: [], config: {}, overrides: {} };
}

function installClock(fixed) {
  Date.now = () => fixed;
}

async function measure(page) {
  return page.evaluate(() => {
    const root = getComputedStyle(document.documentElement);
    const main = document.querySelector("main");
    const aside = document.querySelector("aside");
    const tab = document.querySelector('nav[aria-label="Sections"]');
    const visible = (el) => {
      if (!el) return false;
      const style = getComputedStyle(el);
      const box = el.getBoundingClientRect();
      return style.display !== "none" && style.visibility !== "hidden" && box.height > 0 && box.width > 0;
    };
    const small = [];
    const rootNode = main || document.body;
    const walker = document.createTreeWalker(rootNode, NodeFilter.SHOW_TEXT);
    let textNode = walker.nextNode();
    while (textNode) {
      const text = (textNode.textContent || "").trim();
      const parent = textNode.parentElement;
      if (text && parent && !parent.closest("svg")) {
        const size = parseFloat(getComputedStyle(parent).fontSize);
        if (size < 12) small.push(`${size}px ${parent.tagName} ${text.slice(0, 32)}`);
      }
      textNode = walker.nextNode();
      if (small.length >= 6) break;
    }
    const fields = [];
    const skip = new Set(["checkbox", "radio", "range", "file", "color", "hidden"]);
    for (const el of rootNode.querySelectorAll("input, textarea, [role='combobox']")) {
      const type = (el.getAttribute("type") || "text").toLowerCase();
      if (skip.has(type)) continue;
      const box = el.getBoundingClientRect();
      if (box.height > 0 && box.width > 0 && getComputedStyle(el).visibility !== "hidden") {
        fields.push(Math.round(box.height));
      }
    }
    return {
      background: root.getPropertyValue("--background").trim(),
      primary: root.getPropertyValue("--primary").trim(),
      mainBlur: main ? getComputedStyle(main).backdropFilter : "none",
      asideBlur: aside ? getComputedStyle(aside).backdropFilter : "none",
      documentScroll: document.documentElement.scrollWidth,
      mainScroll: main ? main.scrollWidth : 0,
      mainClient: main ? main.clientWidth : 0,
      width: innerWidth,
      asideVisible: visible(aside),
      tabVisible: visible(tab),
      small,
      fields,
      recall: document.querySelector("#home-recall")
        ? Math.round(document.querySelector("#home-recall").getBoundingClientRect().height)
        : null,
    };
  });
}

(async () => {
  if (outputDir) mkdirSync(outputDir, { recursive: true });
  const browser = await chromium.launch({
    ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
    headless: true,
    args: ["--no-sandbox", "--disable-lcd-text"],
  });
  const failures = [];
  const check = (condition, message) => {
    if (!condition) failures.push(message);
  };
  try {
    for (const scheme of ["light", "dark"]) {
      const context = await browser.newContext({
        viewport: { width: 1440, height: 900 },
        colorScheme: scheme,
        reducedMotion: "reduce",
        deviceScaleFactor: 1,
      });
      await context.addCookies([
        { name: "NEXT_LOCALE", value: "en", url: baseUrl },
        { name: "hs-theme", value: scheme, url: baseUrl },
      ]);
      await context.addInitScript(installClock, NOW);
      await context.route("**/api/**", (route) => {
        const url = new URL(route.request().url());
        return route.fulfill({ json: mockBody(url.pathname) });
      });
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      for (const size of WIDTHS) {
        await page.setViewportSize({ width: size.width, height: size.height });
        for (const view of PAGES) {
          errors.length = 0;
          const where = `${view.id} ${scheme} ${size.name}`;
          try {
            await page.goto(`${baseUrl}${view.path}`, {
              waitUntil: "domcontentloaded",
              timeout: 60000,
            });
            const scope = view.frame ? page.locator("main") : page.locator("body");
            await scope.getByText(view.ready, { exact: false }).first().waitFor({ timeout: 20000 });
            await page.waitForTimeout(300);
            const shot = await measure(page);
            check(errors.length === 0, `${where} page error: ${errors.join("; ")}`);
            check(shot.background === (scheme === "dark" ? "#0e0e11" : "#faf9f7"), `${where} background ${shot.background}`);
            check(shot.primary === (scheme === "dark" ? "#a699ff" : "#5b47d6"), `${where} accent ${shot.primary}`);
            check(shot.mainBlur === "none", `${where} main blur ${shot.mainBlur}`);
            check(shot.asideBlur === "none", `${where} aside blur ${shot.asideBlur}`);
            check(shot.documentScroll <= shot.width + 1, `${where} document overflow ${shot.documentScroll}`);
            if (shot.mainClient > 0) {
              check(shot.mainScroll <= shot.mainClient + 1, `${where} main overflow ${shot.mainScroll}/${shot.mainClient}`);
            }
            check(shot.small.length === 0, `${where} type below 12px: ${shot.small.join(" | ")}`);
            for (const height of shot.fields) {
              check(height >= 44, `${where} field is ${height}px`);
            }
            if (view.frame) {
              check(shot.tabVisible === size.width < 768, `${where} tab bar visible=${shot.tabVisible}`);
              check(shot.asideVisible === size.width >= 768, `${where} sidebar visible=${shot.asideVisible}`);
            }
            if (view.id === "home") check(shot.recall >= 48, `${where} recall field ${shot.recall}`);
            check((await page.getByRole("alertdialog").count()) === 0, `${where} session dialog`);
            if (outputDir) {
              await page.screenshot({ path: `${outputDir}/${view.id}-${size.name}-${scheme}.png` });
            }
            console.log(failures.some((item) => item.startsWith(where)) ? "FAIL" : "ok", where);
          } catch (error) {
            failures.push(`${where} ${error instanceof Error ? error.message.split("\n")[0] : "did not render"}`);
            console.log("FAIL", where);
          }
        }
      }
      await context.close();
    }
    assert.deepEqual(failures, [], failures.join("\n"));
    console.log("PASS visual regression: every page, 390 and 1440, light and dark");
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
