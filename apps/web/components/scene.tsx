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
  priority,
}: {
  name: SceneKey;
  className?: string;
  /** Passed to next/image. Set it per layout; the default suits a three-up grid. */
  sizes?: string;
  /** Adds a bottom-up scrim, for images that sit under text. */
  overlay?: boolean;
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
      className={`relative overflow-hidden rounded-lg bg-himalayan ${className}`}
      style={{ aspectRatio: scene.ratio }}
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
}: {
  name: SceneKey;
  className?: string;
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
          className="object-cover object-center"
        />
      ) : (
        <SceneArt seed={name} />
      )}
      {/* Three scrims. The flat one guarantees a contrast floor whatever the image
          turns out to be; the horizontal one keeps the headline on the darkest part
          while letting the right side of the picture through; the bottom one blends
          into the section below. Tuned against the darkest photograph in the set, so
          swapping in a brighter one cannot break the headline. */}
      <div className="absolute inset-0 bg-midnight/55" />
      <div className="absolute inset-0 bg-gradient-to-r from-midnight via-midnight/70 to-midnight/20" />
      <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-midnight to-transparent" />
    </div>
  );
}
