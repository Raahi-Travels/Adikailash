import {
  HIGHEST,
  legLabel,
  legStatus,
  STATE_LABEL,
  STATIONS,
  type LegState,
  type Station,
} from "@/lib/route-profile";

/**
 * The road as elevation, with whatever we have verified drawn onto it.
 *
 * This is the instrument the status page is built around. Altitude is the risk on
 * this route, and 910 m to 4,570 m is not a fact a table communicates: a reader
 * scanning numbers does not feel the drop into the Kali gorge before the climb, and
 * does not see that the whole gain happens in the last quarter of the drive.
 *
 * **It now draws at every width.** The previous version was `hidden md:block`, which
 * meant most of this audience, who are on a phone on mobile data, never saw the one
 * thing worth seeing. A 1,000-unit-wide diagram genuinely does not work at 390 px, so
 * below `md` the same profile is drawn rotated: altitude runs left to right, the road
 * runs top to bottom, the ground fills the low side, and every station keeps its
 * name and its altitude beside it. Same data, same shapes, same fork above Gunji.
 *
 * **No script.** The earlier version animated the legs in with `motion/react`, which
 * gated the station labels behind `whileInView` and left a keyboard user tabbing into
 * a diagram of invisible text. Everything here is static SVG rendered on the server;
 * the only motion is the page-level `.reveal`, which is opacity-1 by default and
 * behind a `prefers-reduced-motion` guard.
 *
 * **Colour is never the only signal.** Each leg carries a written state in the ledger
 * below the drawing, a glyph whose shape differs per state, and a dashed stroke where
 * nothing has been confirmed. Right now every leg reads "Never checked", because zero
 * segments have been verified. That is the true answer and the diagram says it in
 * full rather than drawing a hopeful green line.
 */

/* --------------------------------------------------------------------------
   State presentation. Colour, stroke and glyph shape, all three.

   These resolve through `--color-status-*`, which `.register-dark` and
   `.register-light` both set, so the diagram is legible on either ground. Note
   these are NOT the exported `STATE_COLOUR` from lib/route-profile.ts: that map
   points at `var(--status-open)`, a variable which does not exist anywhere in
   globals.css, so every stroke using it fell back to inherited colour and the
   whole diagram drew in one tone. Flagged for the owner of that file.
   -------------------------------------------------------------------------- */
const STATE_INK: Record<LegState, string> = {
  open: "var(--color-status-open)",
  caution: "var(--color-status-limited)",
  closed: "var(--color-status-suspended)",
  unknown: "var(--color-status-unverified)",
};

/** Unconfirmed ground is drawn as a broken line. Shape, not just hue. */
const STATE_DASH: Record<LegState, string | undefined> = {
  open: undefined,
  caution: "10 5",
  closed: "2 7",
  unknown: "3 7",
};

const ALT_MIN = 700;
const ALT_MAX = 4800;
const GRID = [1000, 2000, 3000, 4000];
/** A phone gets two, both labelled. Four unlabelled lines read as arbitrary. */
const GRID_V = [2000, 4000];

/* ---------------------------------------------------------------- horizontal */

const H_TOP = 66;
const H_BOTTOM = 286;

const HX: Record<string, number> = {
  pithoragarh: 60,
  dharchula: 196,
  tawaghat: 330,
  budhi: 470,
  gunji: 610,
  nabhidhang: 800,
  jyolingkong: 930,
};

function hy(altitudeM: number) {
  const t = (altitudeM - ALT_MIN) / (ALT_MAX - ALT_MIN);
  return H_BOTTOM - t * (H_BOTTOM - H_TOP);
}

/**
 * Hand-authored, because two shapes here are load-bearing rather than cosmetic.
 *
 * The first leg *descends*: Pithoragarh sits at 1,645 m and the road drops to 910 m
 * in the Kali gorge before it climbs at all. Every operator map draws a continuous
 * ascent and misrepresents the drive. And the two arms leave Gunji at visibly
 * different angles because the route genuinely forks there, the Nabhidhang arm
 * climbing evenly, the Kuti arm holding its height for a long stretch before the
 * final pull to Jyolingkong.
 */
const H_LEG: Record<string, string> = {
  dharchula: "M60,235 C114,235 142,275 196,275",
  tawaghat: "M196,275 C241,275 285,265 330,265",
  budhi: "M330,265 C377,265 423,178 470,178",
  gunji: "M470,178 C517,178 563,154 610,154",
  nabhidhang: "M610,154 C660,140 740,104 800,95",
  jyolingkong: "M610,154 C690,156 845,148 930,78",
};

/**
 * The ground under the road, run out to both edges of the frame.
 *
 * It closes at x=0 and x=1000 rather than at the first and last station, because a
 * fill that stops where the data stops draws two vertical seams and turns the
 * instrument into a chart box. The seams are then dissolved by `rp-h-edge`.
 */
const H_TERRAIN =
  "M0,235 L60,235 C114,235 142,275 196,275 C241,275 285,265 330,265 " +
  "C377,265 423,178 470,178 C517,178 563,154 610,154 " +
  "C690,156 845,148 930,78 L1000,70 L1000,320 L0,320 Z";

/* ---------------------------------------------------------------------------- */

type RouteLike = {
  segment_name: string;
  access: string;
  freshness: "verified" | "due_for_check" | "stale";
  verified_at: string;
  label: string;
};

function age(iso: string, locale: string) {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  const rtf = new Intl.RelativeTimeFormat(locale === "hi" ? "hi-IN" : "en-IN", {
    numeric: "auto",
  });
  if (mins < 60) return rtf.format(-Math.max(mins, 1), "minute");
  if (mins < 1440) return rtf.format(-Math.round(mins / 60), "hour");
  return rtf.format(-Math.round(mins / 1440), "day");
}

function metres(n: number, approximate: boolean) {
  return `${approximate ? "~" : ""}${n.toLocaleString("en-IN")} m`;
}

/**
 * The state glyph.
 *
 * A ring for ground nobody has confirmed, a filled disc for ground somebody has.
 * The shape carries the distinction on a greyscale screen and for a reader who
 * cannot separate the hues, which is the whole reason it is not just a dot.
 */
function StateGlyph({ state }: { state: LegState }) {
  const ink = STATE_INK[state];
  if (state === "unknown") {
    return (
      <svg viewBox="0 0 14 14" className="size-3.5 shrink-0" aria-hidden="true">
        <circle
          cx="7"
          cy="7"
          r="5"
          fill="none"
          stroke={ink}
          strokeWidth="1.8"
          strokeDasharray="2.6 2.6"
        />
      </svg>
    );
  }
  if (state === "closed") {
    return (
      <svg viewBox="0 0 14 14" className="size-3.5 shrink-0" aria-hidden="true">
        <path
          d="M3.4 3.4l7.2 7.2M10.6 3.4l-7.2 7.2"
          stroke={ink}
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    );
  }
  if (state === "caution") {
    return (
      <svg viewBox="0 0 14 14" className="size-3.5 shrink-0" aria-hidden="true">
        <path
          d="M7 2.2l5.2 9.2H1.8z"
          fill="none"
          stroke={ink}
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 14 14" className="size-3.5 shrink-0" aria-hidden="true">
      <circle cx="7" cy="7" r="4.4" fill={ink} />
    </svg>
  );
}

export function RouteProfile({
  routes,
  locale,
}: {
  routes: RouteLike[];
  locale: string;
}) {
  const legs = STATIONS.filter((s) => s.from).map((station) => {
    const status = legStatus(routes, station);
    const state: LegState = status?.state ?? "unknown";
    return { station, status, state };
  });

  const stateOf = (station: Station): LegState =>
    station.from ? (legStatus(routes, station)?.state ?? "unknown") : "open";

  return (
    <div className="reveal">
      {/* ---------------------------------------------------------------
          The drawing. Decorative in the accessibility tree, both orientations:
          the ledger underneath carries every one of these facts in a form a
          screen reader can work with, and announcing them twice would read the
          whole road out before the reader reaches the verification detail.
          --------------------------------------------------------------- */}

      {/* ----------------------------------------------------------------
          Phone: a climb, read down the page.

          This was the desktop chart turned on its side, so altitude ran across
          and the road ran down. It measured fine and it read backwards: moving
          *down* the screen meant going *up* the mountain, and the one thing this
          diagram exists to say is how high the road goes. A 1000-unit profile
          squeezed into 350 is a picture of a chart rather than a chart.

          So the phone gets its own thing. Rows in travel order, top to bottom,
          which is the direction a reader already scrolls, and altitude as bar
          length, which is the one comparison that matters. The drop into the
          Kali gorge shows up as a bar that gets shorter, which is exactly what
          the road does and what no operator map draws. The two arms above Gunji
          are indented under it, because the route genuinely forks and a single
          descending list would claim a continuous climb that does not exist.
          --------------------------------------------------------------- */}
      <ol className="lg:hidden" aria-hidden="true">
        {STATIONS.map((station) => {
          /* Scaled from a 700m floor rather than from zero: nothing on this road
             is near sea level, and anchoring at zero spends most of every bar on
             altitude the journey never visits, which flattens the differences
             the diagram is for. */
          const pct = Math.max(
            6,
            ((station.altitudeM - 700) / (4800 - 700)) * 100,
          );
          const forked = station.branch !== "trunk";
          const state = station.from
            ? (legStatus(routes, station)?.state ?? "unknown")
            : "open";
          return (
            <li
              key={station.slug}
              className={`py-3 ${forked ? "ml-4 border-l border-tone-line pl-4" : ""}`}
            >
              <div className="flex items-baseline justify-between gap-3">
                <span className="type-meta font-semibold text-tone-strong">
                  {station.name}
                </span>
                <span className="type-reading type-meta shrink-0 text-tone-muted">
                  {metres(station.altitudeM, station.confidence === "approximate")}
                </span>
              </div>
              {/* The bar. Gold gets stronger with height, so the top of the road
                  is also the brightest thing in the column. */}
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-pill bg-tone-line">
                <div
                  className="h-full rounded-pill"
                  style={{
                    width: `${pct}%`,
                    background: `color-mix(in oklab, var(--color-gold) ${Math.round(
                      35 + pct * 0.65,
                    )}%, transparent)`,
                  }}
                />
              </div>
              {station.note && (
                <p className="type-meta measure-meta mt-2 text-tone-muted">
                  {station.note}
                </p>
              )}
              {station.from && (
                <p className="type-meta mt-1.5 flex items-center gap-2">
                  <StateGlyph state={state} />
                  <span className="text-tone-muted">
                    {stationName(station.from)} to {station.name}
                  </span>
                </p>
              )}
            </li>
          );
        })}
      </ol>

      {/* Desktop: the conventional elevation profile, with room for the fork. */}
      <svg
        viewBox="0 0 1000 320"
        className="hidden w-full text-tone-strong lg:block"
        aria-hidden="true"
        role="presentation"
      >
        <defs>
          <linearGradient id="rp-h-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-gold)" stopOpacity="0.52" />
            <stop offset="42%" stopColor="var(--color-gold)" stopOpacity="0.20" />
            <stop offset="100%" stopColor="var(--color-gold)" stopOpacity="0.02" />
          </linearGradient>
          <linearGradient id="rp-h-fade" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#fff" stopOpacity="0" />
            <stop offset="6%" stopColor="#fff" stopOpacity="1" />
            <stop offset="95%" stopColor="#fff" stopOpacity="1" />
            <stop offset="100%" stopColor="#fff" stopOpacity="0" />
          </linearGradient>
          {/* The base mass, faded out at the foot so the fill does not end on a
              horizontal line at the bottom of the box. */}
          <linearGradient id="rp-h-base" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-gold)" stopOpacity="0.16" />
            <stop offset="62%" stopColor="var(--color-gold)" stopOpacity="0.12" />
            <stop offset="88%" stopColor="var(--color-gold)" stopOpacity="0.05" />
            <stop offset="100%" stopColor="var(--color-gold)" stopOpacity="0" />
          </linearGradient>
          <mask id="rp-h-edge" maskUnits="userSpaceOnUse" x="0" y="0" width="1000" height="320">
            <rect width="1000" height="320" fill="url(#rp-h-fade)" />
          </mask>
        </defs>

        {/* Ground and grid together inside the edge mask. */}
        <g mask="url(#rp-h-edge)">
          {/* Two passes. The flat base gives the ground a consistent mass at any
              altitude; the gradient on top is brightest where the ridge is highest,
              which is where the eye should end up. One pass alone either washes the
              whole plot or leaves the low half of the road sitting on nothing. */}
          <path d={H_TERRAIN} fill="url(#rp-h-base)" />
          <path d={H_TERRAIN} fill="url(#rp-h-fill)" />
          {GRID.map((m) => (
            <line
              key={m}
              x1="0"
              x2="1000"
              y1={hy(m)}
              y2={hy(m)}
              stroke="currentColor"
              strokeOpacity="0.15"
              strokeWidth="1"
            />
          ))}
        </g>
        {/* Labelled on the right-hand edge, outside the mask so they stay at full
            strength. On the left they collided with the first station's own
            altitude, which by definition sits at the same height: the profile
            starts there. */}
        {GRID.map((m) => (
          <text
            key={m}
            x="998"
            textAnchor="end"
            y={hy(m) - 7}
            className="type-reading"
            fill="currentColor"
            fillOpacity="0.58"
            fontSize="15.7"
          >
            {m.toLocaleString("en-IN")} m
          </text>
        ))}

        {Object.values(H_LEG).map((d) => (
          <path
            key={d}
            d={d}
            fill="none"
            stroke="currentColor"
            strokeOpacity="0.22"
            strokeWidth="2"
          />
        ))}
        {legs.map(({ station, state }) => (
          <path
            key={station.slug}
            d={H_LEG[station.slug]}
            fill="none"
            stroke={STATE_INK[state]}
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={STATE_DASH[state]}
          />
        ))}

        {STATIONS.map((station) => {
          const x = HX[station.slug];
          const y = hy(station.altitudeM);
          return (
            <g key={station.slug}>
              {/* The two arms above Gunji do not merely end, they arrive: one
                  below Adi Kailash, one at the viewpoint for Om Parvat. A halo
                  on those two nodes is the only place the diagram says which
                  points are the destination rather than a stop on the way, and
                  it does it without a word, so it costs nothing in Hindi. */}
              {station.branch !== "trunk" && (
                <circle
                  cx={x}
                  cy={y}
                  r="13"
                  fill="none"
                  stroke="var(--color-gold)"
                  strokeOpacity="0.32"
                  strokeWidth="1.5"
                />
              )}
              <circle
                cx={x}
                cy={y}
                r={station.branch !== "trunk" ? 7 : 5.5}
                fill="var(--color-tone-raised)"
                stroke={
                  station.branch !== "trunk"
                    ? "var(--color-gold)"
                    : STATE_INK[stateOf(station)]
                }
                strokeWidth="2.5"
              />
              <text
                x={x}
                y={y - 20}
                textAnchor="middle"
                fill="currentColor"
                fontSize="17.5"
                fontWeight="600"
              >
                {station.name}
              </text>
              <text
                x={x}
                y={y - 40}
                textAnchor="middle"
                className="type-reading"
                fill="currentColor"
                fillOpacity="0.62"
                fontSize="15.7"
              >
                {metres(station.altitudeM, station.confidence === "approximate")}
              </text>
            </g>
          );
        })}
      </svg>

      {/* ---------------------------------------------------------------
          The ledger. Six legs, and what we know about each one.

          Two lines on a phone and one row from `md`, using `display: contents`
          so the meta values drop into the outer grid on the wide layout rather
          than needing a second markup tree. The old single-row version put a
          name, an altitude, a state and an age on one 390 px line and they
          overlapped each other.
          --------------------------------------------------------------- */}
      {/* Column heads, wide layout only: on a phone the values are stacked under
          the leg name and a header row would label nothing. */}
      <div
        aria-hidden="true"
        className="mt-12 hidden grid-cols-[auto_minmax(0,1fr)_7rem_12rem_8rem] gap-x-6 pb-3 lg:grid"
      >
        <span className="size-3.5" />
        <span className="type-meta text-tone-muted">Leg</span>
        <span className="type-meta text-tone-muted text-right">Ends at</span>
        <span className="type-meta text-tone-muted">State</span>
        <span className="type-meta text-tone-muted text-right">Last checked</span>
      </div>

      <ul className="mt-8 lg:mt-0">
        {legs.map(({ station, status, state }) => (
          <li
            key={station.slug}
            className="grid grid-cols-[auto_minmax(0,1fr)] items-baseline gap-x-3 gap-y-2 border-t border-tone-line py-4 lg:grid-cols-[auto_minmax(0,1fr)_7rem_12rem_8rem] lg:gap-x-6 lg:gap-y-0 lg:py-5"
          >
            <span className="translate-y-px">
              <StateGlyph state={state} />
            </span>
            <span className="type-body text-tone-strong measure-none">
              {station.from ? stationName(station.from) : ""} to {station.name}
            </span>
            <div className="col-start-2 flex flex-wrap items-baseline gap-x-6 gap-y-1 lg:contents">
              <span className="type-meta type-reading text-tone-muted lg:text-right">
                {metres(station.altitudeM, station.confidence === "approximate")}
              </span>
              {/* Two separate facts, kept separate. The state is what the road
                  is doing; the age is how long ago anybody looked. Collapsing
                  them into one string is how "open" ends up outliving its check. */}
              <span
                className="type-meta font-medium"
                style={{ color: STATE_INK[state] }}
              >
                {status ? legLabel(status) : STATE_LABEL.unknown}
              </span>
              <span className="type-meta type-reading text-tone-muted lg:text-right">
                {status ? age(status.verified_at, locale) : "Never checked"}
              </span>
            </div>
          </li>
        ))}
      </ul>

      <p className="type-body measure-meta mt-8 text-tone-muted">
        The highest ground on this journey is {HIGHEST.name} at about{" "}
        <span className="type-reading">
          {HIGHEST.altitudeM.toLocaleString("en-IN")} m
        </span>
. Above Gunji the road forks: one arm climbs to Nabhidhang for the Om Parvat
        viewpoint, the other up the Kuti valley to Jyolingkong. Altitudes marked with a
        tilde come from a single source and we have not been able to confirm them
        against a second one. A leg we have not checked recently shows as not confirmed
        rather than keeping its last reading, because an old yes is not a yes.
      </p>
    </div>
  );
}

function stationName(slug: string) {
  return STATIONS.find((s) => s.slug === slug)?.name ?? slug;
}
