/**
 * Background treatments.
 *
 * The problem these solve: `bg-midnight` across a whole page is a single flat field,
 * and flat fields read as unfinished at large sizes. They also band badly on cheap
 * Android screens, which is most of this audience.
 *
 * These are composable layers, all `absolute inset-0` and pointer-events-none, meant
 * to sit inside a `relative isolate` section. None of them animate and none need
 * JavaScript, so they cost nothing on the main thread. The animated option lives in
 * `aurora-canvas.tsx` and is deliberately separate.
 *
 * Colour discipline from doc 02 still applies: "Gold should guide the eye rather than
 * coat the interface." Every glow below is under 12% alpha. If you can point at the
 * gradient and name it, it is too strong.
 */

/**
 * Soft off-canvas glows, the CSS stand-in for a mesh gradient.
 *
 * Three radial gradients anchored outside the frame so no visible centre appears.
 * Teal and gold are the only hues; both are already in the palette, so this reads as
 * depth rather than as a new colour.
 */
export function MeshGlow({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute inset-0 ${className}`}
      style={{
        background: [
          "radial-gradient(70% 55% at 12% -10%, rgba(45,93,95,0.20), transparent 68%)",
          "radial-gradient(55% 45% at 88% 4%, rgba(200,154,78,0.10), transparent 66%)",
          "radial-gradient(90% 70% at 50% 112%, rgba(11,29,45,0.85), transparent 70%)",
        ].join(","),
      }}
    />
  );
}

/**
 * Film grain.
 *
 * `feTurbulence` rather than a PNG: it is a few hundred bytes, resolution
 * independent, and needs no extra request. `soft-light` keeps it from lifting the
 * blacks, which plain opacity would.
 *
 * This is the layer that actually fixes gradient banding, and it is the one most
 * worth keeping regardless of which direction the design goes.
 */
export function Grain({
  opacity = 0.5,
  className = "",
}: {
  opacity?: number;
  className?: string;
}) {
  return (
    <svg
      aria-hidden
      className={`pointer-events-none absolute inset-0 size-full ${className}`}
      style={{ mixBlendMode: "soft-light", opacity }}
    >
      <filter id="grain-filter">
        <feTurbulence
          type="fractalNoise"
          baseFrequency="0.85"
          numOctaves={3}
          stitchTiles="stitch"
        />
        {/* Desaturate, or the turbulence renders as coloured confetti. */}
        <feColorMatrix type="saturate" values="0" />
      </filter>
      <rect width="100%" height="100%" filter="url(#grain-filter)" />
    </svg>
  );
}

/**
 * Topographic contour lines.
 *
 * The most brand-specific option: it says "survey map of steep ground" without any
 * imagery. Drawn procedurally so it needs no asset, and deterministic so it does not
 * shift between server and client.
 *
 * Kept at 3% so it reads as texture at a glance and as contours only if you look.
 */
export function Contours({
  opacity = 0.05,
  className = "",
}: {
  opacity?: number;
  className?: string;
}) {
  // Nested closed curves, each a slightly larger offset of the one inside it.
  const rings = Array.from({ length: 11 }, (_, i) => {
    const k = i / 10;
    const rx = 18 + k * 62;
    const ry = 11 + k * 40;
    // Wobble so the set reads as terrain rather than as a bullseye.
    const cx = 38 + Math.sin(i * 1.7) * 6;
    const cy = 52 + Math.cos(i * 1.3) * 5;
    return { rx, ry, cx, cy, rot: -18 + Math.sin(i) * 10 };
  });

  return (
    <svg
      aria-hidden
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      className={`pointer-events-none absolute inset-0 size-full ${className}`}
      style={{ opacity }}
    >
      <g fill="none" stroke="#f7f6f2" strokeWidth="0.18" vectorEffect="non-scaling-stroke">
        {rings.map((r, i) => (
          <ellipse
            key={i}
            cx={r.cx}
            cy={r.cy}
            rx={r.rx}
            ry={r.ry}
            transform={`rotate(${r.rot} ${r.cx} ${r.cy})`}
          />
        ))}
      </g>
    </svg>
  );
}

/**
 * Vignette with a horizon band.
 *
 * The cheapest option and the one closest to how the photographs are already lit:
 * darker at the edges, one band of light where a horizon would be. Pairs well with
 * anything else here because it only removes light, never adds colour.
 */
export function Vignette({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute inset-0 ${className}`}
      style={{
        background: [
          "radial-gradient(120% 80% at 50% 40%, transparent 40%, rgba(4,12,20,0.55) 100%)",
          "linear-gradient(180deg, transparent 55%, rgba(45,93,95,0.10) 72%, transparent 88%)",
        ].join(","),
      }}
    />
  );
}
