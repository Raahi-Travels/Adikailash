import { Caution } from "@/components/icons";
import { adminGet } from "@/lib/admin-api";

/**
 * Vendor performance, for planning next season.
 *
 * Doc 06 permits a score "to assist planning" on the condition that serious incidents
 * and manual judgement stay visible rather than hidden in an average. This page keeps
 * that condition twice over:
 *
 *   - The score is capped in the API while a concern is open, so it cannot read as
 *     fine over the top of an incident. That is arithmetic, not layout.
 *   - The concerns render above the number, not beside it. What is read first is what
 *     is read.
 *
 * The list is ordered by recommendation, then by score — never by score alone. A
 * score-ordered table is a league table, and a league table is what somebody scans
 * instead of reading.
 */

export const dynamic = "force-dynamic";

type Vendor = {
  supplier_id: number;
  name: string;
  recommendation: string;
  headline: string;
  blocking_concerns: string[];
  notes: string[];
  ratings: Record<string, string | null>;
  traveller_average: string | null;
  traveller_count: number;
  review_count: number;
  incident_count: number;
  cost_variance: string;
  cost_outstanding: string;
  cost_settled: boolean;
  is_rateable: boolean;
  reliability_score: number | null;
  score_explanation: string[];
  is_score_capped: boolean;
};

const LABEL: Record<string, string> = {
  do_not_use: "Do not use",
  review_before_rebooking: "Read before rebooking",
  use_again: "Use again",
  too_early_to_say: "Too early to say",
};

export default async function VendorsPage() {
  const vendors = (await adminGet<Vendor[]>("/admin/vendors")) ?? [];

  return (
    <>
      <h1 className="text-2xl font-medium">Vendors</h1>
      <p className="mt-3 max-w-[70ch] text-[15px] leading-relaxed text-ink-inverse/65">
        What we know about each supplier after the departures they ran. The score is a
        planning aid and nothing more — anything unresolved caps it, so a good number
        never means there is nothing to read.
      </p>

      {vendors.length === 0 && (
        <p className="mt-8 text-[15px] text-ink-inverse/55">
          No suppliers recorded yet.
        </p>
      )}

      <ul className="mt-8 space-y-5">
        {vendors.map((v) => (
          <li
            key={v.supplier_id}
            className="rounded-lg bg-white/[0.04] px-5 py-5 ring-1 ring-white/10"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <div>
                <p className="text-lg">{v.name}</p>
                <p className="mt-0.5 text-sm text-ink-inverse/50">
                  {LABEL[v.recommendation] ?? v.recommendation} ·{" "}
                  {v.review_count} review{v.review_count === 1 ? "" : "s"}
                  {v.incident_count > 0 && ` · ${v.incident_count} incident(s)`}
                </p>
              </div>
              {v.reliability_score !== null ? (
                <div className="text-right">
                  <p
                    className={`text-3xl tabular-nums ${
                      v.is_score_capped ? "text-status-suspended" : "text-ink-inverse"
                    }`}
                  >
                    {v.reliability_score}
                  </p>
                  {v.is_score_capped && (
                    <p className="text-xs text-status-suspended">capped</p>
                  )}
                </div>
              ) : (
                <p className="text-sm text-ink-inverse/35">no score yet</p>
              )}
            </div>

            {/* Above the number, deliberately. */}
            {v.blocking_concerns.length > 0 && (
              <ul className="mt-4 space-y-2 rounded-md bg-status-suspended/10 px-4 py-3 ring-1 ring-status-suspended/25">
                {v.blocking_concerns.map((c, i) => (
                  <li key={i} className="flex gap-2 text-[15px] leading-relaxed">
                    <Caution className="mt-0.5 size-4 shrink-0 text-status-suspended" />
                    {c}
                  </li>
                ))}
              </ul>
            )}

            <p className="mt-4 text-[15px] leading-relaxed text-ink-inverse/75">
              {v.headline}
            </p>

            {v.notes.map((n, i) => (
              <p key={i} className="mt-2 text-sm leading-relaxed text-ink-inverse/55">
                {n}
              </p>
            ))}

            {v.score_explanation.length > 0 && (
              <details className="mt-4">
                <summary className="cursor-pointer text-xs text-ink-inverse/45">
                  How the score was reached
                </summary>
                <ul className="mt-2 space-y-1">
                  {v.score_explanation.map((e, i) => (
                    <li key={i} className="text-xs leading-relaxed text-ink-inverse/55">
                      {e}
                    </li>
                  ))}
                </ul>
              </details>
            )}

            <p className="mt-4 border-t border-white/10 pt-3 text-xs text-ink-inverse/45">
              {v.traveller_average
                ? `Travellers rate them ${v.traveller_average}/5 from ${v.traveller_count}`
                : "No traveller ratings yet"}
              {" · "}
              {v.cost_settled
                ? `cost variance ${v.cost_variance}`
                : `${v.cost_outstanding} still unpaid, so no cost variance to judge`}
            </p>
          </li>
        ))}
      </ul>
    </>
  );
}
