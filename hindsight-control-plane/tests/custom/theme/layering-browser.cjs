/* Local visual check. Not part of vitest and not run from GitHub Actions.
   node tests/custom/theme/layering-browser.cjs
   Uses the token stylesheet in a real browser. No backend and no credentials. */
/* eslint-disable @typescript-eslint/no-require-imports */
/* global require, process, console, document, getComputedStyle */
const { chromium } = require("playwright");
const { readFileSync } = require("node:fs");
const assert = require("node:assert/strict");
const css = readFileSync(process.env.THEME_CSS || "src/custom/theme/tokens.css", "utf8");
const source = readFileSync("src/app/[locale]/banks/[bankId]/page.tsx", "utf8");
const match = source.match(/<main className="([^"]+)">/);
if (!match) throw new Error("bank page main wrapper not found");
const [, mainClass] = match;

(async () => {
  const browser = await chromium.launch({
    ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
    headless: true,
    args: ["--no-sandbox", "--disable-lcd-text"],
  });
  try {
    const page = await browser.newPage();
    for (const dark of [false, true]) {
      for (const width of [390, 768, 1440]) {
        await page.setViewportSize({ width, height: 900 });
        await page.setContent(`<html data-theme="quiet-paper" class="${dark ? "dark" : ""}">
          <style>
            * { box-sizing: border-box; }
            body { margin: 0; font: 16px Arial; color: var(--foreground); }
            header { position: relative; z-index: 40; height: 60px; background: var(--card); }
            .shell { display: flex; }
            aside { width: 232px; }
            main { height: 700px; margin: 8px; overflow-y: auto; flex: 1; }
            #fullscreen { position: fixed; inset: 0; z-index: 100; background: var(--card); }
          </style>
          <style>${css}</style>
          <body>
            <header>Header</header>
            <div class="shell">
              <aside>Nav</aside>
              <main class="${mainClass}"><div class="atlas-bank-content--home">
                <section id="sample"><h1>Bank settings</h1>
                <p style="color: var(--foreground)">Memory configuration and controls</p>
                <button id="save" style="background: var(--primary); color: var(--primary-foreground)">Save changes</button>
                </section>
                <div id="fullscreen" hidden>Fullscreen graph</div>
              </div></main>
            </div>
            <div role="dialog" style="position:fixed;bottom:0;z-index:50">Readable dialog</div>
          </body></html>`);
        const shell = await page.evaluate(() => ({
          main: getComputedStyle(document.querySelector("main")).backdropFilter,
          aside: getComputedStyle(document.querySelector("aside")).backdropFilter,
          dialog: getComputedStyle(document.querySelector('[role="dialog"]')).backdropFilter,
          primary: getComputedStyle(document.documentElement).getPropertyValue("--primary").trim(),
          background: getComputedStyle(document.documentElement).getPropertyValue("--background").trim(),
        }));
        assert.equal(shell.main, "none");
        assert.equal(shell.aside, "none");
        assert.match(shell.dialog, /blur/);
        assert.equal(shell.primary, dark ? "#78b3ff" : "#5b47d6");
        assert.equal(shell.background, dark ? "#090a0d" : "#faf9f7");
        assert.equal(
          await page.locator("main > div").evaluate((el) => getComputedStyle(el).zIndex),
          "auto"
        );
        await page.locator("#fullscreen").evaluate((el) => {
          el.hidden = false;
        });
        assert.equal(
          await page.locator("#fullscreen").evaluate((el) => document.elementFromPoint(8, 8) === el),
          true
        );
        await page.locator("#fullscreen").evaluate((el) => {
          el.hidden = true;
        });
        if (process.env.OUTPUT_DIR) {
          const { mkdirSync } = require("node:fs");
          mkdirSync(process.env.OUTPUT_DIR, { recursive: true });
          await page.screenshot({
            path: `${process.env.OUTPUT_DIR}/${dark ? "dark" : "light"}-${width}.png`,
          });
        }
      }
    }
    console.log("PASS quiet paper layering: light/dark x 390/768/1440; shell stays sharp");
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
