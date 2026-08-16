import { revalidatePath } from "next/cache";

import { adminGet, adminPost } from "@/lib/admin-api";

/**
 * Acquisition spend, entered by hand.
 *
 * The one input the contribution report cannot derive. Leads, reservations, supplier
 * cost and refunds are all by-products of running the business; what was spent to get
 * somebody is not, so it has to be typed.
 *
 * Deliberately not pulled from an ad platform API. A monthly figure off an invoice is
 * more accurate than a mis-mapped API field, and it does not tie a three-person team
 * to a provider before they have decided whether to advertise at all.
 *
 * **An empty table is the expected state**, not a gap to apologise for. The founders
 * are organic-first, and cost-per-lead reports "unknown" rather than zero until a row
 * exists here — zero would read as "free".
 */

export const dynamic = "force-dynamic";

const FIELD =
  "mt-1 w-full rounded-md bg-white/[0.06] px-2.5 py-1.5 text-sm text-ink-inverse ring-1 ring-white/15 focus:outline-none focus:ring-2 focus:ring-gold";

type Spend = {
  id: number;
  channel: string;
  campaign: string;
  period_start: string;
  period_end: string;
  amount: string;
  currency: string;
  note: string | null;
  recorded_by: string | null;
};

async function record(formData: FormData) {
  "use server";
  await adminPost("/admin/acquisition-spend", {
    channel: String(formData.get("channel")),
    campaign: String(formData.get("campaign") || "") || null,
    period_start: String(formData.get("period_start")),
    period_end: String(formData.get("period_end")),
    amount: String(formData.get("amount")),
    note: String(formData.get("note") || "") || null,
  });
  revalidatePath("/admin/spend");
}

export default async function SpendPage() {
  const rows = (await adminGet<Spend[]>("/admin/acquisition-spend")) ?? [];

  return (
    <>
      <h1 className="text-2xl font-medium">Acquisition spend</h1>
      <p className="mt-3 max-w-[70ch] text-[15px] leading-relaxed text-ink-inverse/65">
        What was actually spent, per channel, per period. Everything else the
        contribution report needs is a by-product of running the business; this is the
        one number that has to be typed off an invoice.
      </p>

      <form
        action={record}
        className="mt-8 grid max-w-3xl gap-4 rounded-lg bg-white/[0.04] px-5 py-5 ring-1 ring-white/10 sm:grid-cols-2"
      >
        <label className="block">
          <span className="text-xs text-ink-inverse/50">Channel</span>
          <input
            name="channel"
            required
            placeholder="instagram"
            className={FIELD}
          />
          <span className="mt-1 block text-xs leading-relaxed text-ink-inverse/40">
            Must match the source leads arrive with, or it attributes to nothing. The
            report lists any that do not match.
          </span>
        </label>
        <label className="block">
          <span className="text-xs text-ink-inverse/50">Campaign (optional)</span>
          <input name="campaign" className={FIELD} />
        </label>
        <label className="block">
          <span className="text-xs text-ink-inverse/50">Period start</span>
          <input name="period_start" type="date" required className={FIELD} />
        </label>
        <label className="block">
          <span className="text-xs text-ink-inverse/50">Period end</span>
          <input name="period_end" type="date" required className={FIELD} />
        </label>
        <label className="block">
          <span className="text-xs text-ink-inverse/50">Amount (INR)</span>
          <input name="amount" type="number" min="0" step="1" required className={FIELD} />
        </label>
        <label className="block">
          <span className="text-xs text-ink-inverse/50">What it bought</span>
          <input name="note" placeholder="Boost for the May departure" className={FIELD} />
          <span className="mt-1 block text-xs leading-relaxed text-ink-inverse/40">
            The only field that will still explain a surprising number next season.
          </span>
        </label>
        <div className="sm:col-span-2">
          <button
            type="submit"
            className="rounded-full bg-gold px-4 py-2 text-sm font-medium text-midnight transition-transform active:scale-[0.98]"
          >
            Record
          </button>
        </div>
      </form>

      {rows.length === 0 ? (
        <p className="mt-8 max-w-[70ch] text-[15px] leading-relaxed text-ink-inverse/55">
          Nothing recorded, which is the expected state while acquisition is organic.
          Cost per lead reads as unknown rather than zero until a row exists here,
          zero would read as free.
        </p>
      ) : (
        <table className="mt-8 w-full max-w-3xl text-sm">
          <thead className="text-left text-xs text-ink-inverse/45">
            <tr className="border-b border-white/10">
              <th className="py-2 pr-4 font-normal">Channel</th>
              <th className="py-2 pr-4 font-normal">Period</th>
              <th className="py-2 pr-4 text-right font-normal">Amount</th>
              <th className="py-2 font-normal">Note</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-white/[0.06] align-top">
                <td className="py-3 pr-4">
                  {r.channel}
                  {r.campaign && (
                    <span className="text-ink-inverse/40"> · {r.campaign}</span>
                  )}
                </td>
                <td className="py-3 pr-4 text-ink-inverse/70">
                  {r.period_start} to {r.period_end}
                </td>
                <td className="py-3 pr-4 text-right tabular-nums">
                  {r.currency} {r.amount}
                </td>
                <td className="py-3 text-ink-inverse/60">
                  {r.note}
                  {r.recorded_by && (
                    <span className="block text-xs text-ink-inverse/35">
                      {r.recorded_by}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
