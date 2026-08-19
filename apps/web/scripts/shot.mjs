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

// `path` may be an absolute URL, so a deployed origin can be shot with the same
// tool as the dev server. SHOT_RESOLVE pins a hostname to an address for the run:
// after the domain moved to Vercel this machine kept answering with the old
// registrar's parked IPs, and a screenshot of a parking page looks enough like a
// broken deploy to send you debugging the wrong thing.
const target = /^https?:\/\//.test(path) ? path : `http://localhost:3000${path}`;
const resolve = process.env.SHOT_RESOLVE;

const browser = await chromium.launch({
  channel: "chrome",
  args: [
    "--ignore-gpu-blocklist",
    "--enable-gpu-rasterization",
    ...(resolve ? [`--host-resolver-rules=MAP ${resolve}`] : []),
  ],
});

try {
  const page = await browser.newPage({
    viewport: { width: Number(w), height: Number(h) },
    deviceScaleFactor: 1,
  });

  /*
   * `mode` doubles as a media-emulation switch, because the two settings this
   * design most needs to be checked under are the two a screenshot cannot show
   * you by accident.
   *
   *   flat    -> prefers-reduced-transparency: reduce   (the glass fallback)
   *   still   -> prefers-reduced-motion: reduce         (parallax and ken burns off)
   *
   * Playwright's `emulateMedia` does not expose reduced-transparency at all, so
   * that one goes through CDP. Both are set before navigation so a load-time
   * media query sees them.
   */
  if (mode === "flat" || mode === "still") {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Emulation.setEmulatedMedia", {
      features: [
        mode === "flat"
          ? { name: "prefers-reduced-transparency", value: "reduce" }
          : { name: "prefers-reduced-motion", value: "reduce" },
      ],
    });
  }

  await page.goto(target, {
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
