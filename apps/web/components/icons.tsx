/**
 * Icon system.
 *
 * Doc 02 sets the constraints: "Trishul as a symbol of Shiva and direction, north
 * star or eight-point guiding star, mountain silhouette or three-peak form, path,
 * switchback or river line, temple bell, diya, Om or stone shrine used selectively,
 * compass and route markers for practical guidance. Icons should be thin, geometric
 * and consistent."
 *
 * So every icon here shares one grammar:
 *
 *   - a 24x24 viewBox, drawn on a 20x20 optical area with 2px breathing room
 *   - stroke only, never fill, so a single `currentColor` carries the whole set
 *   - 1.5 stroke width, round caps and joins
 *   - no icon combines two sacred symbols; the doc explicitly warns against it
 *
 * The sacred icons are used sparingly and never decoratively. An Om beside a form
 * field is exactly the "devotional-poster collage" doc 02 rules out.
 */

type IconProps = {
  className?: string;
  /** Set when the icon carries meaning on its own; omit when adjacent text says it. */
  title?: string;
};

function Svg({
  className = "size-6",
  title,
  children,
}: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={title ? undefined : true}
      role={title ? "img" : undefined}
    >
      {title && <title>{title}</title>}
      {children}
    </svg>
  );
}

/* ---------------------------------------------------------------- sacred (sparing) */

/** Trishul. Direction and Shiva. Used for the brand mark and nothing casual. */
export const Trishul = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 21V8" />
    <path d="M5 4v4a7 7 0 0 0 14 0V4" />
    <path d="M5 4v3M19 4v3M12 3v5" />
    <path d="M9.5 17.5h5" />
  </Svg>
);

/** Three peaks. The Himalaya as form, not photograph. */
export const Peaks = (p: IconProps) => (
  <Svg {...p}>
    <path d="M2 19h20" />
    <path d="M2 19 8 8l3.5 6.5L15 6l7 13" />
    <path d="m6.2 12.2 1.8 1.4 1.6-1.2M13.4 9.6l1.6 1.4 1.6-1.2" />
  </Svg>
);

/** Eight-point guiding star. The north of the working brand name. */
export const GuidingStar = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 2v20M2 12h20" />
    <path d="m5.6 5.6 12.8 12.8M18.4 5.6 5.6 18.4" opacity={0.55} />
  </Svg>
);

/** Stone shrine. Used for destinations, never as a stand-in for a real temple photo. */
export const Shrine = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 2.5 9 7h6l-3-4.5Z" />
    <path d="M8 7v4M16 7v4" />
    <path d="M6 11h12l1 3H5l1-3Z" />
    <path d="M7 14v7h10v-7" />
    <path d="M10.5 21v-3.5a1.5 1.5 0 0 1 3 0V21" />
  </Svg>
);

/** Diya. Reserved for post-trip and remembrance moments. */
export const Diya = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 4c1.6 1.9 2.4 3.3 2.4 4.6a2.4 2.4 0 0 1-4.8 0C9.6 7.3 10.4 5.9 12 4Z" />
    <path d="M4 14h16a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4Z" />
    <path d="M9 18v2h6v-2" />
  </Svg>
);

/* -------------------------------------------------------------------- route & place */

/** Switchback. The road itself, which is most of this journey. */
export const Switchback = (p: IconProps) => (
  <Svg {...p}>
    <path d="M6 21c0-4 12-3 12-7s-12-3-12-7" />
    <circle cx="6" cy="21" r="1.2" />
    <circle cx="18" cy="3.6" r="1.2" />
  </Svg>
);

/** Compass. Gateways and orientation. */
export const Compass = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="m15.5 8.5-2 5.2-5.2 2 2-5.2 5.2-2Z" />
  </Svg>
);

/** Altitude. A peak with a measured line, for the at-a-glance figures. */
export const Altitude = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3 20h18" />
    <path d="m4 20 8-13 8 13" />
    <path d="M3 11h5M3 11l1.6-1.4M3 11l1.6 1.4" opacity={0.6} />
  </Svg>
);

/** A stay. Roof and hearth: the homestay, not a hotel block. */
export const Homestay = (p: IconProps) => (
  <Svg {...p}>
    <path d="m3 11 9-7 9 7" />
    <path d="M5.5 9.6V20h13V9.6" />
    <path d="M10 20v-4.5h4V20" />
    <path d="M9 12h1.5" opacity={0.6} />
  </Svg>
);

/** Vehicle. Transport legs and pickup. */
export const Vehicle = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3 16.5v-4l2-5h14l2 5v4" />
    <path d="M3 12.5h18" />
    <circle cx="7.5" cy="16.5" r="1.8" />
    <circle cx="16.5" cy="16.5" r="1.8" />
    <path d="M9.3 16.5h5.4" />
  </Svg>
);

/* ------------------------------------------------------------------------- weather */

export const Clear = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4" />
  </Svg>
);

export const Cloudy = (p: IconProps) => (
  <Svg {...p}>
    <path d="M9.5 8.5a4 4 0 0 1 7.6 1.6A3.4 3.4 0 0 1 16.5 17h-8a4.5 4.5 0 0 1 1-8.5Z" />
  </Svg>
);

export const Snow = (p: IconProps) => (
  <Svg {...p}>
    <path d="M9.5 6.5a4 4 0 0 1 7.6 1.6A3.4 3.4 0 0 1 16.5 15h-8a4.5 4.5 0 0 1 1-8.5Z" />
    <path d="M9 19h.01M12.5 20.5h.01M16 19h.01" />
  </Svg>
);

export const Rain = (p: IconProps) => (
  <Svg {...p}>
    <path d="M9.5 6.5a4 4 0 0 1 7.6 1.6A3.4 3.4 0 0 1 16.5 15h-8a4.5 4.5 0 0 1 1-8.5Z" />
    <path d="M9 18l-1 2.5M12.5 18l-1 2.5M16 18l-1 2.5" />
  </Svg>
);

/* ------------------------------------------------------------------- trust & status */

/** Verified. A check inside a time ring: confirmed, and confirmed *recently*. */
export const Verified = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="m8 12 2.8 2.8L16 9.5" />
  </Svg>
);

/** Stale. The same ring, holding a clock instead. Deliberately the same silhouette,
 *  so the difference reads as "not checked lately" rather than "broken". */
export const Stale = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7.5V12l2.8 1.8" />
  </Svg>
);

/** Caution. Limited access and permit-pending states. */
export const Caution = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 3.5 21.5 20H2.5L12 3.5Z" />
    <path d="M12 10v4M12 17h.01" />
  </Svg>
);

/** Closed. Suspended and closed states. */
export const Closed = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="m8.5 8.5 7 7M15.5 8.5l-7 7" />
  </Svg>
);

/** Permit. A stamped document, for the checklist. */
export const Permit = (p: IconProps) => (
  <Svg {...p}>
    <path d="M6 3h8l4 4v14H6z" />
    <path d="M14 3v4h4" />
    <circle cx="12" cy="14" r="2.6" />
    <path d="M12 16.6V19" opacity={0.7} />
  </Svg>
);

/** Group. Family and companion planning. */
export const Group = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="9" cy="8.5" r="3" />
    <path d="M3.5 19a5.5 5.5 0 0 1 11 0" />
    <path d="M16 6.2a3 3 0 0 1 0 5.6M17.5 19a5.5 5.5 0 0 0-2-4.2" opacity={0.7} />
  </Svg>
);

/** Calendar. Departures and dates. */
export const Departures = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3.5" y="5" width="17" height="15.5" rx="2" />
    <path d="M3.5 9.5h17M8 3v4M16 3v4" />
  </Svg>
);

/** Conversation. The WhatsApp and callback paths, without a vendor logo. */
export const Conversation = (p: IconProps) => (
  <Svg {...p}>
    <path d="M20.5 12c0 4.1-3.8 7.4-8.5 7.4a9.7 9.7 0 0 1-2.8-.4L4 20.5l1.6-4a7 7 0 0 1-2.1-4.5C3.5 7.9 7.3 4.6 12 4.6s8.5 3.3 8.5 7.4Z" />
  </Svg>
);

/** Arrow. The one navigational glyph, used for every "read on" affordance. */
export const ArrowRight = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 12h15m0 0-5-5m5 5-5 5" />
  </Svg>
);

/**
 * Weather condition to icon. Keeps the mapping in one place so a new condition
 * cannot silently render as nothing.
 */
export function weatherIcon(condition: string) {
  switch (condition) {
    case "clear":
      return Clear;
    case "snow":
    case "heavy_snow":
      return Snow;
    case "rain":
    case "heavy_rain":
    case "storm":
      return Rain;
    default:
      return Cloudy;
  }
}
