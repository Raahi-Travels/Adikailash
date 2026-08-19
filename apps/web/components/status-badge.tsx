import { getTranslations } from "next-intl/server";

import type { RouteStatus } from "@/lib/api";

/**
 * Status chips.
 *
 * Doc 02: status "must remain readable and never rely on colour alone". So every chip
 * on this site carries a written label and a glyph whose *shape* differs per state.
 * Colour is the third signal and never the first, which is what keeps the thing
 * working in greyscale, at 2% zoom on a bright phone in daylight, and for the eight
 * percent of men who will not separate the teal from the saffron.
 *
 * Two exports: `StatusChip` is the presentational shape, used anywhere a state needs
 * a label (a weather reading, a road closure row); `StatusBadge` is the translated,
 * route-status-aware wrapper built on it.
 */

export type ChipTone =
  | "open"
  | "limited"
  | "suspended"
  | "done"
  | "unverified";

/**
 * Every value repeated per tone rather than composed from the tone name, because
 * Tailwind's scanner reads whole class strings out of the source: `text-status-${t}`
 * generates nothing at all and the chip renders in the inherited colour.
 *
 * The ink is nudged 12% toward the register's strong ink rather than used raw.
 * The `--color-status-*` values were solved against the page ground, and a chip
 * usually sits on `--color-tone-raised`, which is a step lighter on the dark
 * register and a step lighter again on the light one. Measured: `suspended` on
 * himalayan is 4.18:1 raw, which fails a 15px label; at 88% it clears. Mixing
 * toward `tone-strong` rather than toward white is what makes one expression work
 * in both registers, since strong is snow on navy and ink on cream.
 */
const TONE: Record<ChipTone, { ink: string; ring: string }> = {
  open: { ink: "var(--color-status-open)", ring: "ring-status-open/35" },
  limited: { ink: "var(--color-status-limited)", ring: "ring-status-limited/35" },
  suspended: { ink: "var(--color-status-suspended)", ring: "ring-status-suspended/35" },
  done: { ink: "var(--color-status-done)", ring: "ring-status-done/35" },
  unverified: { ink: "var(--color-status-unverified)", ring: "ring-status-unverified/35" },
};

const ACCESS_TONE: Record<string, ChipTone> = {
  open: "open",
  limited: "limited",
  permit_pending: "limited",
  suspended: "suspended",
  closed: "suspended",
  not_in_season: "done",
  unverified: "unverified",
};

export type ChipShape = "tick" | "cross" | "warn" | "clock" | "ring";

/** Shapes differ per state so the chip survives greyscale and colour blindness. */
export function ChipGlyph({ shape }: { shape: ChipShape }) {
  const common = {
    viewBox: "0 0 12 12",
    className: "size-3.5 shrink-0",
    "aria-hidden": true as const,
  };
  if (shape === "clock") {
    return (
      <svg {...common}>
        <circle cx="6" cy="6" r="5" fill="none" stroke="currentColor" strokeWidth="1.4" />
        <path d="M6 3.2v3.2l2 1.2" stroke="currentColor" strokeWidth="1.4" fill="none" />
      </svg>
    );
  }
  if (shape === "tick") {
    return (
      <svg {...common}>
        <path
          d="M2.5 6.4l2.3 2.3 4.7-5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>
    );
  }
  if (shape === "cross") {
    return (
      <svg {...common}>
        <path
          d="M3 3l6 6M9 3l-6 6"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>
    );
  }
  if (shape === "ring") {
    return (
      <svg {...common}>
        <circle
          cx="6"
          cy="6"
          r="4.4"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeDasharray="2.4 2.4"
        />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <path
        d="M6 1.6l4.6 8H1.4z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * The chip.
 *
 * `--radius-pill` and `.type-meta`, so it reads at 15px, which is the floor for this
 * site and comfortably above the 12px these used to be. The hairline is a `ring`
 * rather than a border and sits at 0.35 alpha of an already-muted status hue, which
 * lands well under the 0.20 white-alpha ceiling that makes an edge start looking
 * like a border.
 */
export function StatusChip({
  tone,
  shape,
  children,
  className = "",
}: {
  tone: ChipTone;
  shape: ChipShape;
  children: React.ReactNode;
  className?: string;
}) {
  const t = TONE[tone];
  return (
    <span
      style={{ color: `color-mix(in oklab, ${t.ink} 88%, var(--color-tone-strong))` }}
      className={`type-meta inline-flex items-center gap-2 rounded-pill px-3 py-1.5 font-medium ring-1 ${t.ring} ${className}`}
    >
      <ChipGlyph shape={shape} />
      <span>{children}</span>
    </span>
  );
}

const ACCESS_KEY: Record<string, string> = {
  open: "open",
  limited: "limited",
  permit_pending: "permitPending",
  suspended: "suspended",
  closed: "closed",
  not_in_season: "notInSeason",
  unverified: "unverified",
};

/**
 * The label is composed here from `access` + `freshness` rather than using the
 * API's `label` string, which is English only.
 *
 * The API keeps returning that string for non-UI consumers (exports, messages), but
 * a Hindi page showing an English status badge would undercut the whole point of
 * treating Devanagari as first-class.
 */
export async function StatusBadge({
  status,
  className = "",
}: {
  status: Pick<RouteStatus, "access" | "label" | "freshness">;
  className?: string;
}) {
  const t = await getTranslations("status");
  const stale = status.freshness === "stale";
  const tone: ChipTone = stale
    ? "unverified"
    : (ACCESS_TONE[status.access] ?? "unverified");

  const shape: ChipShape = stale
    ? "clock"
    : status.access === "open"
      ? "tick"
      : status.access === "suspended" || status.access === "closed"
        ? "cross"
        : "warn";

  const base = t(ACCESS_KEY[status.access] ?? "unverified");
  const label =
    status.freshness === "stale"
      ? `${base}, ${t("notRecentlyVerified")}`
      : status.freshness === "due_for_check"
        ? `${base}, ${t("recheckDue")}`
        : base;

  return (
    <StatusChip tone={tone} shape={shape} className={className}>
      {label}
    </StatusChip>
  );
}
