"use client";

import {
  useMotionValue,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
  useVelocity,
  type MotionValue,
} from "motion/react";
import { useEffect, useState } from "react";

/**
 * ============================================================================
 * The site's physics.
 * ============================================================================
 *
 * One module, because a motion system that disagrees with itself reads as a bug
 * rather than as a style. Every spring, every curve and every capability check
 * on this site resolves here.
 *
 * **Native scroll is never hijacked, and that is not a style preference.**
 * The obvious way to get "scroll physics" is a smooth-scroll library that
 * cancels wheel and touch events and re-drives the page from a rAF loop. On a
 * desktop with a mouse wheel it feels expensive. On a phone it replaces the
 * platform's own momentum, which iOS and Android have tuned for a decade, with
 * a JavaScript approximation that fights the finger, breaks fling-to-top, and
 * loses the address-bar collapse. This audience is mostly on mid-range Android.
 * So the page scrolls exactly as the browser intends, and the springs here
 * smooth *derived* values instead: parallax offsets, glass highlights, shader
 * uniforms. The scrollbar stays honest; only what rides on it is eased.
 */

/* ---------------------------------------------------------------- curves --- */

/**
 * The curve set, matching the CSS custom properties in `globals.css` so a
 * transition written in Tailwind and one written here are the same motion.
 *
 * Exponential ease-out throughout. No bounce, no elastic: this is a site about
 * a road people drive at altitude, and overshoot reads as playful in a place
 * where playful is the wrong register.
 */
export const EASE = {
  /** UI state changes. Matches `--ease-standard`. */
  standard: [0.2, 0, 0, 1],
  /** Entrances and reveals. Matches `--ease-out-soft`. */
  out: [0.16, 1, 0.3, 1],
  /** Long ambient loops. Matches `--ease-in-out`. */
  inOut: [0.45, 0, 0.55, 1],
} as const;

/**
 * Spring presets, in the same three registers as the curves.
 *
 * `visualDuration` rather than raw stiffness: it is the time the motion *looks*
 * like it takes, which is the thing being designed, and it stays honest when
 * the travelled distance changes.
 */
export const SPRING = {
  /** Pointer-tracked things. Fast enough not to lag the finger. */
  pointer: { visualDuration: 0.22, bounce: 0 },
  /** Parallax and scroll-derived offsets. */
  drift: { visualDuration: 0.55, bounce: 0 },
  /** Big surfaces settling: sheets, bars, panels. */
  surface: { visualDuration: 0.42, bounce: 0.06 },
} as const;

/* ---------------------------------------------------------- capability --- */

/**
 * What this device can afford.
 *
 * Not a mobile check. A 2019 Android with four cores and no GPU tier is not the
 * same machine as a current iPhone even though both are "mobile", and a cheap
 * laptop on integrated graphics is closer to the phone. The signals here are the
 * ones that actually correlate with dropped frames: core count, the Network
 * Information API's own opinion of the connection, and the user's explicit
 * data-saver setting, which is a preference and not a guess.
 *
 * **`saveData` is treated as binding.** A reader who has turned data saver on
 * has told us something; loading a shader to decorate their hero is ignoring it.
 */
export type Capability = "full" | "reduced" | "static";

export function useCapability(): Capability {
  const reduce = useReducedMotion();
  // Server and first client render agree on "reduced": the conservative choice
  // renders on both, and only widens once the real device has been measured.
  // Starting at "full" would flash a shader onto a phone that cannot hold it.
  const [device, setDevice] = useState<Capability>("reduced");

  useEffect(() => {
    const nav = navigator as Navigator & {
      deviceMemory?: number;
      connection?: { saveData?: boolean; effectiveType?: string };
    };
    const conn = nav.connection;

    if (conn?.saveData) {
      setDevice("static");
      return;
    }

    const cores = navigator.hardwareConcurrency ?? 4;
    const memory = nav.deviceMemory ?? 4;
    const slowLink =
      conn?.effectiveType === "2g" || conn?.effectiveType === "slow-2g";

    if (slowLink || cores <= 4 || memory <= 2) {
      setDevice("reduced");
      return;
    }
    setDevice("full");
  }, []);

  return reduce ? "static" : device;
}

/* -------------------------------------------------------------- scroll --- */

/**
 * Scroll progress and velocity, both spring-smoothed, both safe to read every
 * frame.
 *
 * `useVelocity` over the raw progress gives a signed rate that a shader or a
 * highlight can lean into, so the page feels like it has weight without any of
 * it touching the scroll position itself. Clamped, because a fling on a long
 * page produces a velocity that would otherwise saturate whatever consumes it.
 */
export function useScrollPhysics() {
  const { scrollYProgress } = useScroll();
  const progress = useSpring(scrollYProgress, SPRING.drift);
  const rawVelocity = useVelocity(scrollYProgress);
  const velocity = useSpring(rawVelocity, SPRING.pointer);
  const lean = useTransform(velocity, [-2.5, 0, 2.5], [-1, 0, 1], {
    clamp: true,
  });
  return { progress, velocity, lean };
}

/**
 * A parallax offset in pixels, springed.
 *
 * `distance` is the total travel across the element's whole pass through the
 * viewport, so the number in the call site is the number you see, rather than a
 * multiplier whose result depends on how tall the section happens to be.
 */
export function useParallax(
  ref: React.RefObject<HTMLElement | null>,
  distance: number,
): MotionValue<number> {
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });
  return useSpring(
    useTransform(scrollYProgress, [0, 1], [distance / 2, -distance / 2]),
    SPRING.drift,
  );
}

/* ------------------------------------------------------------- pointer --- */

/**
 * Pointer position within an element, 0 to 1 on each axis, springed, and
 * centred when the pointer is elsewhere.
 *
 * **Coarse pointers are excluded rather than emulated.** A finger has no hover
 * state, so a highlight that tracks it either does nothing or sticks wherever
 * the last tap landed, which looks like a rendering fault. On touch the values
 * stay at centre and whatever consumes them gets a still, correct surface.
 */
export function usePointer(ref: React.RefObject<HTMLElement | null>) {
  const x = useMotionValue(0.5);
  const y = useMotionValue(0.5);
  const sx = useSpring(x, SPRING.pointer);
  const sy = useSpring(y, SPRING.pointer);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;

    const onMove = (event: PointerEvent) => {
      const r = node.getBoundingClientRect();
      x.set((event.clientX - r.left) / r.width);
      y.set((event.clientY - r.top) / r.height);
    };
    const onLeave = () => {
      x.set(0.5);
      y.set(0.5);
    };

    node.addEventListener("pointermove", onMove, { passive: true });
    node.addEventListener("pointerleave", onLeave, { passive: true });
    return () => {
      node.removeEventListener("pointermove", onMove);
      node.removeEventListener("pointerleave", onLeave);
    };
  }, [ref, x, y]);

  return { x: sx, y: sy };
}
