import type { ReactNode } from "react";

/**
 * A panel.
 *
 * The difference between a div with a background and a panel is an inner
 * highlight plus a hairline ring: the founder said "no borders", and an inset
 * lit top edge with a ring at 0.12 to 0.14 alpha gives an edge without drawing
 * one. Measured on midnight, white at 0.05 alpha is a 1.14:1 step and at 0.12 it
 * is 1.42:1; above 0.20 on the ring it stops being an edge and becomes a border,
 * and he will say so.
 *
 * **Never add a `ring-1` or a `border` to this.** You get a 2px double edge at
 * some zoom levels. And never nest one inside another: inset shadows paint above
 * the background but below content, so a child with an opaque background covers
 * its parent's inner edge, which is why the nested-card pattern always looks
 * slightly wrong and never obviously wrong.
 *
 * Elevation: `lift-2` on the light register, where a shadow reads; on the dark
 * register the shadow does almost nothing and the inner highlight carries it.
 *
 * ```tsx
 * <Surface className="p-6 sm:p-8">
 *   <h2 className="type-title-2">Nothing verified yet</h2>
 *   <p className="type-body mt-3">…</p>
 * </Surface>
 * ```
 */
export function Surface({
  children,
  className = "",
  radius = "action",
  as: Tag = "div",
}: {
  children: ReactNode;
  className?: string;
  /** `frame` for anything holding media, `action` for everything else. */
  radius?: "action" | "frame";
  as?: "div" | "section" | "article" | "aside" | "li";
}) {
  return (
    <Tag
      className={`surface ${radius === "frame" ? "rounded-frame" : "rounded-action"} ${className}`}
    >
      {children}
    </Tag>
  );
}

/**
 * The one other sanctioned glass panel.
 *
 * **Glass is allowed in exactly three places on this site:** the nav pill, a panel
 * that genuinely floats over a photograph (the hero status instrument), and a
 * single caption or status chip sitting directly on a photograph. Not on cards in
 * a list, not on form fields, not on the footer, not on a panel over a flat
 * ground. Glass is legibility over imagery; anywhere else it is decoration, and
 * decoration that costs a compositor layer holding a full backdrop snapshot at
 * device pixel ratio.
 *
 * **It must be a sibling of the media, never a child.** `backdrop-filter` samples
 * what is painted behind it, and a masked or blended wrapper above it in the
 * stacking context is not sampled, so glass placed inside an `isolate` media
 * wrapper blurs nothing at all and renders as a flat tint. That failure looks like
 * a taste problem and is actually a stacking one.
 *
 * Budget: at most three `backdrop-filter` elements on screen at once, and the nav
 * pill is always one of them.
 */
export function GlassPanel({
  children,
  className = "",
  rim = false,
  label,
}: {
  children: ReactNode;
  className?: string;
  /** One lit gold edge. Reserve it for the single most important panel on a page. */
  rim?: boolean;
  /** Renders as a labelled `<section>` when given, which is what a floating instrument wants. */
  label?: string;
}) {
  const classes = `glass rounded-frame ${rim ? "rim-gold" : ""} ${className}`;

  if (label) {
    return (
      <section aria-label={label} className={classes}>
        {children}
      </section>
    );
  }
  return <div className={classes}>{children}</div>;
}
