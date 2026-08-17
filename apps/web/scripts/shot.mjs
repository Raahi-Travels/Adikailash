/**
 * Screenshot a local page, so design work is judged by looking rather than by
 * reading class names.
 *
 *   bun run scripts/shot.mjs /en home            1440 900
 *   bun run scripts/shot.mjs /en/status status   1440 900 full
 *   bun run scripts/shot.mjs /en home-mobile      390 844
 *
 * Written after shipping a hero whose headline was invisible. Every check that day
 * passed: the markup carried `register-dark`, the build was clean, the tests were
 * green. What was wrong was a CSS cascade layer, and nothing short of rendering the
 * page could have shown it.
 *
 * Two details that are not obvious:
 *
 * `networkidle` never fires here. The terrain canvas runs a permanent
 * requestAnimationFrame loop, so the page is never idle, and both `networkidle` and
 * Chrome's `--virtual-time-budget` hang forever waiting for it. Wait for fonts and
 * then a fixed beat instead.
 *
 * The system Chrome is used rather than a downloaded Chromium, because the terrain
 * shader needs a real GPU path and headless Chromium falls back to SwiftShader,
 * which renders it differently from what anybody will actually see.
 */

import { chromium } from "playwright-core";

const OUT =
  "/private/tmp/claude-501/-Users-harshit-Code-Raahi-Adikailash/9c30a957-2e73-4eb2-bd3d-3d720cfb97b3/scratchpad";

const [path = "/en", name = "shot", w = "1440", h = "900", mode = "", scrollTo = ""] =
  process.argv.slice(2);

const browser = await chromium.launch({
  channel: "chrome",
  args: ["--ignore-gpu-blocklist", "--enable-gpu-rasterization"],
});

try {
  const page = await browser.newPage({
    viewport: { width: Number(w), height: Number(h) },
    deviceScaleFactor: 1,
  });

  await page.goto(`http://localhost:3000${path}`, {
    waitUntil: "domcontentloaded",
    timeout: 45_000,
  });

  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(1200);

  // Scroll a section into view before shooting, so a single fold can be judged
  // without reading a five-thousand-pixel full-page capture.
  if (scrollTo) {
    // A number scrolls to that offset; anything else is treated as a selector.
    await page.evaluate((target) => {
      const asNumber = Number(target);
      if (Number.isFinite(asNumber)) {
        window.scrollTo({ top: asNumber, behavior: "instant" });
        return;
      }
      document.querySelector(target)?.scrollIntoView({ block: "start", behavior: "instant" });
    }, scrollTo);
    await page.waitForTimeout(1200);
  } else {
    await page.waitForTimeout(1300);
  }

  const file = `${OUT}/${name}.png`;
  await page.screenshot({ path: file, fullPage: mode === "full" });
  console.log(file);
} finally {
  await browser.close();
}
