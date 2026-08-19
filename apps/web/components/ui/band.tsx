import type { ReactNode } from "react";

import { Grain } from "@/components/backgrounds";
import { Bloom } from "@/components/ui/bloom";

/**
 * ============================================================================
 * Layout primitives. Every page section on this site is one of these.
 * ============================================================================
 *
 * The audit that started this redesign found `mt-12` on one page and `mt-14` on
 * another doing the same job, five different section paddings, and a `max-w`
 * chosen per page. These three components exist so that stops: there is one
 * vertical rhythm (`--band-y`), one page inset (`--gutter`), and one content
 * width (75rem).
 *
 * They are server components with no state. Import them freely.
 */

type Register = "dark" | "light";

/**
 * A page section.
 *
 * Carries its register, the `data-register-mark` the floating nav reads to decide
 * which ground it is currently travelling over, the vertical rhythm, and
 * optionally the two texture layers. It does **not** lay out its children: wrap
 * them in `<Content>` or `<BleedGrid>` depending on whether anything needs to
 * escape the reading column.
 *
 * **Always pass a register.** The nav pill picks its own tint from whichever
 * marked section is under it, and a section with no mark is invisible to it, so
 * the pill keeps wearing the previous section's colours as you scroll past.
 *
 * ```tsx
 * <Band register="light" glow grain>
 *   <Content>
 *     <h2 className="type-title-1">Three ways up</h2>
 *   </Content>
 * </Band>
 * ```
 */
export function Band({
  register,
  children,
  className = "",
  tight = false,
  lead = false,
  glow = false,
  grain = false,
  id,
}: {
  register: Register;
  children: ReactNode;
  className?: string;
  /** `--band-y-tight` (40 to 72px) instead of `--band-y` (56 to 120px). */
  tight?: boolean;
  /**
   * This is the first section on a page that has no photographic hero.
   *
   * It absorbs the fixed nav's clearance into its own top padding, so its ground
   * starts at the top of the viewport and runs under the pill instead of leaving
   * a flat strip of body colour and a hard seam where the gradient begins.
   *
   * **The page must also carry `data-lead-band` on its `<main>`**, which is what
   * turns off the clearance padding in `globals.css`. One without the other is
   * either a pill sitting on the h1 or the gap you were trying to remove, twice.
   */
  lead?: boolean;
  /**
   * The bloom field: two soft radial gradients originating outside the box.
   *
   * The test for whether it is too strong is simple. If you can point at the
   * gradient and name it, turn it down.
   */
  glow?: boolean;
  /**
   * Film grain. **Put this on any section carrying a gradient.** Every gradient
   * on the site bands on the cheap Android panels most of this audience holds,
   * and `feTurbulence` at a few hundred bytes is what fixes it.
   */
  grain?: boolean;
  id?: string;
}) {
  return (
    <section
      id={id}
      data-register-mark={register}
      className={[
        `register-${register}`,
        "relative isolate overflow-hidden",
        tight ? "band--tight" : "band",
        lead ? "band--lead" : "",
        className,
      ].join(" ")}
    >
      {glow && <Bloom />}
      {/* Dark grounds need more grain to break the same amount of banding. */}
      {grain && <Grain opacity={register === "dark" ? 0.45 : 0.34} />}
      {children}
    </section>
  );
}

/**
 * The reading column: 1200px maximum, `--gutter` inset, centred.
 *
 * Use this when nothing in the section needs to reach the viewport edge. When
 * something does, use `<BleedGrid>` instead; never `margin-inline: calc(50% -
 * 50vw)`, which counts the scrollbar in `100vw` and produces horizontal page
 * scroll on Windows.
 */
export function Content({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`mx-auto w-full max-w-[75rem] px-[var(--gutter)] ${className}`}>
      {children}
    </div>
  );
}

/**
 * The grid with named lines, for sections where a photograph escapes the column.
 *
 * Children sit in `content` by default. Give a child `full`, `pop-left` or
 * `pop-right` to break out. **Once per page at most**: a page where everything
 * breaks the grid has no grid.
 *
 * ```tsx
 * <BleedGrid>
 *   <h2 className="type-title-1">Where you will sleep</h2>
 *   <figure className="pop-right mt-8">…</figure>
 * </BleedGrid>
 * ```
 */
export function BleedGrid({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={`bleed-grid w-full ${className}`}>{children}</div>;
}

/**
 * A list of three or more, laid out as a constellation rather than a row.
 *
 * **Three equal boxes in a row is banned site-wide.** Items take unequal column
 * spans and unequal vertical offsets, so each photograph gets a different crop
 * and the row stops reading as one template printed three times. Collapses to a
 * single stacked column below 1024px.
 *
 * Test at 1, 2, 4 and 7 items before you ship anything using it.
 */
export function Constellation({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={`constellation ${className}`}>{children}</div>;
}
