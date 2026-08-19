import type { ReactNode } from "react";

import { Scene } from "@/components/scene";
import type { SceneKey } from "@/lib/imagery";

/**
 * ============================================================================
 * Figures. Two of the four image primitives; the other two are `Scene`
 * (photo-card) and `SceneBackdrop` (photo-hero) in `components/scene.tsx`.
 * ============================================================================
 */

/**
 * `photo-figure`: an inline figure that dissolves into the ground.
 *
 * The picture has **no radius**, because its feathered edges would clip at full
 * opacity against a rounded corner and leave a notch. It has a mask and a scrim,
 * always together, because a mask alone goes muddy over snow and a scrim alone
 * leaves the hard edge.
 *
 * **The top edge dissolves too** (`crest`), and that is not decoration. This figure
 * sits mid-band with the page's own ground above it, so a hard top edge draws a
 * rule straight across the page: the /partners checkpost and the homestay kitchen
 * on the home page both read as pasted-in rectangles until it was added.
 *
 * **Side feathering is a dark-ground technique only**, and this component
 * enforces that rather than trusting the caller: on snow, a dark rock edge fading
 * to cream passes through mid-grey and looks like a thumbprint on the screen. Pass
 * `register="dark"` and you get the bottom-and-right dissolve; the light register
 * gets bottom only.
 *
 * Put it in a `<BleedGrid>` with `pop-left` or `pop-right` so the photograph runs
 * past the reading column to the viewport edge while the type stays in the column.
 * Once per page at most.
 *
 * ```tsx
 * <BleedGrid>
 *   <p className="type-body">…</p>
 *   <PhotoFigure
 *     name="homestay-kitchen"
 *     register="light"
 *     className="pop-right mt-10"
 *     caption="A host family's kitchen in a Kumaon village."
 *     sizes="(min-width: 1024px) 60vw, calc(100vw * 1.35)"
 *   />
 * </BleedGrid>
 * ```
 */
export function PhotoFigure({
  name,
  register,
  caption,
  className = "",
  sizes = "(min-width: 1024px) 58vw, calc(100vw * 1.35)",
  grade = false,
  priority,
}: {
  name: SceneKey;
  /** Which ground it dissolves into. Decides whether the side edge feathers. */
  register: "dark" | "light";
  /**
   * One sentence beneath the picture, at `.type-meta`. Optional, and better
   * absent than filled with a restatement of the alt text: a caption that says
   * what the reader can already see is noise.
   */
  caption?: ReactNode;
  className?: string;
  sizes?: string;
  /** Mood imagery only. Never on an evidence photograph. */
  grade?: boolean;
  priority?: boolean;
}) {
  return (
    <figure className={className}>
      {/*
        16/10 on a desktop, 4/3 on a phone. The aspect changes because the crop
        does: a 16/10 letterbox at 390px leaves a 244px-tall strip, which is under
        the ramp-length floor for its own feather.
      */}
      <div className="relative aspect-4/3 w-full md:aspect-16/10">
        <Scene
          name={name}
          fill
          sizes={sizes}
          grade={grade}
          priority={priority}
          feather={register === "dark" ? "crest-right" : "crest"}
          radius="none"
        />
      </div>
      {caption && (
        <figcaption className="type-meta measure-meta mt-4 px-[var(--gutter)] text-tone-muted md:px-0">
          {caption}
        </figcaption>
      )}
    </figure>
  );
}

/**
 * `photo-note`: small supporting imagery, circular.
 *
 * **Only for subjects that survive a square crop**: hands, a permit stamp, a bell,
 * a face, a kitchen fire. Never a mountain skyline, which a circle beheads.
 *
 * No mask, because a circle has no edge to feather, and `lift-3` instead so it
 * reads as an object resting on the page rather than a hole cut in it. Place it
 * asymmetrically and off the grid; a row of these is a row of equal boxes with the
 * corners rounded off, which is the thing this whole system exists to avoid.
 *
 * The label sits beneath, sentence case, `.type-meta`. There is no eyebrow above
 * it. There is no eyebrow above anything.
 */
export function PhotoNote({
  name,
  label,
  className = "",
  sizes = "(min-width: 768px) 340px, 60vw",
  grade = false,
}: {
  name: SceneKey;
  label?: ReactNode;
  className?: string;
  sizes?: string;
  grade?: boolean;
}) {
  return (
    // Inline style rather than `w-[clamp(13.75rem,26vw,21.25rem)]`: an arbitrary
    // value containing commas is not reliably extracted from a `.tsx` file by
    // Tailwind's candidate scanner, and a width that silently does not exist is
    // worse than one that is not a utility.
    <figure style={{ width: "clamp(13.75rem, 26vw, 21.25rem)" }} className={className}>
      <div className="lift-3 relative aspect-square overflow-hidden rounded-pill">
        <Scene
          name={name}
          fill
          sizes={sizes}
          grade={grade}
          feather="none"
          scrim={false}
          radius="none"
        />
      </div>
      {label && (
        <figcaption className="type-meta mt-4 text-tone-body">{label}</figcaption>
      )}
    </figure>
  );
}
