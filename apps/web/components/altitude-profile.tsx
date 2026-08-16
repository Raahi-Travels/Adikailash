import { Caution } from "@/components/icons";

/**
 * Sleeping altitude across a journey.
 *
 * Phase 5 lists an "interactive 3D terrain and altitude experience". This is the half
 * of that which helps somebody decide, and doc 03's non-goals rule out the other half
 * — "a cinematic 3D homepage that delays essential information". Doc 03 also says of
 * the interactive view: "The text itinerary remains the accessible source of truth."
 * So this sits beside the itinerary rather than replacing it, and every point in the
 * chart is also written out as text below it.
 *
 * **Server-rendered inline SVG, no JavaScript, no chart library.** Doc 02 names the
 * audience as mid-range Android phones on mobile data. It also makes the profile
 * readable by an answer engine, which doc 07 treats as a first-class channel — a
 * canvas chart is invisible to both a crawler and a screen reader.
 *
 * **Nothing here tells the reader whether they should go.** The standing constraint
 * is "no medical clearance, diagnosis or fitness certification, by human or AI", so
 * there is no green tick, no risk badge and no verdict — a reassuring symbol on this
 * page is the thing that talks somebody out of seeing a doctor.
 */

type Point = {
  day: number;
  place: string;
  altitude_m: number;
  x: number;
  y: number;
  is_rest_day: boolean;
};

export type AltitudeProfileData = {
  points: Point[];
  highest_sleeping_altitude_m: number | null;
  total_gain_above_threshold_m: number;
  rest_nights_above_threshold: number;
  guidance_notes: string[];
  guidance_source: string;
  unknown_places: string[];
  is_complete: boolean;
};

const WIDTH = 640;
const HEIGHT = 180;

export function AltitudeProfile({ data }: { data: AltitudeProfileData }) {
  if (data.points.length < 2) return null;

  const line = data.points.map((p) => `${p.x},${p.y}`).join(" ");
  // Closed against the baseline so the shape reads as ground rather than as a graph.
  const area = `${data.points[0].x},${HEIGHT - 28} ${line} ${
    data.points[data.points.length - 1].x
  },${HEIGHT - 28}`;

  return (
    <section className="mt-12">
      <h2 className="font-serif text-2xl">Where you sleep, night by night</h2>
      <p className="mt-3 max-w-[62ch] text-[15px] leading-relaxed text-tone-body">
        Altitude sickness is about where you spend the night, not the highest point you
        touch during the day. This is the sleeping altitude for each night of the
        journey.
      </p>

      <figure className="mt-6 overflow-x-auto">
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="w-full min-w-[520px]"
          role="img"
          aria-label={`Sleeping altitude by night: ${data.points
            .map((p) => `night ${p.day} at ${p.place}, ${p.altitude_m} metres`)
            .join("; ")}`}
        >
          <polygon points={area} className="fill-gold/12" />
          <polyline
            points={line}
            fill="none"
            className="stroke-gold"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          {data.points.map((p) => (
            <g key={`${p.day}-${p.place}`}>
              <circle
                cx={p.x}
                cy={p.y}
                r={p.is_rest_day ? 5 : 3.5}
                className={p.is_rest_day ? "fill-midnight stroke-gold" : "fill-gold"}
                strokeWidth="2"
              />
              <text
                x={p.x}
                y={p.y - 10}
                textAnchor="middle"
                className="fill-current text-[11px] text-tone-body"
              >
                {p.altitude_m.toLocaleString("en-IN")}m
              </text>
              <text
                x={p.x}
                y={HEIGHT - 10}
                textAnchor="middle"
                className="fill-current text-[11px] text-tone-muted"
              >
                {p.place}
              </text>
            </g>
          ))}
        </svg>
        <figcaption className="mt-2 text-xs text-tone-muted">
          A hollow point is a rest night: a second night at the same altitude, which
          is what acclimatisation actually means.
        </figcaption>
      </figure>

      {/*
        The same information as prose. Doc 03: "The text itinerary remains the
        accessible source of truth", and a chart alone is unreadable to a screen
        reader and uncitable by an answer engine.
      */}
      <ul className="mt-6 grid gap-1.5 text-[15px] leading-relaxed text-tone-body sm:grid-cols-2">
        {data.points.map((p) => (
          <li key={`row-${p.day}-${p.place}`}>
            <span className="text-tone-muted">Night {p.day}</span> · {p.place} ·{" "}
            {p.altitude_m.toLocaleString("en-IN")}m
            {p.is_rest_day && <span className="text-tone-muted"> · rest night</span>}
          </li>
        ))}
      </ul>

      {data.guidance_notes.length > 0 && (
        <div className="mt-8 rounded-lg bg-status-limited/10 px-5 py-5 ring-1 ring-status-limited/25">
          <h3 className="flex items-center gap-2 text-sm text-tone-body">
            <Caution className="size-4 shrink-0" />
            How this journey compares with general guidance
          </h3>
          <ul className="mt-3 space-y-2">
            {data.guidance_notes.map((note, i) => (
              <li key={i} className="text-[15px] leading-relaxed text-tone-body">
                {note}
              </li>
            ))}
          </ul>
          {/*
            The attribution is not boilerplate. Without it these read as our medical
            opinion about the reader, which is precisely what we must not give.
          */}
          <p className="mt-4 border-t border-tone-line pt-4 text-sm leading-relaxed text-tone-body">
            {data.guidance_source}
          </p>
        </div>
      )}

      {data.highest_sleeping_altitude_m && (
        <p className="mt-6 text-sm leading-relaxed text-tone-muted">
          The highest you sleep is{" "}
          {data.highest_sleeping_altitude_m.toLocaleString("en-IN")}m
          {data.total_gain_above_threshold_m > 0 && (
            <>
              , with {data.total_gain_above_threshold_m.toLocaleString("en-IN")}m of
              climbing above 3,000m and {data.rest_nights_above_threshold} rest night
              {data.rest_nights_above_threshold === 1 ? "" : "s"} up there
            </>
          )}
          . Talk to us about the pace before you book, and talk to a doctor about
          yourself.
        </p>
      )}
    </section>
  );
}
