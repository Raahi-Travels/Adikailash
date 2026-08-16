/**
 * The road to Adi Kailash and Om Parvat, as elevation.
 *
 * Every altitude here carries a source, because this file feeds a diagram a traveller
 * may use to judge whether their parents can manage the trip. The figures come from
 * Ministry of External Affairs Kailash Manasarovar Yatra itineraries (the 2017
 * Lipulekh edition and the 2026 edition), which are the only government documents
 * that tabulate this route point by point. Where the two editions agree, the figure
 * is `confident`. Where only one weak source exists, it is `approximate` and the UI
 * says so rather than rounding the doubt away.
 *
 * **The route forks above Gunji and the diagram has to show it.** One arm climbs the
 * Kuti valley to Jyolingkong for Adi Kailash; the other climbs to Nabhidhang for Om
 * Parvat darshan. Drawing them as one line, which is what most operator maps do,
 * implies a single continuous ascent that does not exist.
 *
 * **The dip at Dharchula is real.** Pithoragarh sits at 1,645 m and the road drops to
 * 910 m in the Kali gorge before climbing again. A monotonic profile would be
 * prettier and would misrepresent the drive.
 *
 * Distances are road kilometres and are approximate, used only to space the diagram.
 * Dharchula to Gunji (70 km) and Gunji to Nabhidhang (18 km) are from the MEA 2026
 * itinerary; the rest are estimates and nothing is labelled with them.
 */

export type Confidence = "confident" | "approximate";

export type Branch = "trunk" | "kuti" | "lipulekh";

export type Station = {
  slug: string;
  name: string;
  /** Metres above sea level. */
  altitudeM: number;
  confidence: Confidence;
  /** Approximate road kilometres from Pithoragarh. Spacing only. */
  km: number;
  branch: Branch;
  /** Which station the road arrives from. Null for the origin. */
  from: string | null;
  /** Shown when the reader asks what this place is. */
  note: string;
  /**
   * Published segments that report on this leg, best match first.
   *
   * The diagram is finer-grained than the operator's verification schedule, on
   * purpose: seven stations are what the *road* does, four segments are what a
   * coordinator can realistically drive and confirm. So an intermediate leg falls
   * back to the segment that covers it, and Tawaghat inherits the state of
   * "Dharchula to Gunji" rather than reporting nothing.
   *
   * Explicit pairs rather than a slug join because segment names are operator-typed
   * free text, and explicit rather than pure substring matching because the naming
   * does not line up: the segment ending at Jyolingkong is published as "Gunji to
   * Adi Kailash", after the mountain rather than the camp below it.
   */
  covers: [string, string][];
};

export const STATIONS: Station[] = [
  {
    slug: "pithoragarh",
    name: "Pithoragarh",
    altitudeM: 1645,
    confidence: "confident",
    km: 0,
    branch: "trunk",
    from: null,
    note: "Where we live, and where a journey is put together.",
    covers: [],
  },
  {
    slug: "dharchula",
    name: "Dharchula",
    altitudeM: 910,
    confidence: "confident",
    km: 92,
    branch: "trunk",
    from: "pithoragarh",
    note: "The road drops into the Kali gorge. Permits are issued here, and this is the last hospital on the route.",
    covers: [["pithoragarh", "dharchula"]],
  },
  {
    slug: "tawaghat",
    name: "Tawaghat",
    altitudeM: 1100,
    confidence: "approximate",
    km: 114,
    branch: "trunk",
    from: "dharchula",
    note: "Where the Dhauliganga meets the Kali and the climb begins in earnest.",
    covers: [
      ["dharchula", "tawaghat"],
      ["dharchula", "gunji"],
    ],
  },
  {
    slug: "budhi",
    name: "Budhi",
    altitudeM: 2710,
    confidence: "confident",
    km: 142,
    branch: "trunk",
    from: "tawaghat",
    note: "The steepest gain of the drive happens on this stretch.",
    covers: [
      ["tawaghat", "budhi"],
      ["dharchula", "gunji"],
    ],
  },
  {
    slug: "gunji",
    name: "Gunji",
    altitudeM: 3160,
    confidence: "confident",
    km: 162,
    branch: "trunk",
    from: "budhi",
    note: "Where the road forks, and where the second medical check happens.",
    covers: [
      ["budhi", "gunji"],
      ["dharchula", "gunji"],
    ],
  },
  {
    slug: "nabhidhang",
    name: "Nabhidhang",
    altitudeM: 4260,
    confidence: "confident",
    km: 180,
    branch: "lipulekh",
    from: "gunji",
    note: "The viewpoint for Om Parvat.",
    covers: [["gunji", "nabhidhang"]],
  },
  {
    slug: "jyolingkong",
    name: "Jyolingkong",
    altitudeM: 4570,
    confidence: "approximate",
    km: 200,
    branch: "kuti",
    from: "gunji",
    note: "The base below Adi Kailash, and the highest ground on the journey.",
    covers: [
      ["gunji", "jyolingkong"],
      ["gunji", "adi kailash"],
    ],
  },
];

export const HIGHEST = STATIONS.reduce((a, b) => (b.altitudeM > a.altitudeM ? b : a));

const BY_SLUG = new Map(STATIONS.map((s) => [s.slug, s]));

export function stationBySlug(slug: string): Station | undefined {
  return BY_SLUG.get(slug);
}

/**
 * How a leg is drawn when the API has published a status for it.
 *
 * `unknown` is deliberately the default rather than `open`. Doc 08: "No false 'open'
 * status on stale data." An unpublished leg and a leg last checked in April are both
 * things we do not know, and the diagram says so.
 */
export type LegState = "open" | "caution" | "closed" | "unknown";

const ACCESS_TO_STATE: Record<string, LegState> = {
  open: "open",
  permit_pending: "caution",
  limited: "caution",
  caution: "caution",
  restricted: "caution",
  closed: "closed",
  suspended: "closed",
};

type RouteLike = {
  segment_name: string;
  access: string;
  freshness: "verified" | "due_for_check" | "stale";
  verified_at: string;
  label: string;
};

export type Leg = RouteLike & {
  /** What the diagram draws. Never `open` on a stale reading. */
  state: LegState;
  /** What the segment said when it was last checked, if that has gone stale. */
  lastKnown: LegState | null;
  /** True when this state came from a segment covering more than this one leg. */
  inherited: boolean;
};

/**
 * Find the published status for the leg arriving at `station`.
 *
 * The candidate list is ordered, so an exact segment wins over the broader one that
 * contains it. Both names must appear in the segment name, which tolerates the
 * variations operators actually type ("Dharchula to Gunji", "Gunji-Dharchula road")
 * without matching a segment that merely mentions one of the places.
 */
export function legStatus(
  routes: readonly RouteLike[],
  station: Station,
): Leg | null {
  if (!station.from) return null;

  for (const [index, [a, b]] of station.covers.entries()) {
    const match = routes.find((r) => {
      const name = r.segment_name.toLowerCase();
      return name.includes(a) && name.includes(b);
    });
    if (!match) continue;

    const published = ACCESS_TO_STATE[match.access] ?? "unknown";

    // A stale reading does not keep its colour. Doc 08 refuses a false "open", and
    // the failure this exists to prevent is a green dot on a road nobody has driven
    // since the spring. The value itself is not thrown away though: it moves to
    // `lastKnown` so the label can still say what it was, which is more use to a
    // traveller than a bare "unknown" and is still not a claim that it holds.
    const stale = match.freshness === "stale";

    return {
      ...match,
      state: stale ? "unknown" : published,
      lastKnown: stale ? published : null,
      inherited: index > 0,
    };
  }

  return null;
}

/**
 * Register-aware, which matters more than it looks.
 *
 * These resolve through `--status-*`, set by `.register-dark` and `.register-light`
 * in globals.css, rather than pointing straight at the palette. The palette values
 * are drawn for a light background: open-teal `#2d5d5f` measures 2.32:1 against the
 * navy, well under half the body minimum, and it was being used as the text of the
 * word "Open". The dark register lifts each hue to a readable lightness, so the same
 * token is legible in both places.
 */
export const STATE_COLOUR: Record<LegState, string> = {
  open: "var(--status-open)",
  caution: "var(--status-limited)",
  closed: "var(--status-suspended)",
  unknown: "var(--status-unverified)",
};

const PLAIN: Record<LegState, string> = {
  open: "Open",
  caution: "Caution",
  closed: "Closed",
  unknown: "Not confirmed",
};

export const STATE_LABEL = PLAIN;

/**
 * The label a reader sees, which is not always the state the diagram draws.
 *
 * "Was open, unconfirmed" carries both facts: what the last check found, and that it
 * is too old to rely on. Collapsing that to "unknown" throws away information the
 * traveller can use, and showing it as "open" is the thing we refuse.
 */
export function legLabel(leg: Leg | null): string {
  if (!leg) return "Never checked";
  if (leg.lastKnown) return `${PLAIN[leg.lastKnown]}, unconfirmed`;
  return PLAIN[leg.state];
}
