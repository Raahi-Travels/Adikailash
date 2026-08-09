import { getTranslations } from "next-intl/server";

import type { RouteStatus } from "@/lib/api";

/**
 * Status badge.
 *
 * Doc 02: status "must remain readable and never rely on colour alone". So every
 * badge carries its own text label from the API, plus a glyph. Colour is the third
 * signal, not the first.
 */

const TONE: Record<string, { dot: string; text: string; ring: string }> = {
  open: { dot: "bg-status-open", text: "text-status-open", ring: "ring-status-open/30" },
  limited: {
    dot: "bg-status-limited",
    text: "text-status-limited",
    ring: "ring-status-limited/30",
  },
  permit_pending: {
    dot: "bg-status-limited",
    text: "text-status-limited",
    ring: "ring-status-limited/30",
  },
  suspended: {
    dot: "bg-status-suspended",
    text: "text-status-suspended",
    ring: "ring-status-suspended/30",
  },
  closed: {
    dot: "bg-status-suspended",
    text: "text-status-suspended",
    ring: "ring-status-suspended/30",
  },
  not_in_season: {
    dot: "bg-status-done",
    text: "text-status-done",
    ring: "ring-status-done/30",
  },
  unverified: {
    dot: "bg-status-unverified",
    text: "text-status-unverified",
    ring: "ring-status-unverified/30",
  },
};

/** Shapes differ per state so the badge survives greyscale and colour blindness. */
function Glyph({ access, stale }: { access: string; stale: boolean }) {
  if (stale) {
    return (
      <svg viewBox="0 0 12 12" className="size-3 shrink-0" aria-hidden="true">
        <circle cx="6" cy="6" r="5" fill="none" stroke="currentColor" strokeWidth="1.4" />
        <path d="M6 3.2v3.2l2 1.2" stroke="currentColor" strokeWidth="1.4" fill="none" />
      </svg>
    );
  }
  if (access === "open") {
    return (
      <svg viewBox="0 0 12 12" className="size-3 shrink-0" aria-hidden="true">
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
  if (access === "suspended" || access === "closed") {
    return (
      <svg viewBox="0 0 12 12" className="size-3 shrink-0" aria-hidden="true">
        <path
          d="M3 3l6 6M9 3l-6 6"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 12 12" className="size-3 shrink-0" aria-hidden="true">
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
  const tone = stale ? TONE.unverified : (TONE[status.access] ?? TONE.unverified);

  const base = t(ACCESS_KEY[status.access] ?? "unverified");
  const label =
    status.freshness === "stale"
      ? `${base}, ${t("notRecentlyVerified")}`
      : status.freshness === "due_for_check"
        ? `${base}, ${t("recheckDue")}`
        : base;

  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm ring-1 ${tone.text} ${tone.ring} ${className}`}
    >
      <Glyph access={status.access} stale={stale} />
      <span className="font-medium">{label}</span>
    </span>
  );
}
