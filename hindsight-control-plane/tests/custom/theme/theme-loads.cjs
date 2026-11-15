/**
 * Local browser check: the custom theme stylesheet applies and the page
 * renders without console errors. Run with `npm run test:browser`.
 */
/* eslint-disable @typescript-eslint/no-require-imports */
/* global require, process, console, __dirname */
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const { chromium } = require("playwright");

async function main() {
  const css = readFileSync(join(__dirname, "../../../src/custom/theme/warm-glass.css"), "utf8");
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  const html = `<!doctype html>
<html data-theme-layer="warm-glass">
  <head><style>${css}</style></head>
  <body><main>Hindsight</main></body>
</html>`;
  await page.setContent(html);
  await page.getByRole("main").waitFor();
  const background = await page.evaluate(
    "getComputedStyle(document.documentElement).getPropertyValue('--background').trim()"
  );
  await browser.close();
  if (background !== "#f3ede6") errors.push(`theme variable was ${background || "empty"}`);
  if (errors.length) {
    console.error(errors.join("\n"));
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "browser check failed");
  process.exit(1);
});
