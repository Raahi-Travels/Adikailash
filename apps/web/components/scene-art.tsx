/**
 * Procedural ridge-line artwork, used wherever a photograph has not been taken yet.
 *
 * This is the honest middle ground. Doc 02 bans "AI-generated travel images presented
 * as real locations", and it is right to: the site's whole argument is that we tell
 * the truth about this road. But a grey box makes a finished site look broken.
 *
 * So the slot renders *obvious illustration*. Flat two-tone ridges in the brand
 * palette, no texture, no sky detail, no snow, nothing photographic. Nobody mistakes
 * it for a photograph of Om Parvat, which is exactly the property that makes it safe
 * to ship. The "photograph pending" caption stays on top of it, so the page still
 * says plainly that the real image is outstanding.
 *
 * Deterministic: the same slot draws the same ridge every time, so the layout is
 * stable across renders and between server and client.
 */

/** FNV-1a. Used both to seed the PRNG and to derive a safe SVG id. */
function hash(key: string) {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Small deterministic PRNG. Same key in, same landscape out. */
function seeded(key: string) {
  let h = hash(key);
  return () => {
    h ^= h << 13;
    h ^= h >>> 17;
    h ^= h << 5;
    return ((h >>> 0) % 10000) / 10000;
  };
}

/**
 * One ridge as an SVG path, spanning the full width and closed along the bottom.
 *
 * `roughness` controls how jagged the silhouette is: distant ridges are smoother,
 * near ones sharper, which is what gives the layers their sense of depth.
 */
function ridge(
  rand: () => number,
  { baseline, amplitude, roughness }: {
    baseline: number;
    amplitude: number;
    roughness: number;
  },
) {
  const points: string[] = [];
  const steps = Math.round(6 + roughness * 8);

  for (let i = 0; i <= steps; i++) {
    const x = (i / steps) * 100;
    // Peaks cluster rather than alternating evenly, so the profile reads as a real
    // range instead of a sawtooth.
    const peak = Math.sin((i / steps) * Math.PI * (1.2 + rand())) * 0.6 + rand() * 0.7;
    const y = baseline - peak * amplitude;
    points.push(`${x.toFixed(2)},${y.toFixed(2)}`);
  }

  return `M0,100 L0,${baseline.toFixed(2)} L${points.join(" L")} L100,100 Z`;
}

export function SceneArt({ seed, className = "" }: { seed: string; className?: string }) {
  const rand = seeded(seed);
  // Seeds are arbitrary strings, including whole sentences from a photo brief, so
  // derive the gradient id from a hash. Spaces and full stops in an id make
  // `url(#...)` fail to resolve, which silently renders the sky as black.
  const gradientId = `sky-${hash(seed).toString(36)}`;

  // Four layers back to front. Aerial perspective does the work: distant ridges sit
  // close to the hazy horizon colour and each nearer one steps darker, which is what
  // separates them without any outline or shading.
  const layers = [
    { baseline: 60, amplitude: 30, roughness: 0.3, fill: "#3a5068" },
    { baseline: 71, amplitude: 26, roughness: 0.5, fill: "#28394f" },
    { baseline: 83, amplitude: 22, roughness: 0.8, fill: "#182636" },
    { baseline: 94, amplitude: 16, roughness: 1, fill: "#0b1621" },
  ].map((layer) => ({ ...layer, d: ridge(rand, layer) }));

  const starX = 66 + rand() * 24;
  const starY = 16 + rand() * 14;

  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="xMidYMid slice"
      className={`size-full ${className}`}
      aria-hidden="true"
    >
      <defs>
        {/* Cold zenith down to a pale, hazy horizon. The haze is what makes the
            distant ridge read as distant. */}
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#08131e" />
          <stop offset="40%" stopColor="#14293c" />
          <stop offset="72%" stopColor="#375068" />
          <stop offset="100%" stopColor="#5c7489" />
        </linearGradient>

        {/* First light, low and warm. Kept faint: gold is the accent, not the sky. */}
        <linearGradient id={`${gradientId}-dawn`} x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor="#c89a4e" stopOpacity="0.3" />
          <stop offset="55%" stopColor="#a86632" stopOpacity="0.08" />
          <stop offset="100%" stopColor="#a86632" stopOpacity="0" />
        </linearGradient>
      </defs>

      <rect width="100" height="100" fill={`url(#${gradientId})`} />
      <rect y="35" width="100" height="45" fill={`url(#${gradientId}-dawn)`} />

      {/* The guiding star, the one warm note in the palette. */}
      <g stroke="#e8c98a" strokeWidth="0.32" strokeLinecap="round" opacity="0.85">
        <path d={`M${starX},${starY - 3} L${starX},${starY + 3}`} />
        <path d={`M${starX - 3},${starY} L${starX + 3},${starY}`} />
        <path
          d={`M${starX - 1.6},${starY - 1.6} L${starX + 1.6},${starY + 1.6}`}
          opacity="0.45"
        />
        <path
          d={`M${starX + 1.6},${starY - 1.6} L${starX - 1.6},${starY + 1.6}`}
          opacity="0.45"
        />
      </g>

      {layers.map((layer) => (
        <path key={layer.fill} d={layer.d} fill={layer.fill} />
      ))}
    </svg>
  );
}
