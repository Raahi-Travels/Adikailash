import Image from "next/image";

import { FEATHER, REACHES_BOTTOM, type Feather } from "@/components/feather";
import { PhotoSlot } from "@/components/photo-slot";
import { SceneArt } from "@/components/scene-art";
import { SCENES, sceneSrc, type SceneKey } from "@/lib/imagery";

export type { Feather } from "@/components/feather";

/**
 * ============================================================================
 * The image treatment system. No hard-edged photo rectangle survives it.
 * ============================================================================
 *
 * Three rules govern everything below, and every one of them was learned by
 * rendering the wrong thing first.
 *
 * **1. The ramp-length rule.** A mask ramp must be at least 40% of the masked
 * dimension and at least 200 real pixels. `ramp px = (100 - from%) / 100 *
 * boxDimension`. Under roughly 120px a feather reads as a defect: visibly worse
 * than the hard edge it replaced. `mask-b-from-45%` on a 460px box is a 253px
 * ramp and reads as mist lifting off a valley; `mask-b-from-88%` is 55px and
 * reads as a smudge on the screen. That single number decides whether this looks
 * custom or broken.
 *
 * **2. Mask and scrim ship together, never one alone.** A mask changes alpha
 * only, so a dark photograph fading to alpha 0 over snow passes through mid-grey
 * and goes muddy. A scrim alone leaves the hard edge. The pair resolves the
 * picture into the page, and the scrim resolves through `--color-scrim`, which
 * each register sets to its own ground, so the same component works on navy and
 * on snow. Every scrim in this file used to hardcode midnight, which meant that
 * on the snow ground it *created* the seam it was there to hide.
 *
 * **3. Never mask an element that contains text**, and drop the radius on any
 * edge a feather lands on. A radius clips at full opacity while the mask is
 * already partly transparent, which leaves a visible quarter-circle notch. Radius
 * and feather may coexist only on different edges, which is why card imagery is
 * rounded on its top two corners and square on the bottom two.
 *
 * Provisional imagery is AI-generated and marked as such: `data-provisional` in
 * the DOM always, plus a visible corner marker in development so nobody on the
 * team forgets which images are standing in. The marker is suppressed in
 * production builds because `scripts/check-imagery.ts` is the real gate.
 *
 * See `lib/imagery.ts` for why these exist and when they go.
 */

/**
 * Radius, in the two forms this system allows.
 *
 * The 8 to 16px band is banned site-wide, so there is no "medium". `top` is for
 * card imagery whose bottom edge is feathered: rounding an edge the mask is
 * already dissolving produces a notch.
 */
type Radius = "none" | "top" | "frame";

const RADIUS: Record<Radius, string> = {
  none: "",
  top: "rounded-t-frame",
  frame: "rounded-frame",
};

/**
 * Turn the deprecated `position` prop back into a CSS value.
 *
 * Callers pass Tailwind class syntax, including the arbitrary form
 * `object-[50%_40%]`, so the brackets have to come off and the underscores have
 * to become spaces. Stripping only the `object-` prefix leaves `[50%_40%]`,
 * which is not a value: the declaration is dropped, the crop silently falls back
 * to centre, and the hero looks *almost* right.
 */
function legacyObjectPosition(position: string) {
  return position
    .replace(/^object-/, "")
    .replace(/^\[|\]$/g, "")
    .replaceAll("_", " ");
}

function focusStyle(scene: { focus?: { base: string; sm?: string } }) {
  if (!scene.focus) return undefined;
  return {
    "--focus": scene.focus.base,
    "--focus-sm": scene.focus.sm ?? scene.focus.base,
  } as React.CSSProperties;
}

/** See `.focus-point` in `globals.css` for why this is a class and not a utility. */
const FOCUS_CLASS = "focus-point";

/**
 * A scene image, or an honest empty panel when no file exists yet.
 *
 * The mask lives on an inner wrapper that holds nothing but the picture, so a
 * caption or a status chip placed beside it never fades (rule 3). The scrim is a
 * sibling of that wrapper rather than a child, both because it must not be
 * masked itself and because `backdrop-filter` on any chip above it samples what
 * is *painted behind*: glass inside an isolated, masked wrapper blurs nothing and
 * renders as a flat tint.
 *
 * ```tsx
 * // A journey card: the photograph is the card.
 * <Scene
 *   name="journeys/adi-kailash-om-parvat"
 *   fill
 *   feather="bottom-right"
 *   grade
 *   radius="top"
 *   sizes="(min-width: 1024px) 40vw, (min-width: 768px) 58vw, calc(100vw * 1.35)"
 * />
 * ```
 */
export function Scene({
  name,
  className = "",
  sizes = "(min-width: 1024px) 40vw, (min-width: 768px) 58vw, calc(100vw * 1.35)",
  feather = "bottom",
  scrim,
  grade = false,
  radius = "none",
  overlay,
  fill = false,
  priority,
}: {
  name: SceneKey;
  className?: string;
  /**
   * Passed to next/image.
   *
   * **`sizes` describes the box, but `object-cover` renders the image wider than
   * its box**, which is why every cover-cropped picture on this site was served
   * between 1.19x and 1.80x too small and the panorama looked like mud.
   *
   * ```
   * coverFactor = (imgW/imgH) / (boxW/boxH)   when the box is narrower than the image
   * sizes       = boxWidth * coverFactor * (2/3)   // a 3x phone takes a 2x fetch
   * ```
   *
   * Prescribed values, already solved: journey card
   * `(min-width: 1024px) 40vw, (min-width: 768px) 58vw, calc(100vw * 1.35)`;
   * plan hero `(min-width: 1024px) 1216px, calc(100vw * 1.35)`;
   * home hero `(min-width: 1024px) 1440px, calc(100vw * 1.35)`.
   */
  sizes?: string;
  /** How the picture leaves the frame. Defaults to a feathered bottom edge. */
  feather?: Feather;
  /**
   * Force the dissolving scrim on or off. By default it follows the feather,
   * because a mask without a scrim goes muddy and a scrim without a mask leaves
   * the hard edge. Turn it off only where something else already covers the foot
   * of the picture.
   */
  scrim?: boolean;
  /**
   * Pull the hue toward navy and add one warm note. **Mood imagery only.** Never
   * grade an evidence image: the checkpost photograph shows what the barrier
   * actually looks like, and stylising evidence is the one thing this site cannot
   * do.
   */
  grade?: boolean;
  /** `top` for card imagery with a feathered foot. Never a value in the 8 to 16px band. */
  radius?: Radius;
  /** @deprecated Use `feather="bottom"`. Kept so existing pages keep compiling. */
  overlay?: boolean;
  /**
   * Fill the parent instead of holding the slot's own aspect ratio.
   *
   * A real prop rather than passing `absolute inset-0` through `className`: that put
   * both `relative` and `absolute` on one element, and which of two position
   * utilities wins depends on their order in the generated stylesheet rather than on
   * the order they were written. The wrapper stayed `relative`, collapsed to zero
   * height, and the photograph simply did not appear.
   */
  fill?: boolean;
  /**
   * Overrides the slot's own `priority`. Set it where a slot is the largest thing
   * above the fold on one page but not on others, which is otherwise an
   * unfixable-looking LCP warning.
   */
  priority?: boolean;
}) {
  const scene = SCENES[name];
  const src = sceneSrc(name);
  const resolved: Feather = overlay && feather === "bottom" ? "bottom" : feather;
  const wantsScrim = scrim ?? REACHES_BOTTOM[resolved];

  if (!src) {
    return (
      <PhotoSlot
        brief={scene.brief}
        ratio={scene.ratio}
        feather={resolved}
        radius={radius}
        className={className}
      />
    );
  }

  return (
    <div
      data-provisional="ai-generated"
      className={[
        fill ? "absolute inset-0" : "relative",
        "overflow-hidden",
        RADIUS[radius],
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      style={fill ? undefined : { aspectRatio: scene.ratio }}
    >
      {/* The masked wrapper. Nothing but the picture goes in here. */}
      <div
        className={[
          "absolute inset-0",
          grade ? "grade-brand" : "",
          FEATHER[resolved],
        ]
          .filter(Boolean)
          .join(" ")}
        style={focusStyle(scene)}
      >
        <Image
          src={src}
          alt={scene.alt}
          fill
          sizes={sizes}
          priority={priority ?? scene.priority}
          className={`object-cover ${FOCUS_CLASS}`}
        />
      </div>

      {/* Sibling, never a child of the mask. Resolves through `--color-scrim`, so
          it dissolves into navy on a dark page and into snow on a light one. */}
      {wantsScrim && (
        <div aria-hidden className="scrim-bottom absolute inset-x-0 bottom-0 h-1/3" />
      )}

    </div>
  );
}

/**
 * A scene used as a section backdrop, with text over it. The `photo-hero`
 * primitive.
 *
 * The picture dissolves *upward* into the section's own ground rather than being
 * cropped into a rectangle: mask at the foot, the directional grade above it, and
 * a warm dawn radial that uses `--color-dawn` rather than inventing a hue. There
 * is deliberately no flat wash over the whole frame. There used to be three
 * stacked, and the photograph was carrying about fifteen percent of its own
 * luminance: a hero backed by a thousand-metre dawn read as a dark blue rectangle
 * with a smudge in one corner. A contrast floor that costs the picture is not a
 * floor, it is a lid.
 *
 * Falls back to procedural ridge illustration when no file exists, so the hero
 * has a horizon either way.
 *
 * ```tsx
 * <section className="register-dark relative isolate overflow-hidden" data-register-mark="dark">
 *   <SceneBackdrop name="hero" scrim="left" />
 *   <h1 className="type-display glow-display">…</h1>
 * </section>
 * ```
 */
export function SceneBackdrop({
  name,
  className = "",
  position,
  scrim = "left",
  motion = true,
  sizes = "(min-width: 1024px) 1440px, calc(100vw * 1.35)",
}: {
  name: SceneKey;
  className?: string;
  /**
   * @deprecated Focal points are data now, on the scene in `lib/imagery.ts`. Still
   * accepted so pages keep compiling; a value here wins over the scene's own.
   */
  position?: string;
  /**
   * Which way the darkness falls, which has to follow where the words are.
   *
   * `left` suits the hero, where the copy holds the left third and the mountain
   * should stay visible on the right. `centre` suits a centred block, where a
   * left-to-right wash leaves the bright side of the picture directly behind the
   * text.
   */
  scrim?: "left" | "centre";
  /**
   * Parallax and a slow ken burns. Both are transform-only and both stop dead
   * under `prefers-reduced-motion`. Turn it off on a page that already has a
   * moving instrument on screen.
   */
  motion?: boolean;
  sizes?: string;
}) {
  const scene = SCENES[name];
  const src = sceneSrc(name);

  return (
    <div
      aria-hidden
      {...(src ? { "data-provisional": "ai-generated" } : {})}
      className={`absolute inset-0 -z-10 overflow-hidden ${className}`}
    >
      {src ? (
        <div className={motion ? "depth-plane absolute inset-0" : "absolute inset-0"}>
          {/*
            A band at the top on a phone, the whole frame from `sm` up.

            Stretched over a 390 by 1638 box, a 2.3:1 panorama shows about a tenth
            of its width and upscales it ninefold: not a photograph any more, just
            a blur nobody can identify. Confining it to a band keeps the crop close
            to the picture's own proportions. What changed is the bottom of that
            band: it used to end on a hard line with a 96px gradient under it, and
            now the picture itself feathers out over 176px and the scrim carries it
            the rest of the way.
          */}
          <div
            className={`absolute inset-x-0 top-0 h-80 mask-b-from-45% sm:inset-0 sm:h-auto sm:mask-b-from-72%`}
            style={focusStyle(scene)}
          >
            <div className={motion ? "ken-burns size-full" : "size-full"}>
              <Image
                src={src}
                alt=""
                fill
                sizes={sizes}
                priority={scene.priority}
                className={`object-cover ${position ? "" : FOCUS_CLASS}`}
                style={
                  position ? { objectPosition: legacyObjectPosition(position) } : undefined
                }
              />
            </div>
          </div>
        </div>
      ) : (
        <SceneArt seed={name} feather />
      )}

      {/*
        The grade: a bottom-up dissolve into the section's own ground plus one warm
        radial. Both resolve through register variables, so this works over navy
        and over snow without a second component.
      */}
      <div aria-hidden className="hero-wash absolute inset-0" />

      {/*
        The directional scrim, opaque exactly where the words are and gone by the
        middle of the frame. Where nothing is written, nothing is covered.
      */}
      {scrim === "left" ? (
        <>
          {/* On a phone the copy sits below the picture on solid ground, so the
              only scrim needed is the one already feathering the band. Putting
              text over a photograph on a 390px screen means darkening the whole
              thing to keep it legible, which leaves a photograph nobody can see
              and text that is only just readable: both halves worse than either
              done properly. */}
          {/*
              A gradient, not a block. It used to be `bg-scrim` from `top-72` down,
              and a solid rectangle starting partway through a picture that is
              itself feathering out draws the exact horizontal rule the feather was
              added to remove: faint, but visible on every phone screenshot of the
              home page. Fading it in over the same stretch the mask is already
              ramping across leaves no step anywhere.
          */}
          <div className="absolute inset-x-0 bottom-0 top-56 bg-gradient-to-b from-transparent via-scrim/70 via-45% to-scrim sm:hidden" />
          <div className="absolute inset-0 hidden sm:block sm:bg-gradient-to-r sm:from-scrim sm:via-scrim/70 sm:via-45% sm:to-transparent" />
        </>
      ) : (
        <>
          {/* Centred copy has bright picture on both sides of it, so there is
              nowhere for a directional gradient to hide the contrast it needs.

              The flat pass used to be `bg-scrim/70`, which is 70% navy over the
              entire frame, and it sat under a radial and a wash on top of that.
              Three passes to solve one problem, and the result was a photograph
              nobody could see: the checkpost barrier below Chiyalekh, which is
              the actual gate this page spends its whole length describing.
              Darkening everything to make a paragraph legible spends the picture
              to save the text, when the radial carries most of it.

              46%, and the number was arrived at twice because the first attempt
              was measured at one width only. At 28% the picture looked best and
              the headline fell to 2.86:1 at 1600px. 38% fixed that at 1600 and
              shipped, and the audit then failed it at 390 and 768: the crop
              changes with the viewport and the radial covers proportionally less
              of a narrow frame, so a desktop measurement says nothing about a
              phone. Measured across all three:

                38%   390: 2.77   768: 2.78   1600: 3.53
                46%   390: 3.42   768: 3.42   1600: 4.29
                54%   390: 4.16   768: 4.24   1600: 5.14

              46% is the lightest value that clears the 3:1 floor with margin at
              every width, which is the trade this is making: the barrier stays
              visible and the words stay legible on the device most of this
              audience is holding. */}
          <div className="absolute inset-0 bg-scrim/46" />
          <div className="scrim-centre absolute inset-0" />
        </>
      )}
    </div>
  );
}
