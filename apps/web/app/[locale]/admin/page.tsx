import { StatusBadge } from "@/components/status-badge";
import { Link } from "@/i18n/navigation";
import { api, type Locale, type LiveStatus } from "@/lib/api";

/**
 * Operations overview.
 *
 * Doc 06: "The default internal view should prioritise exceptions and deadlines
 * rather than decorative analytics." So this leads with what is wrong: stale
 * verifications and segments blocking sale. A green all-clear is the boring case and
 * gets one line.
 */
export default async function AdminOverview({ params }: PageProps<"/[locale]/admin">) {
  const { locale } = await params;
  const status: LiveStatus | null = await api.status(locale as Locale);

  const stale = status?.routes.filter((r) => r.freshness !== "verified") ?? [];
  const blocking = status?.routes.filter((r) => r.blocks_sale) ?? [];
  const staleWeather = status?.weather.filter((w) => w.is_stale) ?? [];

  return (
    <>
      <h1 className="text-2xl font-medium">Needs attention</h1>

      {status === null && (
        <p className="mt-6 rounded-lg bg-status-suspended/15 px-5 py-4 text-[15px] ring-1 ring-status-suspended/30">
          The API is unreachable. Nothing below can be trusted until it returns.
        </p>
      )}

      {status && stale.length === 0 && blocking.length === 0 && staleWeather.length === 0 && (
        <p className="mt-6 text-[15px] text-ink-inverse/65">
          Every published segment is within its verification window.
        </p>
      )}

      {blocking.length > 0 && (
        <section className="mt-8">
          <h2 className="text-sm font-medium uppercase tracking-[0.12em] text-ink-inverse/55">
            Blocking sale
          </h2>
          <ul className="mt-4 divide-y divide-white/10 border-y border-white/10">
            {blocking.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 py-3.5">
                <div>
                  <p className="text-[15px]">{r.segment_name}</p>
                  <p className="mt-0.5 text-sm text-ink-inverse/55">
                    Departures on this segment cannot take payment.
                  </p>
                </div>
                <StatusBadge status={r} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {stale.length > 0 && (
        <section className="mt-10">
          <h2 className="text-sm font-medium uppercase tracking-[0.12em] text-ink-inverse/55">
            Overdue verification
          </h2>
          <ul className="mt-4 divide-y divide-white/10 border-y border-white/10">
            {stale.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 py-3.5">
                <div>
                  <p className="text-[15px]">{r.segment_name}</p>
                  <p className="mt-0.5 text-sm text-ink-inverse/55">
                    Due{" "}
                    {new Date(r.next_verification_due).toLocaleString("en-IN", {
                      dateStyle: "medium",
                      timeStyle: "short",
                      timeZone: "Asia/Kolkata",
                    })}{" "}
                    IST
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <StatusBadge status={r} />
                  <Link href="/admin/status" className="text-sm text-gold">
                    Re-verify
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {staleWeather.length > 0 && (
        <section className="mt-10">
          <h2 className="text-sm font-medium uppercase tracking-[0.12em] text-ink-inverse/55">
            Weather out of date
          </h2>
          <ul className="mt-4 divide-y divide-white/10 border-y border-white/10">
            {staleWeather.map((w) => (
              <li key={w.id} className="py-3.5 text-[15px]">
                {w.place}
                <span className="ml-3 text-sm text-ink-inverse/55">
                  last seen{" "}
                  {new Date(w.observed_at).toLocaleString("en-IN", {
                    dateStyle: "medium",
                    timeZone: "Asia/Kolkata",
                  })}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="mt-12 border-t border-white/10 pt-6 text-sm leading-relaxed text-ink-inverse/50">
        Payments are disabled platform-wide until the operating partner, deposit and
        refund decisions (O2 to O4) are approved. Until then no departure can take
        money regardless of its state.
      </p>
    </>
  );
}
