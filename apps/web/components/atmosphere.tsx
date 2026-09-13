"use client";

import { motion, useTransform } from "motion/react";
import { useRef } from "react";

import { useCapability, useParallax, useScrollPhysics } from "@/lib/motion";

/**
 * Depth, made out of weather.
 *
 * Parallax needs planes at different distances, and a photograph is one plane.
 * The hero has a real ridge in it and no amount of easing makes a flat image
 * feel deep, so these are the other planes: a bank of high-altitude mist and a
 * fan of dawn light, each drifting at its own rate as the page moves.
 *
 * **They are not of anywhere.** No horizon, no landform, no recognisable place.
 * That is what keeps them on the right side of doc 02, which bans synthetic
 * imagery standing in for an actual stay, vehicle or route condition. A bank of
 * fog stands in for nothing. It lets the one real element in the frame, the
 * photograph, be the only thing making a claim.
 *
 * **Screen blend, not alpha.** Both plates are luminance on absolute black, so
 * `plus-lighter` adds their light to whatever is beneath and their black
 * contributes nothing. That avoids the halo a badly cut alpha channel leaves
 * around wisps, and it costs no extra decode: 20 KB and 12 KB, which is less
 * than a third of one of the photographs they sit over.
 *
 * **Nothing here runs on a device that cannot afford it.** `useCapability`
 * returns `static` for reduced-motion and for data saver, and `reduced` for four
 * cores or fewer, which is a large part of this audience. On `full` both plates
 * drift; on `reduced` the mist alone is painted, still, because a static wash is
 * cheap and the depth is worth keeping; on `static` nothing renders at all.
 */
export function Atmosphere({
  /** Rendered inside a `relative` section that already owns the photograph. */
  className = "",
}: {
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const capability = useCapability();

  // Different distances, so they separate as the page moves. The mist is nearer
  // and travels further; the light is at the back of the scene and barely moves,
  // which is what selling depth actually requires.
  const mistY = useParallax(ref, 130);
  const raysY = useParallax(ref, 46);
  const { lean } = useScrollPhysics();

  // The light steadies as the page settles and lifts slightly into a fast
  // scroll, so the dawn reads as a light source rather than a decal.
  const rayOpacity = useTransform(lean, [-1, 0, 1], [0.5, 0.62, 0.78], {
    clamp: true,
  });

  if (capability === "static") return null;

  const alive = capability === "full";

  return (
    <div
      ref={ref}
      aria-hidden
      className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}
    >
      <motion.div
        className="absolute inset-x-0 bottom-0 h-[62%] bg-cover bg-bottom bg-no-repeat mix-blend-plus-lighter"
        style={{
          backgroundImage: "url(/scenes/atmosphere/mist.webp)",
          opacity: 0.34,
          y: alive ? mistY : 0,
        }}
      />

      {alive && (
        <motion.div
          className="absolute inset-0 bg-cover bg-top bg-no-repeat mix-blend-plus-lighter"
          style={{
            backgroundImage: "url(/scenes/atmosphere/rays.webp)",
            opacity: rayOpacity,
            y: raysY,
          }}
        />
      )}

      {/*
        Grain last and over everything. A 256px tile repeated, which is why it is
        6 KB rather than a full-frame plate. It is here for a mechanical reason
        rather than a stylistic one: this page is mostly a dark gradient, and
        eight-bit gradients band visibly on the cheap panels much of this
        audience is reading on. Noise is the standard fix and it is cheaper than
        dithering in a shader.
      */}
      <div
        className="absolute inset-0 opacity-[0.055] mix-blend-overlay"
        style={{
          backgroundImage: "url(/scenes/atmosphere/grain.webp)",
          backgroundSize: "256px 256px",
        }}
      />
    </div>
  );
}
