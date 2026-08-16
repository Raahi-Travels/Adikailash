import { notFound } from "next/navigation";

import { Caution, Group, Permit, Verified } from "@/components/icons";
import { Link } from "@/i18n/navigation";
import { adminGet } from "@/lib/admin-api";
import { stateLabel } from "@/lib/reservations";

/**
 * The departure manifest.
 *
 * The list somebody reads at a checkpost, and the answer to "can this leave".
 *
 * Blockers and warnings are visually distinct because they mean different things. A
 * blocker stops the departure; a warning is worth chasing and is never a reason to
 * hold a convoy at Dharchula. Rendering them alike is how a readiness screen becomes
 * noise nobody reads, and then the permit gets missed too.
 */

export const dynamic = "force-dynamic";

type Manifest = {
  departure_id: number;
  journey_name: string | null;
  tier_name: string | null;
  start_date: string | null;
  end_date: string | null;
  gateway: string | null;
  state: string;
  operator_name: string | null;
  capacity: number;
  parties: {
    reservation_id: number;
    reference: string;
    state: string;
    group_lead: string | null;
    coordinator: string | null;
    party_size: number;
    travellers: {
      full_name: string;
      role: string;
      date_of_birth: string | null;
      is_senior: boolean;
      has_disclosed_health_information: boolean;
      documents_outstanding: number;
      permit_documents_outstanding: number;
    }[];
    documents_outstanding: number;
    permit_documents_outstanding: number;
    policy_accepted: boolean;
    balance_outstanding: string;
  }[];
  confirmed_parties: number;
  confirmed_travellers: number;
  unresolved_holds: number;
  can_depart: boolean;
  blockers: string[];
  warnings: string[];
};

function when(iso: string | null) {
  if (!iso) return null;
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  }).format(new Date(iso));
}

export default async function ManifestPage({
  params,
}: PageProps<"/[locale]/admin/departures/[id]/manifest">) {
  const { id } = await params;
  const m = await adminGet<Manifest>(`/admin/departures/${id}/manifest`);
  if (!m) notFound();

  return (
    <>
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-2">
        <h1 className="text-2xl font-medium">Manifest</h1>
        <span className="text-sm text-tone-body">
          {m.journey_name} · {m.tier_name}
        </span>
        <span className="ml-auto text-sm text-tone-muted">
          {when(m.start_date)} to {when(m.end_date)}
          {m.gateway ? ` · from ${m.gateway}` : ""}
        </span>
      </div>

      <p className="mt-2 text-sm text-tone-muted">
        Operated by {m.operator_name ?? "nobody yet"} · {m.confirmed_travellers}{" "}
        confirmed traveller{m.confirmed_travellers === 1 ? "" : "s"} in{" "}
        {m.confirmed_parties} part{m.confirmed_parties === 1 ? "y" : "ies"} · capacity{" "}
        {m.capacity}
      </p>

      {/* The verdict, first and unmissable. */}
      <section
        className={`mt-8 rounded-lg px-5 py-5 ring-1 ${
          m.can_depart
            ? "bg-status-open/10 ring-status-open/30"
            : "bg-status-suspended/10 ring-status-suspended/30"
        }`}
      >
        <div className="flex items-center gap-2.5">
          {m.can_depart ? (
            <Verified className="size-5 text-status-open" />
          ) : (
            <Caution className="size-5 text-status-suspended" />
          )}
          <h2 className="text-lg">
            {m.can_depart
              ? "Nothing is stopping this departure"
              : `${m.blockers.length} thing${m.blockers.length === 1 ? "" : "s"} must be fixed before this can leave`}
          </h2>
        </div>
        {m.blockers.length > 0 && (
          <ul className="mt-4 space-y-2">
            {m.blockers.map((b) => (
              <li
                key={b}
                className="flex gap-3 text-[15px] leading-relaxed text-tone-body"
              >
                <span
                  aria-hidden
                  className="mt-2 size-1.5 shrink-0 rounded-full bg-status-suspended"
                />
                {b}
              </li>
            ))}
          </ul>
        )}
      </section>

      {m.warnings.length > 0 && (
        <section className="mt-5 rounded-lg bg-white/[0.04] px-5 py-4 ring-1 ring-tone-line">
          <h2 className="text-[15px] text-tone-body">
            Worth chasing, but not a reason to hold the departure
          </h2>
          <ul className="mt-3 space-y-1.5">
            {m.warnings.map((w) => (
              <li key={w} className="text-sm leading-relaxed text-tone-body">
                {w}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-10">
        <h2 className="font-serif text-xl">Parties</h2>
        {m.parties.length === 0 ? (
          <p className="mt-3 text-[15px] text-tone-body">
            No reservations on this departure yet.
          </p>
        ) : (
          <div className="mt-5">
            {m.parties.map((p) => (
              <article key={p.reservation_id} className="border-t border-tone-line py-5">
                <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                  <h3 className="text-[17px]">
                    <Link
                      href={`/admin/reservations/${p.reservation_id}`}
                      className="transition-colors hover:text-gold"
                    >
                      {p.reference}
                    </Link>
                  </h3>
                  <span className="text-sm text-tone-muted">
                    {stateLabel(p.state)}
                  </span>
                  <span className="text-sm text-tone-body">
                    {p.group_lead ?? "No group lead named"}
                  </span>
                  {!p.policy_accepted && (
                    <span className="text-sm text-saffron/90">Terms not accepted</span>
                  )}
                  <span className="ml-auto text-sm text-tone-muted">
                    {p.coordinator ?? "Unassigned"}
                  </span>
                </div>

                <ul className="mt-3 space-y-1.5">
                  {p.travellers.map((t) => (
                    <li
                      key={t.full_name}
                      className="flex flex-wrap items-center gap-x-4 text-sm"
                    >
                      <Group className="size-4 shrink-0 text-tone-muted" />
                      <span className="text-[15px] text-tone-body">
                        {t.full_name}
                      </span>
                      {t.role === "group_lead" && (
                        <span className="text-xs text-gold">lead</span>
                      )}
                      {t.date_of_birth && (
                        <span className="text-tone-muted">
                          {when(t.date_of_birth)}
                        </span>
                      )}
                      {t.is_senior && <span className="text-tone-muted">elder</span>}
                      {t.has_disclosed_health_information && (
                        <span className="text-saffron/80">health info on file</span>
                      )}
                      {/* Permit documents are called out separately: they are the ones
                          that stop this person at the barrier. */}
                      {t.permit_documents_outstanding > 0 ? (
                        <span className="flex items-center gap-1.5 text-status-suspended">
                          <Permit className="size-3.5" />
                          {t.permit_documents_outstanding} permit document
                          {t.permit_documents_outstanding === 1 ? "" : "s"} missing
                        </span>
                      ) : t.documents_outstanding > 0 ? (
                        <span className="text-tone-muted">
                          {t.documents_outstanding} other document
                          {t.documents_outstanding === 1 ? "" : "s"} outstanding
                        </span>
                      ) : (
                        <span className="text-status-open/80">documents complete</span>
                      )}
                    </li>
                  ))}
                  {p.travellers.length < p.party_size && (
                    <li className="text-sm text-saffron/90">
                      {p.party_size - p.travellers.length} traveller
                      {p.party_size - p.travellers.length === 1 ? "" : "s"} still unnamed
                    </li>
                  )}
                </ul>
              </article>
            ))}
          </div>
        )}
      </section>

      <p className="mt-10 border-t border-tone-line pt-6 text-sm leading-relaxed text-tone-muted">
        This page is derived at read time and changes as documents are accepted and
        reservations move. Print it the morning you leave, not the week before. Doc 09
        expects an offline contingency pack; this is what it is printed from.
      </p>
    </>
  );
}
