/**
 * The two accessibility numbers a screenshot cannot give you.
 *
 *   node scripts/audit-a11y.mjs                  # both checks, every page, four widths
 *   node scripts/audit-a11y.mjs contrast /en     # one check, one page
 *   node scripts/audit-a11y.mjs focus /en 390
 *
 * It prints only failures. Silence is a pass.
 *
 *   1. **Text contrast, composited.** Walks every text node, then screenshots the
 *      page with glyphs made transparent and samples the pixels under each line
 *      box. That is the only way to get a true number over a gradient, a
 *      photograph, or a `backdrop-filter` panel, where reading the CSS tells you
 *      nothing about what the reader is actually looking at.
 *
 *   2. **Focus indicator contrast**, WCAG 1.4.11's 3:1. Screenshots each tab stop
 *      focused, then again with `outline` suppressed. The pixels that differ ARE
 *      the indicator, and the same pixels in the second frame are what it has to
 *      contrast with. This is what caught a gold focus ring measuring 2.37:1 on
 *      cream across half the site.
 *
 * ---------------------------------------------------------------------------
 * Four things that make this hard, all of which produced confident wrong answers
 * before they were fixed. Do not simplify them back out.
 * ---------------------------------------------------------------------------
 *
 * 1. **No `fullPage` screenshots.** `captureBeyondViewport` re-resolves `100vh`
 *    and `100svh` against the full document height, so every hero grows and every
 *    rect below the first fold lands on the wrong pixels. This walks the page one
 *    viewport at a time instead.
 *
 * 2. **Only fully visible text is measured.** A line box with three pixels showing
 *    at the edge of the viewport gets sampled at a register boundary and reports a
 *    1.2:1 failure on text that is fine.
 *
 * 3. **`prefers-reduced-motion` is emulated.** `.reveal` is a scroll-driven
 *    animation, and `animation-play-state: paused` does not stop one: it is
 *    progress-mapped, not time-mapped. Without this, elements near the viewport
 *    edge are sampled mid-entrance at 0.4 opacity and report as failures.
 *
 * 4. **Text under fixed chrome is skipped.** Flow content passing beneath the nav
 *    pill and its 60px drop shadow is occluded by design; measuring the shadowed
 *    gold under it reports a defect that does not exist.
 */

import { chromium } from "playwright-core";

const PAGES = [
  "/en", "/en/journeys", "/en/journeys/adi-kailash-om-parvat", "/en/plan", "/en/status",
  "/en/guides", "/en/guides/inner-line-permit", "/en/policies", "/en/policies/terms",
  "/en/departures", "/en/enquire", "/en/private", "/en/partners", "/en/trip", "/en/feedback",
  "/hi", "/hi/journeys", "/hi/journeys/adi-kailash-om-parvat", "/hi/plan", "/hi/status",
  "/hi/guides", "/hi/guides/inner-line-permit", "/hi/enquire", "/hi/departures", "/hi/policies",
];

const CHECK = ["contrast", "focus"].includes(process.argv[2]) ? process.argv[2] : null;
const ONE = process.argv[3] || (CHECK ? null : process.argv[2]);
const ONE_W = Number(process.argv[4]) || null;

const paths = ONE ? [ONE] : PAGES;
const widths = ONE_W ? [ONE_W] : [1440, 1024, 768, 390];
const checks = CHECK ? [CHECK] : ["contrast", "focus"];

const srgb = (c) => (c /= 255) <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
const lum = (r, g, b) => 0.2126 * srgb(r) + 0.7152 * srgb(g) + 0.0722 * srgb(b);
const ratio = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
function parseColor(s) {
  const m = String(s).match(/rgba?\(([^)]+)\)/);
  if (!m) return null;
  const p = m[1].split(/[,\s/]+/).filter(Boolean).map(Number);
  return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
}

/* Hide the dev overlay: its badge floats over page content and is sampled as a
   dark blob under whatever text it happens to cover. */
const KILL_DEV = () => {
  const s = document.createElement("style");
  s.textContent = "nextjs-portal,[data-nextjs-toast],#__next-build-watcher{display:none!important}";
  document.addEventListener("DOMContentLoaded", () => document.head.appendChild(s));
};

const OFFSETS = () => {
  const vh = innerHeight, H = document.documentElement.scrollHeight, out = [];
  for (let y = 0; y < H - vh * 0.4; y += Math.round(vh * 0.85)) out.push(y);
  out.push(Math.max(0, H - vh));
  return [...new Set(out)];
};

const COLLECT_AT = () => {
  const vh = innerHeight, vw = innerWidth, out = [];
  const occluders = [];
  for (const el of document.querySelectorAll("*")) {
    const cs = getComputedStyle(el);
    if (cs.position !== "fixed" && cs.position !== "sticky") continue;
    if (cs.visibility === "hidden" || cs.display === "none") continue;
    const r = el.getBoundingClientRect();
    if (r.width < 4 || r.height < 4) continue;
    occluders.push({ x: r.x - 60, y: r.y - 60, r: r.right + 60, b: r.bottom + 60 });
  }
  const occluded = (r) => occluders.some((o) => r.left < o.r && r.right > o.x && r.top < o.b && r.bottom > o.y);

  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let n;
  while ((n = walker.nextNode())) {
    if (!n.nodeValue || !n.nodeValue.trim()) continue;
    const el = n.parentElement;
    if (!el || ["SCRIPT", "STYLE", "NOSCRIPT", "TITLE"].includes(el.tagName)) continue;
    const cs = getComputedStyle(el);
    if (cs.display === "none" || cs.visibility === "hidden" || parseFloat(cs.opacity) < 0.05) continue;
    if (cs.clipPath === "inset(50%)") continue;
    let hidden = false;
    for (let p = el; p && p !== document.body; p = p.parentElement) {
      const pc = getComputedStyle(p);
      if (pc.clipPath === "inset(50%)" || (pc.position === "absolute" && parseFloat(pc.width) <= 1)) { hidden = true; break; }
    }
    if (hidden) continue;

    let fixed = false;
    for (let p = el; p && p !== document.documentElement; p = p.parentElement) {
      const pos = getComputedStyle(p).position;
      if (pos === "fixed" || pos === "sticky") { fixed = true; break; }
    }

    const range = document.createRange();
    range.selectNodeContents(n);
    const rects = [...range.getClientRects()]
      .filter((r) => r.width > 1 && r.height > 1 && r.top >= 6 && r.bottom <= vh - 6 && r.left >= 0 && r.right <= vw)
      .filter((r) => fixed || !occluded(r));
    if (!rects.length) continue;

    const fs = parseFloat(cs.fontSize);
    let fw = cs.fontWeight;
    fw = fw === "bold" ? 700 : fw === "normal" ? 400 : parseInt(fw, 10) || 400;
    out.push({
      tag: el.tagName, fs, fw, color: cs.color,
      cls: (typeof el.className === "string" ? el.className : "").slice(0, 120),
      text: n.nodeValue.trim().slice(0, 48),
      rects: rects.map((r) => ({ x: Math.max(0, r.x), y: Math.max(0, r.y), w: r.width, h: r.height })),
    });
  }
  return out;
};

const HIDE_TEXT = `
*,*::before,*::after{color:transparent!important;-webkit-text-fill-color:transparent!important;
 text-shadow:none!important;text-decoration-color:transparent!important;caret-color:transparent!important}
input::placeholder,textarea::placeholder{color:transparent!important;-webkit-text-fill-color:transparent!important}`;

/** Decode a screenshot in the page and sample the given rects. */
const SAMPLE = ([shot, items]) => new Promise((res) => {
  const img = new Image();
  img.onload = () => {
    const cv = document.createElement("canvas");
    cv.width = img.naturalWidth; cv.height = img.naturalHeight;
    const ctx = cv.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(img, 0, 0);
    res(items.map((it) => {
      const px = [];
      for (const r of it.rects) {
        const x0 = Math.max(0, Math.round(r.x)), y0 = Math.max(0, Math.round(r.y));
        const w = Math.min(Math.round(r.w), cv.width - x0), h = Math.min(Math.round(r.h), cv.height - y0);
        if (w <= 0 || h <= 0) continue;
        const d = ctx.getImageData(x0, y0, w, h).data;
        const step = Math.max(1, Math.floor((w * h) / 3000)) * 4;
        for (let k = 0; k < d.length; k += step) px.push([d[k], d[k + 1], d[k + 2]]);
      }
      return px;
    }));
  };
  img.onerror = () => res(items.map(() => []));
  img.src = "data:image/png;base64," + shot;
});

const DIFF = ([a, b]) => new Promise((res) => {
  const load = (s) => new Promise((r) => { const i = new Image(); i.onload = () => r(i); i.src = "data:image/png;base64," + s; });
  Promise.all([load(a), load(b)]).then(([ia, ib]) => {
    if (ia.naturalWidth !== ib.naturalWidth || ia.naturalHeight !== ib.naturalHeight) return res(null);
    const mk = (im) => { const c = document.createElement("canvas"); c.width = im.naturalWidth; c.height = im.naturalHeight;
      const x = c.getContext("2d", { willReadFrequently: true }); x.drawImage(im, 0, 0);
      return x.getImageData(0, 0, c.width, c.height).data; };
    const A = mk(ia), B = mk(ib), on = [], off = [];
    for (let k = 0; k < A.length; k += 4) {
      if (Math.abs(A[k] - B[k]) + Math.abs(A[k+1] - B[k+1]) + Math.abs(A[k+2] - B[k+2]) > 40) {
        on.push([A[k], A[k+1], A[k+2]]); off.push([B[k], B[k+1], B[k+2]]);
      }
    }
    res({ on, off });
  });
});

const browser = await chromium.launch({
  channel: "chrome",
  args: ["--ignore-gpu-blocklist", "--enable-gpu-rasterization", "--force-device-scale-factor=1"],
});
let failures = 0;
const report = (head, lines) => { failures += lines.length; console.log(`\n${head}`); for (const l of lines) console.log(`   ${l}`); };

const open = async (width) => {
  const page = await browser.newPage({ viewport: { width, height: 900 }, deviceScaleFactor: 1 });
  await page.addInitScript(KILL_DEV);
  await page.emulateMedia({ reducedMotion: "reduce" });
  return page;
};
const settle = async (page, path) => {
  await page.goto("http://localhost:3000" + path, { waitUntil: "domcontentloaded", timeout: 45_000 });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(1200);
  await page.evaluate(async () => {
    const H = document.documentElement.scrollHeight;
    for (let y = 0; y < H; y += 600) { scrollTo(0, y); await new Promise((r) => setTimeout(r, 30)); }
    scrollTo(0, 0);
  });
  await page.waitForTimeout(700);
};

for (const width of widths) {
  for (const path of paths) {
    if (checks.includes("contrast")) {
      const page = await open(width);
      try {
        await settle(page, path);
        const offsets = await page.evaluate(OFFSETS);
        const recs = [];
        for (const y of offsets) {
          await page.evaluate((yy) => scrollTo({ top: yy, behavior: "instant" }), y);
          await page.waitForTimeout(240);
          recs.push({ y, items: await page.evaluate(COLLECT_AT) });
        }
        await page.addStyleTag({ content: HIDE_TEXT });
        await page.waitForTimeout(350);
        for (const rec of recs) {
          await page.evaluate((yy) => scrollTo({ top: yy, behavior: "instant" }), rec.y);
          await page.waitForTimeout(220);
          const shot = (await page.screenshot()).toString("base64");
          const sampled = await page.evaluate(SAMPLE, [shot, rec.items]);
          rec.items.forEach((it, k) => { it.px = sampled[k]; });
        }
        const bad = [], seen = new Set();
        for (const rec of recs) for (const it of rec.items) {
          if (!it.px?.length) continue;
          const fg = parseColor(it.color);
          if (!fg) continue;
          const fgL = lum(fg.r, fg.g, fg.b);
          const sorted = it.px.slice().sort((a, b) => lum(...a) - lum(...b));
          const at = (q) => sorted[Math.min(sorted.length - 1, Math.max(0, Math.floor(q * (sorted.length - 1))))];
          const lo = at(0.03), hi = at(0.97);
          const useLo = Math.abs(lum(...lo) - fgL) < Math.abs(lum(...hi) - fgL);
          const bp = useLo ? lo : hi, bgL = lum(...bp);
          const eff = fg.a < 1
            ? lum(fg.r * fg.a + bp[0] * (1 - fg.a), fg.g * fg.a + bp[1] * (1 - fg.a), fg.b * fg.a + bp[2] * (1 - fg.a))
            : fgL;
          const cr = ratio(eff, bgL);
          const need = it.fs >= 24 || (it.fs >= 18.66 && it.fw >= 700) ? 3 : 4.5;
          const key = `${it.cls}|${it.color}|${it.fs}|${it.text}`;
          if (cr >= need || seen.has(key)) continue;
          seen.add(key);
          bad.push(`${cr.toFixed(2)}:1 (needs ${need}) ${it.fs}px "${it.text.slice(0, 34)}" — ${it.cls.slice(0, 60)}`);
        }
        if (bad.length) report(`${width}px  ${path}  contrast`, bad.slice(0, 8));
      } catch (e) { report(`${width}px  ${path}  contrast`, [`error: ${String(e).slice(0, 140)}`]); }
      await page.close();
    }

    if (checks.includes("focus")) {
      const page = await open(width);
      try {
        await settle(page, path);
        const bad = [];
        for (let n = 1; n <= 20; n++) {
          await page.keyboard.press("Tab");
          await page.waitForTimeout(80);
          const info = await page.evaluate(() => {
            const a = document.activeElement;
            if (!a || a === document.body) return null;
            a.scrollIntoView({ block: "center", behavior: "instant" });
            const r = a.getBoundingClientRect();
            return { w: r.width, h: r.height, tag: a.tagName,
                     text: (a.getAttribute("aria-label") || a.textContent || "").trim().slice(0, 32) };
          });
          if (!info) break;
          if (info.w < 4 || info.h < 4) continue;
          await page.waitForTimeout(140);
          const on = (await page.screenshot()).toString("base64");
          await page.evaluate(() => {
            const st = document.createElement("style");
            st.id = "__ring_off";
            st.textContent = "*,*::before,*::after{outline:none !important}";
            document.head.appendChild(st);
          });
          await page.waitForTimeout(130);
          const off = (await page.screenshot()).toString("base64");
          await page.evaluate(() => document.getElementById("__ring_off")?.remove());
          await page.waitForTimeout(60);
          const d = await page.evaluate(DIFF, [on, off]);
          if (!d || d.on.length < 8) continue; // no outline drawn, or none visible here
          const rl = d.on.map((c) => lum(...c)).sort((a, b) => a - b);
          const bl = d.off.map((c) => lum(...c)).sort((a, b) => a - b);
          const mid = (v) => v[Math.floor(v.length / 2)];
          const cr = ratio(mid(rl), mid(bl));
          if (cr < 3) bad.push(`focus ring ${cr.toFixed(2)}:1 (needs 3) on ${info.tag} "${info.text}"`);
        }
        if (bad.length) report(`${width}px  ${path}  focus`, bad.slice(0, 6));
      } catch (e) { report(`${width}px  ${path}  focus`, [`error: ${String(e).slice(0, 140)}`]); }
      await page.close();
    }
  }
}

await browser.close();
console.log(failures ? `\n${failures} findings.` : "\nClean: every text run and every focus ring clears its WCAG floor.");
process.exit(failures ? 1 : 0);
