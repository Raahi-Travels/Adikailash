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
  scrim = "left",
}: {
  name: SceneKey;
  className?: string;
  /**
   * Where the interesting part of the photograph is. The hero panorama puts its
   * peaks well right of centre, and `object-center` cropped them out entirely at
   * desktop widths, leaving a hero backed by an empty sky.
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
        // Capped to the upper part of the frame on small screens.
        //
        // Stretched over the whole section, a 2.3:1 panorama covering a 390 by 1638
        // box shows about a tenth of its width and upscales it ninefold: not a
        // photograph any more, just a blur nobody can identify. Confining it to a
        // band keeps the crop close to the picture's own proportions, and the
        // gradient below carries it into the section rather than ending it on a line.
        <div className="absolute inset-x-0 top-0 h-64 sm:inset-0 sm:h-auto">
          <Image
            src={src}
            alt=""
            fill
            sizes="100vw"
            priority={scene.priority}
            className={`object-cover ${position}`}
          />
        </div>
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
      {scrim === "left" ? (
        <>
          {/* On a phone the picture is a band at the top and the copy sits below it
              on solid ground, so the only scrim needed is a short fade off the foot
              of the band. Putting text over the photograph on a 390 px screen means
              darkening the whole thing to keep it legible, which leaves a photograph
              nobody can see and text that is only just readable: both halves worse
              than either done properly.

              From `sm` up the copy holds one side and the picture keeps the other,
              so a horizontal wash works and the band is not needed. */}
          <div className="absolute inset-x-0 top-40 h-24 bg-gradient-to-b from-transparent to-midnight sm:hidden" />
          <div className="absolute inset-x-0 bottom-0 top-64 bg-midnight sm:hidden" />
          <div className="absolute inset-0 hidden sm:block sm:bg-gradient-to-r sm:from-midnight sm:via-midnight/75 sm:via-45% sm:to-transparent" />
        </>
      ) : (
        <>
          {/* A flat wash plus a radial lift. Centred copy has bright picture on both
              sides of it, so there is nowhere for a directional gradient to hide the
              contrast it needs. */}
          <div className="absolute inset-0 bg-midnight/72" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_55%_at_50%_50%,var(--color-midnight)_0%,transparent_75%)]" />
        </>
      )}
      <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-midnight via-midnight/60 to-transparent" />
    </div>
  );
}
