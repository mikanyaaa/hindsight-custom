/* Run with Playwright available: node tests/custom/theme/layering-browser.cjs.
   Uses the real stylesheet and current page wrapper; no backend or credentials. */
/* eslint-disable @typescript-eslint/no-require-imports */
/* global require, process, console, document, getComputedStyle, Image */
const { chromium } = require("playwright");
const { readFileSync } = require("node:fs");
const assert = require("node:assert/strict");
const css = readFileSync(process.env.THEME_CSS || "src/custom/theme/warm-glass.css", "utf8");
const source = readFileSync("src/app/[locale]/banks/[bankId]/page.tsx", "utf8");
const [, mainClass, contentClass] = source.match(
  /<main className="([^"]+)">\s*<div className="([^"]+)"/
);
(async () => {
  const browser = await chromium.launch({
    ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
    headless: true,
    // Stable grayscale text avoids compositor-only subpixel antialiasing changes.
    args: ["--no-sandbox", "--disable-lcd-text"],
  });
  try {
    const page = await browser.newPage();
    for (const dark of [false, true]) {
      for (const width of [390, 768, 1440]) {
        await page.setViewportSize({ width, height: 900 });
        await page.setContent(`<html data-theme-layer="warm-glass" class="${dark ? "dark" : ""}">
          <style>
            * { box-sizing: border-box; }
            body { margin: 0; font: 18px Arial; color: var(--foreground); }
            header { position: relative; z-index: 40; height: 60px; background: var(--card); }
            main { height: 700px; margin: 8px; overflow-y: auto; }
            main > div { padding: 24px; }
            button, input { color: var(--foreground); background: var(--card); font: inherit; }
            #sample { padding: 20px; background: var(--card); }
            #fullscreen { position: fixed; inset: 0; z-index: 100; background: var(--card); }
          </style><style>${css}</style>
          <body><header>Header</header><main class="${mainClass}"><div class="${contentClass}">
            <section id="sample"><h1>Bank settings</h1><label>Model <input value="Readable model"></label>
            <p>Memory configuration and controls</p><button id="save">Save changes</button></section>
            <div id="fullscreen" hidden>Fullscreen graph</div>
          </div></main><div role="dialog" style="position:fixed;bottom:0;z-index:50">Readable dialog</div></body></html>`);
        const sample = page.locator("#sample");
        const actual = await sample.screenshot();
        // A uniform backdrop means blur cannot change this crop unless it is
        // incorrectly painting OVER the foreground. This caught the v1.2 regression.
        const disable = await page.addStyleTag({
          content:
            "main::before { -webkit-backdrop-filter: none !important; backdrop-filter: none !important; }",
        });
        const sharp = await sample.screenshot();
        const pixelDifference = await page.evaluate(
          async (images) => {
            const pixels = await Promise.all(
              images.map(async (src) => {
                const image = new Image();
                image.src = `data:image/png;base64,${src}`;
                await image.decode();
                const canvas = document.createElement("canvas");
                canvas.width = image.width;
                canvas.height = image.height;
                const context = canvas.getContext("2d");
                context.drawImage(image, 0, 0);
                return context.getImageData(0, 0, image.width, image.height).data;
              })
            );
            return (
              pixels[0].reduce((sum, value, i) => sum + Math.abs(value - pixels[1][i]), 0) /
              pixels[0].length
            );
          },
          [actual.toString("base64"), sharp.toString("base64")]
        );
        // Allow tiny rasterization changes when the compositor drops a filter;
        // foreground blur changes the crop substantially (verified against old CSS).
        assert.ok(
          pixelDifference < 2,
          `Blur covers content: dark=${dark}, width=${width}, difference=${pixelDifference}`
        );
        await disable.evaluate((el) => el.remove());
        assert.equal(
          await page.locator("main > div").evaluate((el) => getComputedStyle(el).zIndex),
          "auto"
        );
        await page.locator("#save").click();
        await page.locator("#fullscreen").evaluate((el) => {
          el.hidden = false;
        });
        assert.equal(
          await page
            .locator("#fullscreen")
            .evaluate((el) => document.elementFromPoint(10, 10) === el),
          true
        );
        await page.locator("#fullscreen").evaluate((el) => {
          el.hidden = true;
        });
        assert.equal(
          await page.getByRole("dialog").evaluate((el) => {
            const rect = el.getBoundingClientRect();
            return document.elementFromPoint(rect.x + 5, rect.y + 5) === el;
          }),
          true
        );
        if (process.env.OUTPUT_DIR) {
          const { mkdirSync } = require("node:fs");
          mkdirSync(process.env.OUTPUT_DIR, { recursive: true });
          await page.screenshot({
            path: `${process.env.OUTPUT_DIR}/${dark ? "dark" : "light"}-${width}.png`,
          });
        }
      }
    }
    console.log(
      "PASS warm glass layering: light/dark × 390/768/1440px; sharp text, buttons, dialogs, fullscreen"
    );
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
