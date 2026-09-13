"use client";

import { motion, useMotionTemplate, useTransform } from "motion/react";
import { useRef, type ReactNode } from "react";

import { useCapability, usePointer, useScrollPhysics } from "@/lib/motion";

/**
 * Glass that behaves like a material rather than a colour.
 *
 * Real glass does two things a CSS tint does not: it carries a specular
 * highlight that moves when you move, and its edge catches light at a different
 * angle from its face. Both are cheap to fake and neither needs a second
 * `backdrop-filter`, which matters because this site budgets three of those on
 * screen at once and the nav pill permanently holds one.
 *
 * So the highlight here is a **radial gradient on an ordinary element**, moved by
 * a spring. It composites on the GPU, adds no filter, and costs nothing against
 * the blur budget. The edge light is a second gradient at low alpha on the ring.
 *
 * **It leans with the page.** `useScrollPhysics` exposes a signed, clamped
 * velocity, so a fast scroll tips the highlight against the direction of travel
 * the way a held pane of glass would. That is the whole trick: nothing here
 * moves the panel, only the light on it, so no layout is touched and no scroll
 * is intercepted.
 *
 * **On a phone it is still.** `usePointer` ignores coarse pointers, because a
 * finger has no hover state and a highlight tracking it would stick wherever the
 * last tap landed. The panel keeps its static sheen there, which is what the
 * `glass` utility already draws.
 *
 * On `static` capability, which covers both `prefers-reduced-motion` and a
 * reader with data saver on, this renders exactly the plain glass surface and
 * mounts no listeners at all.
 */
export function LiquidGlass({
  children,
  className = "",
  rim = false,
  label,
  /** How far the highlight travels across the face, as a fraction of its width. */
  travel = 0.34,
}: {
  children: ReactNode;
  className?: string;
  rim?: boolean;
  label?: string;
  travel?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const capability = useCapability();
  const { x, y } = usePointer(ref);
  const { lean } = useScrollPhysics();

  const alive = capability === "full";

  /*
    Percentages, so the gradient centre follows the pointer without the element
    needing to know its own size.

    `useMotionTemplate` and not a `useTransform` that returns a string. The first
    attempt built the two coordinates as string-valued transforms and then fed
    those into a third transform to assemble the gradient. It type-checked, it
    rendered, and it never moved: measured at both ends of the panel the centre
    read 65.3% both times. Interpolating motion values into a template is the
    supported path for composing a CSS string out of them, and it is one
    subscription instead of three chained ones.
  */
  const px = useTransform(
    [x, lean] as const,
    ([p, l]: number[]) => 50 + (p - 0.5) * travel * 100 + l * 6,
  );
  const py = useTransform(
    [y, lean] as const,
    ([p, l]: number[]) => 38 + (p - 0.5) * travel * 70 - l * 10,
  );
  const highlight = useMotionTemplate`radial-gradient(120% 90% at ${px}% ${py}%, oklch(1 0 0 / 0.22), oklch(1 0 0 / 0.06) 38%, transparent 68%)`;

  const classes = `glass relative isolate rounded-frame ${rim ? "rim-gold" : ""} ${className}`;
  const Tag = label ? motion.section : motion.div;

  return (
    <Tag ref={ref} aria-label={label} className={classes}>
      {alive && (
        <motion.span
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 rounded-[inherit] mix-blend-plus-lighter"
          style={{ backgroundImage: highlight }}
        />
      )}
      {children}
    </Tag>
  );
}
