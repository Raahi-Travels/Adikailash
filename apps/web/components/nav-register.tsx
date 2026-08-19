"use client";

import { useEffect } from "react";

/**
 * The nav pill's runtime. Three jobs, no scroll handler, nothing per frame.
 *
 * **1. Register switching.** The pill is fixed and crosses both grounds. A
 * dark-tinted glass pill travelling over the cream `/journeys` page renders as a
 * dead grey slab: `backdrop-filter` samples what is behind it, and a navy tint over
 * cream is mud. So the pill reads which register is currently underneath it and
 * wears that one.
 *
 * Every section that wants to claim the pill carries `data-register-mark="dark"` or
 * `data-register-mark="light"` beside the register class it already has. One
 * `IntersectionObserver` watches them through a one-pixel band pinned just below the
 * pill; whichever marked section is crossing that band wins. Default, when nothing
 * is marked: `register-dark`, which is what the pill is server-rendered with, so
 * there is no flash.
 *
 * **2. Rest and lifted.** On a page with a full-bleed hero (`data-hero-page` on its
 * `<main>`) the pill starts almost invisible and the top scrim carries legibility;
 * past 24px of scroll it becomes full glass. Everywhere else it is lifted from the
 * start. Switched by a second observer on a 24px sentinel rather than by listening
 * to scroll, because a scroll listener on a `backdrop-filter` element is how this
 * effect gets its reputation.
 *
 * **3. Chrome offset.** While the staging notice exists it occupies real space above
 * the pill, and the pill is fixed, so it would sit on top of the warning. Its height
 * is measured once and published as `--chrome-top`, which both the header's own
 * `top` and the page-clearance rule in `globals.css` read. A `ResizeObserver` keeps
 * it right when the notice wraps to two lines on a phone. When the notice is gone
 * (the day `NEXT_PUBLIC_SITE_URL` is set) this measures nothing and the variable
 * stays at its 0px default.
 */
export function NavRegister() {
  useEffect(() => {
    const root = document.documentElement;
    const pill = document.querySelector<HTMLElement>("[data-nav-pill]");
    if (!pill) return;

    const scrim = document.querySelector<HTMLElement>("[data-nav-scrim]");
    const cleanups: Array<() => void> = [];

    /* ---- 3. chrome offset ------------------------------------------------ */
    const notice = document.querySelector<HTMLElement>("[data-staging-notice]");
    if (notice) {
      const sync = () =>
        root.style.setProperty("--chrome-top", `${Math.round(notice.offsetHeight)}px`);
      sync();
      const ro = new ResizeObserver(sync);
      ro.observe(notice);
      cleanups.push(() => {
        ro.disconnect();
        root.style.removeProperty("--chrome-top");
      });
    }

    /* ---- 2. rest / lifted ------------------------------------------------ */
    const setState = (state: "rest" | "lifted") => {
      pill.setAttribute("data-nav-state", state);
      scrim?.setAttribute("data-nav-state", state);
    };

    const sentinel = document.querySelector("[data-nav-sentinel]");
    const heroPage = document.querySelector("[data-hero-page]");

    if (sentinel && heroPage) {
      setState("rest");
      const io = new IntersectionObserver(
        ([entry]) => setState(entry.isIntersecting ? "rest" : "lifted"),
        { threshold: 0 },
      );
      io.observe(sentinel);
      cleanups.push(() => io.disconnect());
    } else {
      setState("lifted");
    }

    /* ---- 1. register switching ------------------------------------------ */
    /**
     * `data-register-mark` is the explicit signal, and the register class is the
     * fallback. Both are observed, because a page that has not been given marks
     * yet should still hand the pill the right ground rather than leaving it navy
     * over cream: a dark-tinted glass pill on the light register renders as a dead
     * grey slab, and that is a rendering fault a reader sees before they see
     * anything else on the page.
     */
    const marked = Array.from(
      document.querySelectorAll(
        "[data-register-mark], main.register-dark, main.register-light, main > .register-dark, main > .register-light",
      ),
    );

    if (marked.length > 0) {
      let io: IntersectionObserver | undefined;

      const registerOf = (el: Element) =>
        el.getAttribute("data-register-mark") ??
        (el.classList.contains("register-light") ? "light" : "dark");

      const wear = (next: string) => {
        pill.classList.toggle("register-dark", next !== "light");
        pill.classList.toggle("register-light", next === "light");
      };

      /**
       * The band.
       *
       * `rootMargin: "-72px 0px -100% 0px"` is the version of this trick that gets
       * copied around, and it does not work: the bottom inset of 100% collapses the
       * root box to zero or negative height and nothing ever intersects. The insets
       * have to be computed against the real viewport so the band is genuinely one
       * pixel tall, sitting just under the pill.
       */
      const build = () => {
        io?.disconnect();
        const probe = Math.round(
          (Number.parseFloat(getComputedStyle(root).getPropertyValue("--chrome-top")) || 0) +
            pill.getBoundingClientRect().height +
            28,
        );
        const bottom = Math.max(0, window.innerHeight - probe - 1);

        io = new IntersectionObserver(
          (entries) => {
            for (const entry of entries) {
              if (!entry.isIntersecting) continue;
              wear(registerOf(entry.target));
            }
          },
          { rootMargin: `-${probe}px 0px -${bottom}px 0px`, threshold: 0 },
        );
        for (const el of marked) io.observe(el);
      };

      build();
      const onResize = () => build();
      window.addEventListener("resize", onResize, { passive: true });
      cleanups.push(() => {
        io?.disconnect();
        window.removeEventListener("resize", onResize);
      });
    }

    return () => {
      for (const done of cleanups) done();
    };
  }, []);

  return null;
}
