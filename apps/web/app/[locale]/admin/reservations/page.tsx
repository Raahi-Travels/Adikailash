import { Caution, Departures as CalendarIcon, Group } from "@/components/icons";
import { Link } from "@/i18n/navigation";
import { adminGet } from "@/lib/admin-api";
import { STATE_TONE, stateLabel, type ReservationQueue } from "@/lib/reservations";

/**
 * The reservation queue.
 *
 * Doc 09's Phase 2 exit condition is that "every reserved group has a visible state,
 * payment trail, accepted terms, preparation owner and next action". This page is
 * the staff half of visible, and it is ordered by what needs a person first:
 * unowned, then expired holds, then overdue actions.
 *
 * An expired hold ranks above an overdue action on purpose. It is occupying capacity
 * on a departure that somebody else could be using, and nobody has decided anything.
 */

export const dynamic = "force-dynamic";

const FILTERS = [
  { key: undefined, label: "Everything" },
  { key: "held", label: "Held" },
  { key: "confirmed", label: "Confirmed" },
  { key: "preparing", label: "Preparing" },
] as const;

function money(amount: string | number, currency = "INR") {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(Number(amount));
}

function shortDate(iso: string | null) {
  if (!iso) return null;
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  }).format(new Date(iso));
}

export default async function ReservationsPage({
  searchParams,
}: PageProps<"/[locale]/admin/reservations">) {
  const sp = await searchParams;
  const state = typeof sp.state === "string" ? sp.state : undefined;
  const unassigned = sp.filter === "unassigned";

  const query = new URLSearchParams();
  if (state) query.set("state", state);
  if (unassigned) query.set("unassigned", "true");

  const queue = await adminGet<ReservationQueue>(
    `/admin/reservations${query.size ? `?${query}` : ""}`,
  );

  return (
    <>
      <h1 className="text-2xl font-medium">Reservations</h1>
      <p className="mt-3 max-w-[70ch] text-[15px] leading-relaxed text-tone-body">
        Sorted by what needs a person first: reservations nobody owns, then holds that
        have expired, then overdue actions. An expired hold is capacity somebody else
        could be using while nobody has decided anything.
      </p>

      {queue === null && (
        <p className="mt-8 rounded-lg bg-tone-raised px-5 py-4 text-[15px] ring-1 ring-tone-line">
          Could not load reservations. Either the API is unreachable, or your account
          does not have a reservations role.
        </p>
      )}

      {queue && (
        <>
          <div className="mt-8 flex flex-wrap items-center gap-2">
            {FILTERS.map((f) => {
              const active = state === f.key;
              return (
                <a
                  key={f.label}
                  href={f.key ? `?state=${f.key}` : "?"}
                  className={`rounded-full px-4 py-1.5 text-sm transition-colors ${
                    active
                      ? "bg-gold text-midnight"
                      : "text-tone-body ring-1 ring-tone-line hover:text-tone-strong"
                  }`}
                  aria-current={active ? "page" : undefined}
                >
                  {f.label}
                </a>
              );
            })}
            <a
              href="?filter=unassigned"
              className={`rounded-full px-4 py-1.5 text-sm transition-colors ${
                unassigned
                  ? "bg-gold text-midnight"
                  : "text-tone-body ring-1 ring-tone-line hover:text-tone-strong"
              }`}
            >
              Nobody owns
              <span className="ml-2 opacity-60">{queue.unassigned_count}</span>
            </a>
          </div>

          {queue.expired_hold_count > 0 && (
            <p className="mt-6 flex items-center gap-2.5 rounded-lg bg-saffron/12 px-5 py-3.5 text-[15px] ring-1 ring-saffron/25">
              <Caution className="size-5 shrink-0 text-saffron" />
              {queue.expired_hold_count === 1
                ? "One hold has expired and is still holding places."
                : `${queue.expired_hold_count} holds have expired and are still holding places.`}
            </p>
          )}

          {queue.reservations.length === 0 ? (
            <p className="mt-10 text-[15px] text-tone-body">
              {state || unassigned
                ? "Nothing matches that filter."
                : "No reservations yet. They appear here as soon as one is opened."}
            </p>
          ) : (
            <div className="mt-8">
              {queue.reservations.map((r) => (
                <article
                  key={r.id}
                  className={`border-t border-tone-line py-6 ${
                    r.coordinator === null ? "border-l-2 border-l-saffron/60 pl-4" : ""
                  }`}
                >
                  <div className="flex flex-wrap items-baseline gap-x-4 gap-y-2">
                    <h2 className="text-lg">
                      <Link
                        href={`/admin/reservations/${r.id}`}
                        className="transition-colors hover:text-gold"
                      >
                        {r.reference}
                      </Link>
                    </h2>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs ring-1 ${STATE_TONE[r.state] ?? "text-tone-body ring-tone-line"}`}
                    >
                      {stateLabel(r.state)}
                    </span>
                    {r.coordinator === null && (
                      <span className="rounded-full bg-saffron/15 px-2.5 py-0.5 text-xs text-saffron ring-1 ring-saffron/30">
                        Nobody owns this
                      </span>
                    )}
                    {r.hold_expired && (
                      <span className="flex items-center gap-1.5 rounded-full bg-status-suspended/12 px-2.5 py-0.5 text-xs text-status-suspended ring-1 ring-status-suspended/25">
                        <Caution className="size-3.5" />
                        Hold expired
                      </span>
                    )}
                    {r.is_overdue && (
                      <span className="rounded-full bg-status-suspended/12 px-2.5 py-0.5 text-xs text-status-suspended ring-1 ring-status-suspended/25">
                        Action overdue
                      </span>
                    )}
                    <span className="ml-auto text-sm text-tone-muted">
                      {r.coordinator ?? "Unassigned"}
                    </span>
                  </div>

                  <p className="mt-2 text-[15px] text-tone-body">
                    {r.group_lead_name ?? "No group lead named"}
                    {r.journey_name ? ` · ${r.journey_name}` : ""}
                  </p>

                  <dl className="mt-3 flex flex-wrap gap-x-7 gap-y-1.5 text-sm text-tone-body">
                    <div className="flex items-center gap-2">
                      <CalendarIcon className="size-4 text-tone-muted" />
                      <dt className="sr-only">Departure</dt>
                      <dd>{shortDate(r.start_date) ?? "Date to be confirmed"}</dd>
                    </div>
                    <div className="flex items-center gap-2">
                      <Group className="size-4 text-tone-muted" />
                      <dt className="sr-only">Party</dt>
                      <dd
                        className={
                          r.travellers_named < r.party_size
                            ? "text-saffron/90"
                            : undefined
                        }
                      >
                        {r.travellers_named} of {r.party_size} named
                      </dd>
                    </div>
                    <div>
                      <dt className="sr-only">Money</dt>
                      <dd>
                        {money(r.amount_received)} of {money(r.agreed_amount)}
                        {Number(r.balance_outstanding) > 0 && (
                          <span className="text-tone-muted">
                            {" "}
                            · {money(r.balance_outstanding)} outstanding
                          </span>
                        )}
                      </dd>
                    </div>
                  </dl>

                  {r.next_action && (
                    <p
                      className={`mt-3 text-sm ${
                        r.is_overdue ? "text-status-suspended" : "text-tone-muted"
                      }`}
                    >
                      Next: {r.next_action}
                      {r.next_action_due_at
                        ? `, due ${shortDate(r.next_action_due_at)}`
                        : ""}
                    </p>
                  )}
                </article>
              ))}
            </div>
          )}
        </>
      )}
    </>
  );
}
