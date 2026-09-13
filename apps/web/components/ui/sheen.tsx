"use client";

import { motion, useMotionTemplate, useTransform } from "motion/react";
import { useEffect, useRef, useState } from "react";

import { useCapability, usePointer, useScrollPhysics } from "@/lib/motion";

/**
 * The specular highlight, on its own, so any glass surface can wear one.
 *
 * `LiquidGlass` owns a whole surface. This does not: it is a single absolutely
 * positioned span that finds its own container and lights it. That matters for
 * the nav pill, which is server-rendered inside `site-chrome.tsx` and should
 * stay that way; dropping this inside it costs one small client island rather
 * than turning the site header into a client component.
 *
 * **It tracks its parent, not a ref passed in.** The span reads
 * `parentElement` on mount, so a caller drops it in and nothing else has to
 * change: no ref plumbing, no wrapper, no layout effect on the host. The host
 * only has to be positioned, which every glass surface here already is.
 *
 * Gated exactly like everything else in `lib/motion.ts`: nothing mounts on
 * reduced-motion, on data saver, or on four cores or fewer, and the pointer is
 * ignored entirely on coarse input because a finger has no hover state.
 */
export function Sheen({
  /** How far the highlight travels across the face, as a fraction of width. */
  travel = 0.34,
  /** Peak alpha. A pill wants less than a panel: it is smaller and always on screen. */
  intensity = 0.22,
  className = "",
}: {
  travel?: number;
  intensity?: number;
  className?: string;
}) {
  const self = useRef<HTMLSpanElement>(null);
  const host = useRef<HTMLElement | null>(null);
  const [ready, setReady] = useState(false);
  const capability = useCapability();

  useEffect(() => {
    host.current = self.current?.parentElement ?? null;
    // A state flip rather than reading the ref during render: the pointer hook
    // subscribes on mount, and on the first pass the parent is not known yet.
    if (host.current) setReady(true);
  }, []);

  const { x, y } = usePointer(host);
  const { lean } = useScrollPhysics();

  const px = useTransform(
    [x, lean] as const,
    ([p, l]: number[]) => 50 + (p - 0.5) * travel * 100 + l * 6,
  );
  const py = useTransform(
    [y, lean] as const,
    ([p, l]: number[]) => 38 + (p - 0.5) * travel * 70 - l * 10,
  );
  const image = useMotionTemplate`radial-gradient(120% 90% at ${px}% ${py}%, oklch(1 0 0 / ${intensity}), oklch(1 0 0 / ${intensity * 0.27}) 38%, transparent 68%)`;

  if (capability !== "full") return <span ref={self} hidden />;

  return (
    <motion.span
      ref={self}
      aria-hidden
      className={`pointer-events-none absolute inset-0 rounded-[inherit] mix-blend-plus-lighter ${className}`}
      style={ready ? { backgroundImage: image } : undefined}
    />
  );
}
