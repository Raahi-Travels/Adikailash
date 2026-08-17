"use client";

import { motion, useReducedMotion } from "motion/react";

import {
  HIGHEST,
  legLabel,
  legStatus,
  STATE_COLOUR,
  STATIONS,
  type LegState,
  type Station,
} from "@/lib/route-profile";

/**
 * The road as elevation, with live status on each leg.
 *
 * This replaces the four-cell bordered grid that used to carry route status. That
 * version answered "is something open" with a badge; this one answers the question a
 * traveller is actually asking, which is "how high does this go and where does it
 * stop being fine". Altitude is the risk on this route, and a number in a table does
 * not communicate 910 m to 4,570 m the way a line does.
 *
 * **Motion is the argument, not decoration.** The legs draw in order of travel, so
 * the reveal traces the climb. That is the one thing this diagram has to say.
 *
 * **The diagram degrades before it disappears.** The terrain fill and the grey
 * baseline are plain SVG with no motion attached, so a reader with JavaScript off,
 * or on a headless renderer, still sees the profile. The coloured legs animate over
 * a shape that is already there rather than gating it behind a transition. Below
 * `md` the drawing is hidden entirely and the list underneath carries everything:
 * a 1,000-unit-wide diagram on a 390 px phone is a picture of a diagram, not a
 * diagram, and most of this audience is on a phone.
 */

/* Plot geometry. Altitudes map to y, stations to x. Trunk stations are evenly
   spaced rather than spaced by road distance: the entire altitude gain happens in
   the last quarter of the drive, so true distance spacing crushes five of the seven
   stations into a corner and makes the diagram unreadable. The x axis is therefore
   sequence, and no distance is claimed anywhere in the labels. */
const PLOT_TOP = 60;
const PLOT_BOTTOM = 280;
const ALT_MIN = 700;
const ALT_MAX = 4800;

const X: Record<string, number> = {
  pithoragarh: 40,
  dharchula: 190,
  tawaghat: 340,
  budhi: 490,
  gunji: 640,
  nabhidhang: 830,
  jyolingkong: 960,
};

function y(altitudeM: number) {
  const t = (altitudeM - ALT_MIN) / (ALT_MAX - ALT_MIN);
  return PLOT_BOTTOM - t * (PLOT_BOTTOM - PLOT_TOP);
}

function point(station: Station) {
  return { x: X[station.slug], y: y(station.altitudeM) };
}

/**
 * Hand-authored control points, one per leg.
 *
 * Two shapes here are load-bearing rather than cosmetic. The first leg *descends*:
 * Pithoragarh sits at 1,645 m and the road drops to 910 m in the Kali gorge before
 * climbing at all. Every operator map draws this as a continuous ascent and it
 * misrepresents the drive. And the Gunji arms leave at visibly different angles
 * because the route genuinely forks there, the Kuti valley holding a moderate
 * gradient for a long stretch before the final climb to Jyolingkong, the Nabhidhang
 * arm climbing more evenly.
 */
const LEG_PATH: Record<string, string> = {
  dharchula: "M40,229 Q115,241 190,269",
  tawaghat: "M190,269 Q265,268 340,258",
  budhi: "M340,258 Q415,236 490,172",
  gunji: "M490,172 Q565,155 640,148",
  nabhidhang: "M640,148 Q730,112 830,89",
  jyolingkong: "M640,148 Q800,142 960,72",
};

/** The full trunk plus the higher arm, used for the static terrain fill. */
const TERRAIN =
  "M40,229 Q115,241 190,269 Q265,268 340,258 Q415,236 490,172 " +
  "Q565,155 640,148 Q800,142 960,72 L960,300 L40,300 Z";

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

export function RouteProfile({
  routes,
  locale,
}: {
  routes: RouteLike[];
  locale: string;
}) {
  const reduce = useReducedMotion();

  const legs = STATIONS.filter((s) => s.from).map((station, index) => {
    const status = legStatus(routes, station);
    const state: LegState = status?.state ?? "unknown";
    return { station, status, state, index };
  });

  return (
    <div>
      {/* The drawing. Decorative in the accessibility tree because the list below
          carries the same facts in a form a screen reader can actually work with;
          duplicating them would read every station twice. */}
      <div className="hidden md:block" aria-hidden="true">
        <svg viewBox="0 0 1000 300" className="w-full">
          <defs>
            <linearGradient id="terrain-fill" x1="0" y1="0" x2="0" y2="1">
              {/* Was 0.16 to 0, which on navy is a rumour rather than a shape. The
                  profile is the one thing this section exists to show. */}
              <stop offset="0%" stopColor="var(--color-gold)" stopOpacity="0.34" />
              <stop offset="55%" stopColor="var(--color-gold)" stopOpacity="0.10" />
              <stop offset="100%" stopColor="var(--color-gold)" stopOpacity="0.02" />
            </linearGradient>
          </defs>

          {/* Elevation grid. Four lines, labelled, so the vertical axis means
              something instead of being a decorative rise. */}
          {[1000, 2000, 3000, 4000].map((metres) => (
            <g key={metres}>
              <line
                x1="40"
                x2="960"
                y1={y(metres)}
                y2={y(metres)}
                stroke="currentColor"
                strokeOpacity="0.16"
                strokeWidth="1"
              />
              {/* Right-hand edge, not the left. On the left they collided with the
                  first station's name and altitude, which sit at the same height by
                  definition: the profile starts there. */}
              <text
                x="962"
                textAnchor="end"
                y={y(metres) - 6}
                className="type-reading"
                fill="currentColor"
                fillOpacity="0.5"
                fontSize="11.5"
              >
                {metres.toLocaleString("en-IN")} m
              </text>
            </g>
          ))}

          {/* Static terrain. Present before any script runs. */}
          <path d={TERRAIN} fill="url(#terrain-fill)" />
          {Object.values(LEG_PATH).map((d) => (
            <path
              key={d}
              d={d}
              fill="none"
              stroke="currentColor"
              strokeOpacity="0.32"
              strokeWidth="1.5"
            />
          ))}

          {/* Live legs, drawn in order of travel so the reveal traces the climb. */}
          {legs.map(({ station, state, index }) => (
            <motion.path
              key={station.slug}
              d={LEG_PATH[station.slug]}
              fill="none"
              stroke={STATE_COLOUR[state]}
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray={state === "unknown" ? "2 6" : undefined}
              initial={reduce ? false : { pathLength: 0 }}
              whileInView={{ pathLength: 1 }}
              viewport={{ once: true, amount: 0.4 }}
              transition={{
                duration: 0.7,
                delay: index * 0.13,
                ease: [0.16, 1, 0.3, 1],
              }}
            />
          ))}

          {STATIONS.map((station, index) => {
            const p = point(station);
            const state = station.from
              ? (legStatus(routes, station)?.state ?? "unknown")
              : "open";
            // Labels sit above their point except where the two fork arms converge, where
            // the lower one would otherwise be written across the upper arm's fill.
            const above = station.slug !== "nabhidhang";
            return (
              <motion.g
                key={station.slug}
                initial={reduce ? false : { opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true, amount: 0.4 }}
                transition={{ duration: 0.35, delay: 0.1 + index * 0.13 }}
              >
                <circle
                  cx={p.x}
                  cy={p.y}
                  r="5"
                  fill="var(--color-midnight)"
                  stroke={STATE_COLOUR[state]}
                  strokeWidth="2.5"
                />
                <text
                  x={p.x}
                  y={above ? p.y - 16 : p.y + 26}
                  textAnchor="middle"
                  fill="currentColor"
                  fontSize="13.5"
                  fontWeight="600"
                >
                  {station.name}
                </text>
                <text
                  x={p.x}
                  y={above ? p.y - 32 : p.y + 42}
                  textAnchor="middle"
                  className="type-reading"
                  fill="currentColor"
                  fillOpacity="0.68"
                  fontSize="12"
                >
                  {station.confidence === "approximate" ? "~" : ""}
                  {station.altitudeM.toLocaleString("en-IN")} m
                </text>
              </motion.g>
            );
          })}
        </svg>
      </div>

      {/* The list. On a phone this is the whole component; on a desktop it carries
          the verification detail the drawing has no room for. Hairlines and space,
          no boxes: the thing this redesign is removing is exactly the bordered grid
          that used to live here. */}
      <ul className="mt-2 md:mt-10">
        {legs.map(({ station, status, state }) => (
          <li
            key={station.slug}
            className="flex flex-wrap items-baseline gap-x-4 gap-y-1 border-t border-tone-line py-3.5"
          >
            <span
              aria-hidden="true"
              className="size-2 shrink-0 self-center rounded-full"
              style={{ background: STATE_COLOUR[state] }}
            />
            <span className="min-w-0 flex-1 text-[15px]">
              {station.from ? stationName(station.from) : ""} to {station.name}
            </span>
            <span className="type-reading text-sm text-tone-muted">
              {station.confidence === "approximate" ? "~" : ""}
              {station.altitudeM.toLocaleString("en-IN")} m
            </span>
            <span
              className="w-28 shrink-0 text-sm"
              style={{ color: STATE_COLOUR[state] }}
            >
              {legLabel(status)}
            </span>
            <span className="type-reading w-24 shrink-0 text-right text-sm text-tone-muted">
              {status ? age(status.verified_at, locale) : "never"}
            </span>
          </li>
        ))}
      </ul>

      <p className="mt-6 max-w-[68ch] text-sm leading-relaxed text-tone-muted">
        The highest ground on this journey is {HIGHEST.name} at about{" "}
        <span className="type-reading">
          {HIGHEST.altitudeM.toLocaleString("en-IN")} m
        </span>
        . Altitudes marked with a tilde come from a single source and we have not been
        able to confirm them against a second one. A leg we have not checked recently
        shows as not confirmed rather than keeping its last reading, because an old
        yes is not a yes.
      </p>
    </div>
  );
}

function stationName(slug: string) {
  return STATIONS.find((s) => s.slug === slug)?.name ?? slug;
}
