import Image from "next/image";

import { PhotoSlot } from "@/components/photo-slot";
import { SceneArt } from "@/components/scene-art";
import { SCENES, sceneSrc, type SceneKey } from "@/lib/imagery";

/**
 * A scene image, or an honest empty panel when no file exists yet.
 *
 * Provisional imagery is AI-generated and marked as such: `data-provisional` in the
 * DOM always, plus a visible corner marker in development so nobody on the team
 * forgets which images are standing in. The marker is suppressed in production
 * builds because the check in `scripts/check-imagery.ts` is the real gate, and a
 * badge burned into every hero would defeat the point of having imagery at all.
 *
 * See `lib/imagery.ts` for why these exist and when they go.
 */
export function Scene({
  name,
  className = "",
  sizes = "(min-width: 1024px) 33vw, 100vw",
  overlay = false,
  fill = false,
  priority,
}: {
  name: SceneKey;
  className?: string;
  /** Passed to next/image. Set it per layout; the default suits a three-up grid. */
  sizes?: string;
  /** Adds a bottom-up scrim, for images that sit under text. */
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

  if (!src) {
    return <PhotoSlot brief={scene.brief} ratio={scene.ratio} className={className} />;
  }

  return (
    <div
      data-provisional="ai-generated"
      className={
        fill
          ? `absolute inset-0 overflow-hidden ${className}`
          : `relative overflow-hidden rounded-lg bg-surface-raised ${className}`
      }
      style={fill ? undefined : { aspectRatio: scene.ratio }}
    >
      <Image
        src={src}
        alt={scene.alt}
        fill
        sizes={sizes}
        priority={priority ?? scene.priority}
        className="object-cover"
      />
      {overlay && (
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-t from-midnight via-midnight/25 to-transparent"
        />
      )}
      {process.env.NODE_ENV !== "production" && (
        <span className="absolute bottom-2 right-2 rounded bg-midnight/85 px-2 py-0.5 text-[10px] uppercase tracking-[0.1em] text-gold/90 ring-1 ring-gold/25">
          Placeholder
        </span>
      )}
    </div>
  );
}

/**
 * A scene used as a section backdrop, with text over it.
 *
 * The scrim is heavy on purpose. Doc 02 puts the writing first ("the line is the
 * design"), so the image supports the headline rather than competing with it, and
 * contrast has to hold at the top of the page whatever the image turns out to be.
 *
 * Falls back to procedural ridge illustration when no file exists, so the hero has a
 * horizon either way.
 */
export function SceneBackdrop({
  name,
  className = "",
  position = "object-center",
}: {
  name: SceneKey;
  className?: string;
  /**
   * Where the interesting part of the photograph is. The hero panorama puts its
   * peaks well right of centre, and `object-center` cropped them out entirely at
   * desktop widths, leaving a hero backed by an empty sky.
   */
  position?: string;
}) {
  const scene = SCENES[name];
  const src = sceneSrc(name);

  return (
    <div
      aria-hidden
      {...(src ? { "data-provisional": "ai-generated" } : {})}
      className={`absolute inset-0 -z-10 ${className}`}
    >
      {src ? (
        <Image
          src={src}
          alt=""
          fill
          sizes="100vw"
          priority={scene.priority}
          className={`object-cover ${position}`}
        />
      ) : (
        <SceneArt seed={name} />
      )}
      {/*
        Two scrims, both directional, and deliberately none that covers the whole
        frame.

        There used to be three, opening with a flat `bg-midnight/55` over everything.
        Stacked with the gradient beneath it and a third in the page, the photograph
        was carrying maybe fifteen percent of its own luminance: a hero backed by a
        thousand-metre dawn read as a dark blue rectangle with a smudge in one
        corner. A contrast floor that costs the picture is not a floor, it is a lid.

        So: a horizontal wash that is opaque exactly where the headline sits and gone
        by the middle of the frame, and a short bottom fade to meet the section
        below. Where nothing is written, nothing is covered.
      */}
      <div className="absolute inset-0 bg-gradient-to-r from-midnight via-midnight/75 via-45% to-transparent" />
      <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-midnight via-midnight/60 to-transparent" />
    </div>
  );
}
