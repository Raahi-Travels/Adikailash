import { adminGet } from "@/lib/admin-api";

/**
 * Contribution by acquisition source.
 *
 * Doc 07: "Do not report return on ad spend using gross booking value alone when
 * supplier costs, refunds and conditional reservations materially affect the
 * business." So the column that decides the ordering is contribution, and gross sits
 * beside it in a lighter weight — present, because you cannot check the arithmetic
 * without it, and never the number the eye lands on.
 *
 * The unattributed row is deliberately not hidden. When it is large it is the most
 * important line on the page, and a table of five neat channels is exactly what makes
 * somebody miss it.
 */

export const dynamic = "force-dynamic";

type Source = {
  source: string;
  leads: number;
  earning_reservations: number;
  conditional_reservations: number;
  gross_agreed: string;
  supplier_cost: string;
  refunded: string;
  contribution: string;
  contribution_display: string;
  contribution_margin_percent: string | null;
  conditional_value: string;
  spend: string | null;
  cost_per_qualified_lead: string | null;
  acquisition_share_of_contribution: string | null;
  is_low_confidence: boolean;
  caveats: string[];
};

type Report = {
  attribution_model: string;
  sources: Source[];
  total_contribution_display: string;
  total_conditional_value: string;
  unattributed_lead_share_percent: string | null;
  unattributed_contribution_share_percent: string | null;
  unmatched_spend_channels: string[];
};

export default async function AttributionPage() {
  const report = await adminGet<Report>("/admin/attribution");
  if (!report) {
    return (
      <>
        <h1 className="text-2xl font-medium">Where the business comes from</h1>
        <p className="mt-4 text-[15px] text-ink-inverse/60">
          Could not load the report. This needs a finance or founder role.
        </p>
      </>
    );
  }

  return (
    <>
      <h1 className="text-2xl font-medium">Where the business comes from</h1>
      <p className="mt-3 max-w-[72ch] text-[15px] leading-relaxed text-ink-inverse/65">
        Contribution, not revenue. Supplier cost and refunds are taken off, and
        anything still on hold is kept separate. A channel that books the most can
        earn the least, and ranking on gross would send a season at the wrong one.
      </p>

      <dl className="mt-6 flex flex-wrap gap-x-10 gap-y-3 text-sm">
        <div>
          <dt className="text-ink-inverse/45">Total contribution</dt>
          <dd className="mt-0.5 text-lg">{report.total_contribution_display}</dd>
        </div>
        <div>
          <dt className="text-ink-inverse/45">On hold, not counted</dt>
          <dd className="mt-0.5 text-lg">{report.total_conditional_value}</dd>
        </div>
        <div>
          <dt className="text-ink-inverse/45">Unattributed</dt>
          <dd className="mt-0.5 text-lg">
            {report.unattributed_contribution_share_percent ?? "n/a"}% of contribution
            <span className="ml-2 text-sm text-ink-inverse/45">
              ({report.unattributed_lead_share_percent ?? "n/a"}% of leads)
            </span>
          </dd>
        </div>
        <div>
          <dt className="text-ink-inverse/45">Model</dt>
          <dd className="mt-0.5 text-lg">{report.attribution_model}</dd>
        </div>
      </dl>

      {report.unmatched_spend_channels.length > 0 && (
        <p className="mt-5 rounded-md bg-status-limited/10 px-4 py-3 text-sm ring-1 ring-status-limited/25">
          Spend recorded against {report.unmatched_spend_channels.join(", ")}, which no
          lead ever came from. Almost always a typo in the channel name, until it is
          fixed, every other channel looks better than it is.
        </p>
      )}

      <div className="mt-8 overflow-x-auto">
        <table className="w-full min-w-[820px] text-sm">
          <thead className="text-left text-xs text-ink-inverse/45">
            <tr className="border-b border-white/10">
              <th className="py-2 pr-4 font-normal">Source</th>
              <th className="py-2 pr-4 text-right font-normal">Leads</th>
              <th className="py-2 pr-4 text-right font-normal">Bookings</th>
              <th className="py-2 pr-4 text-right font-normal">Contribution</th>
              <th className="py-2 pr-4 text-right font-normal">Margin</th>
              <th className="py-2 pr-4 text-right font-normal">Gross</th>
              <th className="py-2 pr-4 text-right font-normal">Spend</th>
              <th className="py-2 text-right font-normal">Spend / contribution</th>
            </tr>
          </thead>
          <tbody>
            {report.sources.map((s) => (
              <tr key={s.source} className="border-b border-white/[0.06] align-top">
                <td className="py-3 pr-4">
                  {s.source}
                  {s.is_low_confidence && (
                    <span className="ml-2 text-xs text-status-limited">
                      too few to trust
                    </span>
                  )}
                  {s.caveats.map((c, i) => (
                    <p
                      key={i}
                      className="mt-1 max-w-[46ch] text-xs leading-relaxed text-ink-inverse/45"
                    >
                      {c}
                    </p>
                  ))}
                </td>
                <td className="py-3 pr-4 text-right tabular-nums">{s.leads}</td>
                <td className="py-3 pr-4 text-right tabular-nums">
                  {s.earning_reservations}
                  {s.conditional_reservations > 0 && (
                    <span className="text-ink-inverse/40">
                      {" "}
                      +{s.conditional_reservations} held
                    </span>
                  )}
                </td>
                {/* The one the eye should land on. */}
                <td className="py-3 pr-4 text-right text-[15px] tabular-nums">
                  {s.contribution_display}
                </td>
                <td className="py-3 pr-4 text-right tabular-nums text-ink-inverse/70">
                  {s.contribution_margin_percent ?? "n/a"}%
                </td>
                {/* Present so the arithmetic can be checked, never the headline. */}
                <td className="py-3 pr-4 text-right tabular-nums text-ink-inverse/40">
                  {s.gross_agreed}
                </td>
                <td className="py-3 pr-4 text-right tabular-nums text-ink-inverse/70">
                  {s.spend ?? "n/a"}
                </td>
                <td className="py-3 text-right tabular-nums text-ink-inverse/70">
                  {s.acquisition_share_of_contribution
                    ? `${s.acquisition_share_of_contribution}%`
                    : "n/a"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-6 max-w-[72ch] text-xs leading-relaxed text-ink-inverse/40">
        Supplier cost is apportioned per traveller across each departure, so
        contribution is an estimate. &ldquo;n/a&rdquo; means unknown, never zero. A channel with
        no recorded spend is one nobody has measured, not one that is free.
      </p>
    </>
  );
}
