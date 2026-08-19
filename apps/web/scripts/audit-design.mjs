/**
 * The four checks a screenshot cannot show you.
 *
 *   node scripts/audit-design.mjs            # every page, both widths
 *   node scripts/audit-design.mjs /en/plan   # one page
 *
 * Every failure found while building the design system was invisible to the eye:
 * a mask utility that compiled but was never generated, a body measure of 149ch
 * that looked fine at a glance, a nav pill whose composited contrast over the
 * brightest part of the hero was under the floor. This is what catches them.
 *
 * It prints only failures. Silence is a pass.
 *
 *   1. Horizontal page scroll. Anything over 0 is a bug, usually `100vw` or a
 *      negative inset on a parent that is not `overflow-hidden`. Fixed chrome
 *      is checked separately, because it overflows the screen without ever
 *      making the page scroll.
 *   2. The glass budget: at most three `backdrop-filter` elements on screen.
 *      Each one costs a compositor layer holding a backdrop snapshot at device
 *      pixel ratio, and the nav pill is always one of the three.
 *   3. The 15px floor. Nothing on this site renders below 15px, including the
 *      footer disclaimer and the staging notice.
 *   4. Measure. No text run over 72ch: the audit found 110ch to 149ch lines on
 *      `/status`, `/guides`, `/policies` and in the footer.
 */

import { chromium } from "playwright-core";

const ONE = process.argv[2];
const PATHS = ONE
  ? [ONE]
  : [
      "/en", "/en/journeys", "/en/plan", "/en/status", "/en/guides",
      "/en/policies", "/en/departures", "/en/enquire",
      "/hi", "/hi/journeys", "/hi/plan", "/hi/status",
    ];

const browser = await chromium.launch({ channel: "chrome" });
let failures = 0;

/**
 * Four widths, not two.
 *
 * 1440 and 390 alone missed a real bug for as long as it existed: between 768 and
 * about 890 the nav pill turned its five inline links on before it had room for
 * them, and pushed the call to action and the menu button off the right of the
 * screen, 104px past the viewport in English. Both original widths were clean.
 * 768 is iPad portrait and 1024 is iPad landscape, and both are where a layout
 * that only ever gets checked at phone and desktop tends to come apart.
 */
for (const width of [1440, 1024, 768, 390]) {
  const page = await browser.newPage({ viewport: { width, height: 900 } });

  for (const path of PATHS) {
    await page.goto("http://localhost:3000" + path, { waitUntil: "domcontentloaded" });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(900);

    const found = await page.evaluate(() => {
      const problems = [];
      const doc = document.documentElement;

      const overflow = doc.scrollWidth - doc.clientWidth;
      if (overflow > 0) problems.push(`horizontal scroll: ${overflow}px`);

      /**
       * Fixed chrome that has left the screen.
       *
       * `position: fixed` content cannot make the page scroll, so a control that
       * overflows the viewport inside the nav pill is invisible to the check
       * above: the page stays exactly as wide as the window while the button you
       * need is 100px past the edge of it. This is the check that would have
       * caught the `md:` nav breakpoint, and it is separate for that reason.
       */
      for (const el of document.querySelectorAll("[data-nav-pill], [data-site-chrome]")) {
        for (const c of el.querySelectorAll("a, button")) {
          const r = c.getBoundingClientRect();
          if (r.width === 0 || r.height === 0) continue;
          if (r.right > innerWidth + 0.5 || r.left < -0.5) {
            const label = (c.getAttribute("aria-label") || c.textContent || "").trim().slice(0, 24);
            problems.push(
              `fixed control off screen by ${Math.round(Math.max(r.right - innerWidth, -r.left))}px: "${label}"`,
            );
          }
        }
        if (el.scrollWidth > el.clientWidth + 1)
          problems.push(`nav pill content overflows by ${el.scrollWidth - el.clientWidth}px`);
      }

      const onScreen = [...document.querySelectorAll("*")].filter((el) => {
        const s = getComputedStyle(el);
        if (s.backdropFilter === "none" || !s.backdropFilter) return false;
        const r = el.getBoundingClientRect();
        return r.bottom > 0 && r.top < innerHeight && r.width > 0;
      });
      if (onScreen.length > 3) problems.push(`${onScreen.length} glass elements on screen (budget 3)`);

      const name = (el) => `${el.tagName.toLowerCase()}.${String(el.className).slice(0, 46)}`;

      /**
       * The width of one `ch` in the element's own font, measured rather than
       * assumed. The obvious shortcut is `fontSize * 0.5`, and it reports the
       * footer disclaimer at 84ch when its cap is 72ch: `ch` is the advance of
       * the digit zero, and Mukta's zero is 0.43em, not 0.5em. A measure check
       * that cries wolf on correct code is a check people switch off.
       */
      const probe = document.createElement("span");
      probe.style.cssText = "position:absolute;visibility:hidden;width:1ch";
      document.body.append(probe);
      const chCache = new Map();
      const chWidth = (font) => {
        if (!chCache.has(font)) {
          probe.style.font = font;
          chCache.set(font, probe.getBoundingClientRect().width || 1);
        }
        return chCache.get(font);
      };

      for (const el of document.querySelectorAll("body *")) {
        const hasOwnText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
        if (!hasOwnText) continue;
        const s = getComputedStyle(el);
        if (s.display === "none" || s.visibility === "hidden") continue;
        const box = el.getBoundingClientRect();
        if (box.width === 0 || box.height === 0) continue;
        if (el.closest(".sr-only")) continue;

        const size = parseFloat(s.fontSize);
        if (size < 15) problems.push(`${size}px text: ${name(el)}`);

        const ch = box.width / chWidth(s.font || `${s.fontWeight} ${s.fontSize}/${s.lineHeight} ${s.fontFamily}`);
        // 73 rather than 72: an element capped at exactly `72ch` measures 72.0
        // to 72.4 depending on subpixel layout, and flagging the cap itself is
        // how a check earns a reputation for noise.
        if (ch > 73 && el.textContent.trim().length > 90)
          problems.push(`${Math.round(ch)}ch measure: ${name(el)}`);
      }
      probe.remove();
      return [...new Set(problems)];
    });

    if (found.length) {
      failures += found.length;
      console.log(`\n${width}px  ${path}`);
      for (const f of found.slice(0, 8)) console.log(`   ${f}`);
      if (found.length > 8) console.log(`   ... and ${found.length - 8} more`);
    }
  }
  await page.close();
}

await browser.close();
console.log(failures ? `\n${failures} findings.` : "\nClean: no overflow, no glass over budget, nothing under 15px, nothing over 72ch.");
process.exit(failures ? 1 : 0);
