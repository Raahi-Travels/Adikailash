import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";

import { Caution, Homestay, Verified, Vehicle } from "@/components/icons";
import { redirect } from "@/i18n/navigation";
import { Link } from "@/i18n/navigation";
import {
  adminDelete,
  adminGet,
  adminPatch,
  adminPost,
  currentStaff,
} from "@/lib/admin-api";

/**
 * Departure operations: suppliers, what they are owed, and where people sleep.
 *
 * Distinct from the manifest on purpose. The manifest answers "can this leave" and is
 * read at a checkpost; this is the planning surface a coordinator works from in the
 * weeks before.
 *
 * The economics block is the one place in the product that states a margin. It reads
 * from *agreed* revenue rather than cash received, because a transfer that has not
 * cleared does not change whether a trip is worth running, and a margin that swings
 * on payment timing is a margin nobody trusts.
 */

export const dynamic = "force-dynamic";

const FIELD =
  "w-full rounded-md bg-white/[0.06] px-2.5 py-1.5 text-sm text-tone-strong ring-1 ring-tone-line focus:outline-none focus:ring-2 focus:ring-gold";
const LABEL = "text-xs text-tone-muted";
const BUTTON =
  "rounded-full bg-gold px-4 py-2 text-sm font-medium text-midnight transition-transform active:scale-[0.98]";

type Supplier = { id: number; name: string; kind: string; village: string | null };

type Booking = {
  id: number;
  supplier_id: number;
  supplier_name: string;
  kind: string;
  service: string;
  state: string;
  agreed_cost: string;
  paid: string;
  outstanding: string;
  is_overpaid: boolean;
  currency: string;
  confirmed_by: string | null;
  cancellation_reason: string | null;
  payments: {
    id: number;
    amount: string;
    method: string;
    reference: string | null;
    paid_at: string;
    recorded_by: string;
    direction: string;
  }[];
};

type Economics = {
  customer_revenue_agreed: string;
  customer_revenue_received: string;
  committed_cost: string;
  paid_to_suppliers: string;
  owed_to_suppliers: string;
  margin: string;
  margin_percent: string | null;
  is_loss_making: boolean;
};

type Rooming = {
  beds: {
    id: number;
    traveller_name: string;
    stay_name: string;
    night: string;
    note: string | null;
  }[];
  nights: string[];
  over_capacity: string[];
  unknown_capacity: string[];
  unassigned: string[];
  is_complete: boolean;
};

const BOOKING_STATES = [
  ["enquired", "Enquired"],
  ["confirmed", "Confirmed"],
  ["delivered", "Delivered"],
  ["cancelled", "Cancelled"],
] as const;

const KINDS = [
  ["transport", "Transport"],
  ["guide", "Guide"],
  ["porter", "Porter"],
  ["stay", "Stay"],
  ["permit_agent", "Permit agent"],
  ["other", "Other"],
] as const;

const METHODS = [
  ["bank_transfer", "Bank transfer"],
  ["upi", "UPI"],
  ["cash", "Cash"],
  ["cheque", "Cheque"],
] as const;

function money(amount: string | number, currency = "INR") {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(Number(amount));
}

function day(iso: string) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    timeZone: "Asia/Kolkata",
  }).format(new Date(iso));
}

async function run(
  locale: string,
  id: string,
  action: () => Promise<{ ok: true; data: unknown } | { ok: false; error: string }>,
) {
  const result = await action();
  revalidatePath("/[locale]/admin/departures/[id]/ops", "page");
  if (!result.ok) {
    redirect({
      href: `/admin/departures/${id}/ops?error=${encodeURIComponent(result.error)}`,
      locale,
    });
  }
}

async function addSupplier(formData: FormData) {
  "use server";
  if (!(await currentStaff())) return;
  const id = String(formData.get("id"));
  const locale = String(formData.get("locale") ?? "en");
  await run(locale, id, () =>
    adminPost("/admin/suppliers", {
      name: String(formData.get("name") ?? "").trim(),
      kind: formData.get("kind"),
      contact_name: String(formData.get("contact_name") ?? "").trim(),
      phone: String(formData.get("phone") ?? "").trim(),
      village: String(formData.get("village") ?? "").trim(),
    }),
  );
}

async function bookSupplier(formData: FormData) {
  "use server";
  if (!(await currentStaff())) return;
  const id = String(formData.get("id"));
  const locale = String(formData.get("locale") ?? "en");
  await run(locale, id, () =>
    adminPost(`/admin/departures/${id}/suppliers`, {
      supplier_id: Number(formData.get("supplier_id")),
      service: String(formData.get("service") ?? "").trim(),
      agreed_cost: String(formData.get("agreed_cost") ?? "0"),
    }),
  );
}

async function updateBooking(formData: FormData) {
  "use server";
  if (!(await currentStaff())) return;
  const id = String(formData.get("id"));
  const locale = String(formData.get("locale") ?? "en");
  await run(locale, id, () =>
    adminPatch(`/admin/supplier-bookings/${formData.get("booking_id")}`, {
      state: formData.get("state"),
      agreed_cost: String(formData.get("agreed_cost") ?? "0"),
      cancellation_reason: String(formData.get("cancellation_reason") ?? "").trim(),
    }),
  );
}

async function paySupplier(formData: FormData) {
  "use server";
  if (!(await currentStaff())) return;
  const id = String(formData.get("id"));
  const locale = String(formData.get("locale") ?? "en");
  const on = String(formData.get("paid_at") ?? "").trim();
  await run(locale, id, () =>
    adminPost(`/admin/supplier-bookings/${formData.get("booking_id")}/payments`, {
      amount: String(formData.get("amount") ?? "0"),
      method: formData.get("method"),
      reference: String(formData.get("reference") ?? "").trim(),
      paid_at: on ? `${on}T12:00:00.000Z` : new Date().toISOString(),
    }),
  );
}

async function removeBed(formData: FormData) {
  "use server";
  if (!(await currentStaff())) return;
  const id = String(formData.get("id"));
  const locale = String(formData.get("locale") ?? "en");
  await run(locale, id, () =>
    adminDelete(`/admin/rooming/${formData.get("assignment_id")}`),
  );
}

export default async function DepartureOpsPage({
  params,
  searchParams,
}: PageProps<"/[locale]/admin/departures/[id]/ops">) {
  const { locale, id } = await params;
  const sp = await searchParams;
  const error = typeof sp.error === "string" ? sp.error : undefined;

  const [bookings, economics, rooming, suppliers] = await Promise.all([
    adminGet<Booking[]>(`/admin/departures/${id}/suppliers`),
    adminGet<Economics>(`/admin/departures/${id}/economics`),
    adminGet<Rooming>(`/admin/departures/${id}/rooming`),
    adminGet<Supplier[]>("/admin/suppliers"),
  ]);
  if (!bookings || !economics || !rooming) notFound();

  const hidden = (
    <>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="locale" value={locale} />
    </>
  );

  const hasRevenue = Number(economics.customer_revenue_agreed) > 0;

  // Beds grouped by night, which is how a coordinator plans and how the vehicles move.
  const byNight = new Map<string, Rooming["beds"]>();
  for (const bed of rooming.beds) {
    const bucket = byNight.get(bed.night);
    if (bucket) bucket.push(bed);
    else byNight.set(bed.night, [bed]);
  }

  return (
    <>
      <div className="flex flex-wrap items-baseline gap-x-4">
        <h1 className="text-2xl font-medium">Departure operations</h1>
        <Link
          href={`/admin/departures/${id}/manifest`}
          className="text-sm text-gold underline-offset-4 hover:underline"
        >
          Manifest
        </Link>
      </div>
      <p className="mt-2 max-w-[70ch] text-sm leading-relaxed text-tone-muted">
        Suppliers, what they are owed, and where people sleep. The manifest answers
        whether this can leave; this is what you work from in the weeks before.
      </p>

      {error && (
        <p
          role="alert"
          className="mt-5 flex items-start gap-2.5 rounded-lg bg-status-suspended/12 px-5 py-4 text-[15px] leading-relaxed text-status-suspended ring-1 ring-status-suspended/25"
        >
          <Caution className="mt-0.5 size-5 shrink-0" />
          <span>
            {error} <span className="text-tone-muted">Nothing was saved.</span>
          </span>
        </p>
      )}

      {/* ------------------------------------------------------------ economics */}

      <section className="mt-8 rounded-lg bg-white/[0.04] px-5 py-5 ring-1 ring-tone-line">
        <h2 className="text-lg">Money on this departure</h2>
        {!hasRevenue ? (
          /*
            Never print a negative margin against zero revenue. Arithmetically it is
            just minus the cost, and reading it as a loss would be wrong: nothing has
            been sold yet.
          */
          <p className="mt-3 max-w-[62ch] text-[15px] leading-relaxed text-tone-body">
            Nothing is sold on this departure yet, so there is no margin to report.
            {Number(economics.committed_cost) > 0 && (
              <>
                {" "}
                You have committed {money(economics.committed_cost)} to suppliers
                against it.
              </>
            )}
          </p>
        ) : (
          <>
            <dl className="mt-4 grid gap-4 sm:grid-cols-4">
              {[
                ["Sold", money(economics.customer_revenue_agreed)],
                ["Committed cost", money(economics.committed_cost)],
                [
                  "Margin",
                  `${money(economics.margin)}${economics.margin_percent ? ` · ${economics.margin_percent}%` : ""}`,
                ],
                ["Owed to suppliers", money(economics.owed_to_suppliers)],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className={LABEL}>{label}</dt>
                  <dd
                    className={`mt-1 text-[17px] ${
                      label === "Margin" && economics.is_loss_making
                        ? "text-status-suspended"
                        : ""
                    }`}
                  >
                    {value}
                  </dd>
                </div>
              ))}
            </dl>
            <p className="mt-4 text-sm leading-relaxed text-tone-muted">
              Margin is agreed revenue less committed cost, not cash. Of the amount
              sold, {money(economics.customer_revenue_received)} has actually arrived.
            </p>
            {economics.is_loss_making && (
              <p className="mt-3 flex items-start gap-2.5 text-[15px] text-status-suspended">
                <Caution className="mt-0.5 size-5 shrink-0" />
                This departure costs more than it has sold. Worth a decision before
                any more is committed.
              </p>
            )}
          </>
        )}
      </section>

      {/* ------------------------------------------------------------ suppliers */}

      <section className="mt-10">
        <h2 className="font-serif text-xl">Suppliers</h2>
        <p className="mt-2 max-w-[70ch] text-sm leading-relaxed text-tone-muted">
          Nothing is charged here. Record what was agreed and what has actually been
          paid, with its reference, so finance can reconcile against a statement.
        </p>

        {bookings.length > 0 && (
          <div className="mt-5">
            {bookings.map((b) => (
              <article key={b.id} className="border-t border-tone-line py-5">
                <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                  <Vehicle className="size-4 shrink-0 text-tone-muted" />
                  <h3 className="text-[17px]">{b.supplier_name}</h3>
                  <span className="text-sm text-tone-muted">{b.kind}</span>
                  <span className="text-sm text-tone-body">
                    {money(b.agreed_cost, b.currency)} agreed ·{" "}
                    {money(b.paid, b.currency)} paid
                    {Number(b.outstanding) > 0 && (
                      <span className="text-saffron/90">
                        {" "}
                        · {money(b.outstanding, b.currency)} outstanding
                      </span>
                    )}
                  </span>
                  {b.is_overpaid && (
                    <span className="text-sm text-status-suspended">
                      Paid more than agreed
                    </span>
                  )}
                  <span className="ml-auto text-sm text-tone-muted">
                    {BOOKING_STATES.find(([v]) => v === b.state)?.[1] ?? b.state}
                    {b.confirmed_by ? ` by ${b.confirmed_by}` : ""}
                  </span>
                </div>
                <p className="mt-1.5 max-w-[70ch] text-[15px] text-tone-body">
                  {b.service}
                </p>
                {b.cancellation_reason && (
                  <p className="mt-1 text-sm text-tone-muted">
                    Cancelled: {b.cancellation_reason}
                  </p>
                )}

                {b.payments.length > 0 && (
                  <ul className="mt-3 space-y-1">
                    {b.payments.map((p) => (
                      <li key={p.id} className="text-sm text-tone-muted">
                        {p.direction === "refunded" ? "Refunded " : "Paid "}
                        {money(p.amount, b.currency)} ·{" "}
                        {METHODS.find(([v]) => v === p.method)?.[1] ?? p.method}
                        {p.reference ? ` · ${p.reference}` : ""} · {day(p.paid_at)} ·
                        recorded by {p.recorded_by}
                      </li>
                    ))}
                  </ul>
                )}

                <div className="mt-4 flex flex-wrap items-end gap-3">
                  <form action={updateBooking} className="flex flex-wrap items-end gap-3">
                    {hidden}
                    <input type="hidden" name="booking_id" value={b.id} />
                    <label className="min-w-32">
                      <span className={LABEL}>State</span>
                      <select name="state" defaultValue={b.state} className={`mt-1 ${FIELD}`}>
                        {BOOKING_STATES.map(([v, l]) => (
                          <option key={v} value={v} className="register-dark">
                            {l}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="min-w-28">
                      <span className={LABEL}>Agreed</span>
                      <input
                        name="agreed_cost"
                        type="number"
                        min={0}
                        defaultValue={b.agreed_cost}
                        className={`mt-1 ${FIELD}`}
                      />
                    </label>
                    <label className="min-w-40">
                      <span className={LABEL}>If cancelling, why</span>
                      <input name="cancellation_reason" className={`mt-1 ${FIELD}`} />
                    </label>
                    <button type="submit" className={BUTTON}>
                      Save
                    </button>
                  </form>

                  <form action={paySupplier} className="flex flex-wrap items-end gap-3">
                    {hidden}
                    <input type="hidden" name="booking_id" value={b.id} />
                    <label className="min-w-28">
                      <span className={LABEL}>Pay</span>
                      <input
                        name="amount"
                        type="number"
                        min={1}
                        className={`mt-1 ${FIELD}`}
                      />
                    </label>
                    <label className="min-w-32">
                      <span className={LABEL}>Method</span>
                      <select name="method" defaultValue="upi" className={`mt-1 ${FIELD}`}>
                        {METHODS.map(([v, l]) => (
                          <option key={v} value={v} className="bg-midnight">
                            {l}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="min-w-32">
                      <span className={LABEL}>Reference</span>
                      <input name="reference" className={`mt-1 ${FIELD}`} />
                    </label>
                    <label className="min-w-32">
                      <span className={LABEL}>On</span>
                      <input type="date" name="paid_at" className={`mt-1 ${FIELD}`} />
                    </label>
                    <button type="submit" className={BUTTON}>
                      Record
                    </button>
                  </form>
                </div>
              </article>
            ))}
          </div>
        )}

        <form action={bookSupplier} className="mt-6 flex flex-wrap items-end gap-3 border-t border-tone-line pt-5">
          {hidden}
          <label className="min-w-48">
            <span className={LABEL}>Supplier</span>
            <select name="supplier_id" className={`mt-1 ${FIELD}`}>
              {(suppliers ?? []).map((s) => (
                <option key={s.id} value={s.id} className="bg-midnight">
                  {s.name} ({s.kind})
                </option>
              ))}
            </select>
          </label>
          <label className="min-w-64 flex-1">
            <span className={LABEL}>What they are providing</span>
            <input
              name="service"
              required
              placeholder="Bolero, Kathgodam to Dharchula and return"
              className={`mt-1 ${FIELD}`}
            />
          </label>
          <label className="min-w-28">
            <span className={LABEL}>Agreed cost</span>
            <input name="agreed_cost" type="number" min={0} className={`mt-1 ${FIELD}`} />
          </label>
          <button type="submit" className={BUTTON}>
            Book
          </button>
        </form>

        <details className="mt-5">
          <summary className="cursor-pointer text-sm text-tone-muted">
            Add a new supplier
          </summary>
          <form action={addSupplier} className="mt-4 flex flex-wrap items-end gap-3">
            {hidden}
            <label className="min-w-44 flex-1">
              <span className={LABEL}>Name</span>
              <input name="name" required className={`mt-1 ${FIELD}`} />
            </label>
            <label className="min-w-36">
              <span className={LABEL}>Kind</span>
              <select name="kind" defaultValue="transport" className={`mt-1 ${FIELD}`}>
                {KINDS.map(([v, l]) => (
                  <option key={v} value={v} className="bg-midnight">
                    {l}
                  </option>
                ))}
              </select>
            </label>
            <label className="min-w-36">
              <span className={LABEL}>Contact</span>
              <input name="contact_name" className={`mt-1 ${FIELD}`} />
            </label>
            <label className="min-w-36">
              <span className={LABEL}>Phone</span>
              <input name="phone" className={`mt-1 ${FIELD}`} />
            </label>
            <label className="min-w-32">
              <span className={LABEL}>Village</span>
              <input name="village" className={`mt-1 ${FIELD}`} />
            </label>
            <button type="submit" className={BUTTON}>
              Add
            </button>
          </form>
        </details>
      </section>

      {/* -------------------------------------------------------------- rooming */}

      <section className="mt-10">
        <div className="flex items-center gap-2.5">
          <Homestay className="size-5 text-tone-muted" />
          <h2 className="font-serif text-xl">Where people sleep</h2>
          {rooming.is_complete && <Verified className="size-5 text-status-open" />}
        </div>

        {rooming.over_capacity.length > 0 && (
          <div className="mt-4 rounded-lg bg-status-suspended/10 px-5 py-4 ring-1 ring-status-suspended/30">
            <h3 className="text-[15px] text-status-suspended">
              More people than the household can take
            </h3>
            <ul className="mt-2 space-y-1">
              {rooming.over_capacity.map((o) => (
                <li key={o} className="text-[15px] text-tone-body">
                  {o}
                </li>
              ))}
            </ul>
            <p className="mt-3 text-sm text-tone-muted">
              This is the failure that leaves a family standing outside at nine at
              night, at altitude. Fix it before the vehicles leave.
            </p>
          </div>
        )}

        {rooming.unknown_capacity.length > 0 && (
          <div className="mt-4 rounded-lg bg-white/[0.04] px-5 py-4 ring-1 ring-tone-line">
            <h3 className="text-[15px] text-tone-body">
              Nobody has recorded what these households can take
            </h3>
            <ul className="mt-2 space-y-1">
              {rooming.unknown_capacity.map((u) => (
                <li key={u} className="text-sm text-tone-body">
                  {u}
                </li>
              ))}
            </ul>
          </div>
        )}

        {rooming.unassigned.length > 0 && (
          <div className="mt-4">
            <h3 className="text-[15px] text-saffron/90">Nobody has a bed yet</h3>
            <ul className="mt-2 space-y-1">
              {rooming.unassigned.map((u) => (
                <li key={u} className="text-sm leading-relaxed text-tone-body">
                  {u}
                </li>
              ))}
            </ul>
          </div>
        )}

        {byNight.size > 0 && (
          <div className="mt-6">
            {[...byNight.entries()].map(([night, beds]) => (
              <div key={night} className="border-t border-tone-line py-4">
                <h3 className="text-sm uppercase tracking-[0.12em] text-gold">
                  {day(night)}
                </h3>
                <ul className="mt-2 space-y-1.5">
                  {beds.map((bed) => (
                    <li
                      key={bed.id}
                      className="flex flex-wrap items-center gap-x-4 text-[15px]"
                    >
                      <span>{bed.traveller_name}</span>
                      <span className="text-tone-muted">{bed.stay_name}</span>
                      {bed.note && (
                        <span className="text-sm text-tone-muted">{bed.note}</span>
                      )}
                      <form action={removeBed} className="ml-auto">
                        {hidden}
                        <input type="hidden" name="assignment_id" value={bed.id} />
                        <button
                          type="submit"
                          className="text-sm text-tone-muted transition-colors hover:text-status-suspended"
                        >
                          Remove
                        </button>
                      </form>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}

        {rooming.beds.length === 0 && (
          <p className="mt-4 text-[15px] text-tone-body">
            No beds assigned yet. {rooming.nights.length} night
            {rooming.nights.length === 1 ? "" : "s"} on this departure.
          </p>
        )}
      </section>
    </>
  );
}
