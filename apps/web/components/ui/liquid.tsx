"use client";

import { motion } from "motion/react";
import type { ReactNode } from "react";

import { Sheen } from "@/components/ui/sheen";

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
 *
 * The highlight itself now lives in `Sheen`, because the nav pill wanted the
 * same light without becoming a client component. One implementation, two hosts.
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
  const classes = `glass relative isolate rounded-frame ${rim ? "rim-gold" : ""} ${className}`;
  const Tag = label ? motion.section : motion.div;

  return (
    <Tag aria-label={label} className={classes}>
      <Sheen travel={travel} />
      {children}
    </Tag>
  );
}
