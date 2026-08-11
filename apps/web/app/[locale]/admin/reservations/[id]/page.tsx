import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";

import { Caution, Group, Permit, Verified } from "@/components/icons";
import { redirect } from "@/i18n/navigation";
import { adminDelete, adminGet, adminPatch, adminPost, currentStaff } from "@/lib/admin-api";
import {
  PAYMENT_METHODS,
  POLICIES,
  STATE_TONE,
  stateLabel,
  type ReservationDetail,
} from "@/lib/reservations";

/**
 * One reservation, and everything a coordinator does to it.
 *
 * The confirmation blockers are the most important thing on this page and are placed
 * above every action for that reason. They are the system refusing to let somebody
 * tell a family they are going when something is still missing, and burying them
 * under a form would defeat the whole mechanism.
 *
 * Nothing here can take a payment. Decision O3 settled offline-only for the first
 * season, so the payment form records money that has already arrived, and the API
 * refuses a `gateway` method outright.
 */

export const dynamic = "force-dynamic";

const FIELD =
  "w-full rounded-md bg-white/[0.06] px-2.5 py-1.5 text-sm text-ink-inverse ring-1 ring-white/15 focus:outline-none focus:ring-2 focus:ring-gold";
const LABEL = "text-xs text-ink-inverse/50";
const BUTTON =
  "rounded-full bg-gold px-4 py-2 text-sm font-medium text-midnight transition-transform active:scale-[0.98]";

function money(amount: string | number, currency = "INR") {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(Number(amount));
}

function when(iso: string | null, withTime = false) {
  if (!iso) return null;
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    ...(withTime ? { hour: "numeric", minute: "2-digit" } : {}),
    timeZone: "Asia/Kolkata",
  }).format(new Date(iso));
}

/** Every mutation funnels through here so failures surface the same way. */
async function run(
  locale: string,
  id: string,
  action: () => Promise<{ ok: true; data: unknown } | { ok: false; error: string }>,
) {
  const result = await action();
  revalidatePath("/[locale]/admin/reservations/[id]", "page");
  if (!result.ok) {
    redirect({
      href: `/admin/reservations/${id}?error=${encodeURIComponent(result.error)}`,
      locale,
    });
  }
}

async function saveDetails(formData: FormData) {
  "use server";
  if (!(await currentStaff())) return;
  const id = String(formData.get("id"));
  const locale = String(formData.get("locale") ?? "en");
  const due = String(formData.get("next_action_due_at") ?? "").trim();

  await run(locale, id, () =>
    adminPatch(`/admin/reservations/${id}`, {
      party_size: Number(formData.get("party_size")),
      agreed_amount: String(formData.get("agreed_amount") ?? "0"),
      next_action: String(formData.get("next_action") ?? "").trim(),
      // End of that day in IST, which is 18:29:59.999Z on the same UTC date.
      next_action_due_at: due ? `${due}T18:29:59.999Z` : null,
      internal_note: String(formData.get("internal_note") ?? "").trim(),
    }),
  );
}

async function addTraveller(formData: FormData) {
  "use server";
  if (!(await currentStaff())) return;
  const id = String(formData.get("id"));
  const locale = String(formData.get("locale") ?? "en");
  const dob = String(formData.get("date_of_birth") ?? "").trim();

  await run(locale, id, () =>
    adminPost(`/admin/reservations/${id}/travellers`, {
      full_name: String(formData.get("full_name") ?? "").trim(),
      role: formData.get("role"),
      date_of_birth: dob || null,
      relationship_to_lead: String(formData.get("relationship_to_lead") ?? "").trim(),
      is_senior: formData.get("is_senior") === "on",
      has_disclosed_health_information: formData.get("health") === "on",
    }),
  );
}

async function removeTraveller(formData: FormData) {
  "use server";
  if (!(await currentStaff())) return;
  const id = String(formData.get("id"));
  const locale = String(formData.get("locale") ?? "en");
  await run(locale, id, () =>
    adminDelete(`/admin/reservations/${id}/travellers/${formData.get("traveller_id")}`),
  );
}

async function recordPayment(formData: FormData) {
  "use server";
  if (!(await currentStaff())) return;
  const id = String(formData.get("id"));
  const locale = String(formData.get("locale") ?? "en");
  const day = String(formData.get("received_at") ?? "").trim();

  await run(locale, id, () =>
    adminPost(`/admin/reservations/${id}/payments`, {
      amount: String(formData.get("amount") ?? "0"),
      method: formData.get("method"),
      direction: formData.get("direction"),
      reference: String(formData.get("reference") ?? "").trim(),
      received_at: day ? `${day}T12:00:00.000Z` : new Date().toISOString(),
      note: String(formData.get("note") ?? "").trim(),
    }),
  );
}

async function recordAcceptance(formData: FormData) {
  "use server";
  if (!(await currentStaff())) return;
  const id = String(formData.get("id"));
  const locale = String(formData.get("locale") ?? "en");

  await run(locale, id, () =>
    adminPost(`/admin/reservations/${id}/acceptances`, {
      policy: formData.get("policy"),
      version: String(formData.get("version") ?? "").trim(),
      accepted_by: String(formData.get("accepted_by") ?? "").trim(),
      channel: formData.get("channel"),
    }),
  );
}

async function moveState(formData: FormData) {
  "use server";
  if (!(await currentStaff())) return;
  const id = String(formData.get("id"));
  const locale = String(formData.get("locale") ?? "en");

  await run(locale, id, () =>
    adminPost(`/admin/reservations/${id}/transition`, {
      target_state: formData.get("target_state"),
      reason: String(formData.get("reason") ?? "").trim(),
    }),
  );
}

async function requestDocuments(formData: FormData) {
  "use server";
  if (!(await currentStaff())) return;
  const id = String(formData.get("id"));
  const locale = String(formData.get("locale") ?? "en");

  const result = await adminPost<{ access_token: string }>(
    `/admin/reservations/${id}/request-documents`,
    {},
  );
  revalidatePath("/[locale]/admin/reservations/[id]", "page");

  // next-intl's `redirect` is not typed as returning `never`, so the discriminated
  // union does not narrow across it. Compute the destination, then redirect once.
  const href = result.ok
    ? // Shown once and never retrievable: the token is stored only as a hash.
      `/admin/reservations/${id}?token=${encodeURIComponent(result.data.access_token)}`
    : `/admin/reservations/${id}?error=${encodeURIComponent(result.error)}`;
  redirect({ href, locale });
}

export default async function ReservationDetailPage({
  params,
  searchParams,
}: PageProps<"/[locale]/admin/reservations/[id]">) {
  const { locale, id } = await params;
  const sp = await searchParams;
  const error = typeof sp.error === "string" ? sp.error : undefined;
  const token = typeof sp.token === "string" ? sp.token : undefined;

  const r = await adminGet<ReservationDetail>(`/admin/reservations/${id}`);
  if (!r) notFound();

  const hidden = (
    <>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="locale" value={locale} />
    </>
  );

  return (
    <>
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-2">
        <h1 className="text-2xl font-medium">{r.reference}</h1>
        <span
          className={`rounded-full px-3 py-0.5 text-sm ring-1 ${STATE_TONE[r.state] ?? "text-ink-inverse/70 ring-white/20"}`}
        >
          {stateLabel(r.state)}
        </span>
        <span className="ml-auto text-sm text-ink-inverse/50">
          {r.journey_name} · {when(r.start_date)}
        </span>
      </div>

      {error && (
        <p
          role="alert"
          className="mt-5 flex items-start gap-2.5 rounded-lg bg-status-suspended/12 px-5 py-4 text-[15px] leading-relaxed text-status-suspended ring-1 ring-status-suspended/25"
        >
          <Caution className="mt-0.5 size-5 shrink-0" />
          <span>
            {error} <span className="text-ink-inverse/55">Nothing was saved.</span>
          </span>
        </p>
      )}

      {token && (
        <div className="mt-5 rounded-lg bg-himalayan px-5 py-4 ring-1 ring-gold/30">
          <p className="text-sm text-gold">Access link, shown once</p>
          <p className="mt-2 break-all font-mono text-sm text-ink-inverse">
            /{locale}/booking?token={token}
          </p>
          <p className="mt-2 text-sm text-ink-inverse/55">
            Send this to the group lead. It is stored only as a hash, so it cannot be
            shown again. If it is lost, issue a new one and revoke the old.
          </p>
        </div>
      )}

      {/* Readiness first. This is the answer to "where is this group up to". */}
      <section className="mt-8 rounded-lg bg-white/[0.04] px-5 py-5 ring-1 ring-white/10">
        <div className="flex items-center gap-2.5">
          {r.readiness.is_ready ? (
            <Verified className="size-5 text-status-open" />
          ) : (
            <Permit className="size-5 text-ink-inverse/45" />
          )}
          <h2 className="text-lg">
            {r.readiness.is_ready ? "Nothing outstanding" : "Still outstanding"}
          </h2>
        </div>
        {r.readiness.outstanding.length > 0 && (
          <ul className="mt-3 space-y-1.5">
            {r.readiness.outstanding.map((item) => (
              <li
                key={item}
                className="flex gap-3 text-[15px] leading-relaxed text-ink-inverse/75"
              >
                <span aria-hidden className="mt-2 size-1 shrink-0 rounded-full bg-saffron" />
                {item}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* The safety mechanism. Above every action, deliberately. */}
      {r.confirmation_blockers.length > 0 && (
        <section className="mt-5 rounded-lg bg-saffron/10 px-5 py-5 ring-1 ring-saffron/25">
          <h2 className="text-[15px] text-saffron">
            This reservation cannot be confirmed yet
          </h2>
          <ul className="mt-3 space-y-1.5">
            {r.confirmation_blockers.map((b) => (
              <li key={b} className="text-[15px] leading-relaxed text-ink-inverse/80">
                {b}
              </li>
            ))}
          </ul>
          <p className="mt-4 text-sm leading-relaxed text-ink-inverse/50">
            Confirmation is computed from these, not chosen. Money being received is
            one of them and is never enough on its own.
          </p>
        </section>
      )}

      {/* ------------------------------------------------------------- details */}

      <section className="mt-10">
        <h2 className="font-serif text-xl">Details</h2>
        <form action={saveDetails} className="mt-4 flex flex-wrap items-end gap-3">
          {hidden}
          <label className="min-w-24">
            <span className={LABEL}>Party size</span>
            <input
              name="party_size"
              type="number"
              min={1}
              defaultValue={r.party_size}
              className={`mt-1 ${FIELD}`}
            />
          </label>
          <label className="min-w-32">
            <span className={LABEL}>Agreed amount</span>
            <input
              name="agreed_amount"
              type="number"
              min={0}
              step="1"
              defaultValue={r.agreed_amount}
              className={`mt-1 ${FIELD}`}
            />
          </label>
          <label className="min-w-56 flex-1">
            <span className={LABEL}>Next action</span>
            <input
              name="next_action"
              defaultValue={r.next_action ?? ""}
              placeholder="Call about the permit photographs"
              className={`mt-1 ${FIELD}`}
            />
          </label>
          <label className="min-w-36">
            <span className={LABEL}>By when</span>
            <input
              type="date"
              name="next_action_due_at"
              defaultValue={r.next_action_due_at?.slice(0, 10) ?? ""}
              className={`mt-1 ${FIELD}`}
            />
          </label>
          <label className="min-w-56 flex-1">
            <span className={LABEL}>Internal note (never shown to the traveller)</span>
            <input
              name="internal_note"
              defaultValue={r.internal_note ?? ""}
              className={`mt-1 ${FIELD}`}
            />
          </label>
          <button type="submit" className={BUTTON}>
            Save
          </button>
        </form>
      </section>

      {/* ------------------------------------------------------------- the party */}

      <section className="mt-10">
        <div className="flex items-baseline gap-3">
          <h2 className="font-serif text-xl">The party</h2>
          <span className="text-sm text-ink-inverse/50">
            {r.travellers.length} of {r.party_size} named
          </span>
        </div>
        <p className="mt-2 max-w-[70ch] text-sm leading-relaxed text-ink-inverse/55">
          Permits are issued against names and dates of birth as they appear on the
          identity document. Document numbers are never entered here: they belong in
          the upload path, where every access is logged.
        </p>

        {r.travellers.length > 0 && (
          <div className="mt-5">
            {r.travellers.map((t) => (
              <div
                key={t.id}
                className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-white/12 py-3"
              >
                <Group className="size-4 shrink-0 text-ink-inverse/35" />
                <span className="text-[15px]">{t.full_name}</span>
                {t.role === "group_lead" && (
                  <span className="rounded px-2 py-0.5 text-xs text-gold ring-1 ring-gold/30">
                    Group lead
                  </span>
                )}
                {t.is_senior && (
                  <span className="text-sm text-ink-inverse/55">Elder</span>
                )}
                {t.relationship_to_lead && (
                  <span className="text-sm text-ink-inverse/45">
                    {t.relationship_to_lead}
                  </span>
                )}
                {t.date_of_birth && (
                  <span className="text-sm text-ink-inverse/45">
                    {when(t.date_of_birth)}
                  </span>
                )}
                {t.has_disclosed_health_information && (
                  <span className="text-sm text-saffron/80">
                    Health information on file
                  </span>
                )}
                <form action={removeTraveller} className="ml-auto">
                  {hidden}
                  <input type="hidden" name="traveller_id" value={t.id} />
                  <button
                    type="submit"
                    className="text-sm text-ink-inverse/40 transition-colors hover:text-status-suspended"
                  >
                    Remove
                  </button>
                </form>
              </div>
            ))}
          </div>
        )}

        <form action={addTraveller} className="mt-5 flex flex-wrap items-end gap-3">
          {hidden}
          <label className="min-w-48 flex-1">
            <span className={LABEL}>Full name, as on the document</span>
            <input name="full_name" required className={`mt-1 ${FIELD}`} />
          </label>
          <label className="min-w-36">
            <span className={LABEL}>Role</span>
            <select name="role" className={`mt-1 ${FIELD}`} defaultValue="companion">
              <option value="companion" className="bg-midnight">
                Companion
              </option>
              <option value="group_lead" className="bg-midnight">
                Group lead
              </option>
            </select>
          </label>
          <label className="min-w-36">
            <span className={LABEL}>Date of birth</span>
            <input type="date" name="date_of_birth" className={`mt-1 ${FIELD}`} />
          </label>
          <label className="min-w-36">
            <span className={LABEL}>Relationship</span>
            <input
              name="relationship_to_lead"
              placeholder="mother"
              className={`mt-1 ${FIELD}`}
            />
          </label>
          <label className="flex items-center gap-2 pb-2 text-sm text-ink-inverse/70">
            <input type="checkbox" name="is_senior" className="size-4 accent-gold" />
            Elder
          </label>
          <label className="flex items-center gap-2 pb-2 text-sm text-ink-inverse/70">
            <input type="checkbox" name="health" className="size-4 accent-gold" />
            Health info disclosed
          </label>
          <button type="submit" className={BUTTON}>
            Add
          </button>
        </form>
      </section>

      {/* ------------------------------------------------------------ documents */}

      <section className="mt-10">
        <h2 className="font-serif text-xl">Documents</h2>
        <p className="mt-2 max-w-[70ch] text-sm leading-relaxed text-ink-inverse/55">
          Creates a checklist per named traveller, not one for the party, because a
          permit is issued against a person. Returns a link for the group lead, shown
          once.
        </p>
        <form action={requestDocuments} className="mt-4">
          {hidden}
          <button type="submit" className={BUTTON}>
            Request documents and issue a link
          </button>
        </form>
      </section>

      {/* -------------------------------------------------------------- payments */}

      <section className="mt-10">
        <div className="flex flex-wrap items-baseline gap-3">
          <h2 className="font-serif text-xl">Payments</h2>
          <span className="text-sm text-ink-inverse/50">
            {money(r.amount_received, r.currency)} received of{" "}
            {money(r.agreed_amount, r.currency)}
          </span>
        </div>
        <p className="mt-2 max-w-[70ch] text-sm leading-relaxed text-ink-inverse/55">
          Nothing is charged here. Record money that has already arrived, with its
          bank or UPI reference so finance can reconcile it against a statement. A
          mistake is corrected by recording a refund, which is also what happened.
        </p>

        {r.payments.length > 0 && (
          <div className="mt-5">
            {r.payments.map((p) => (
              <div
                key={p.id}
                className="flex flex-wrap items-center gap-x-5 gap-y-1 border-t border-white/12 py-3 text-[15px]"
              >
                <span
                  className={
                    p.direction === "refunded"
                      ? "text-status-suspended"
                      : "text-status-open"
                  }
                >
                  {p.direction === "refunded" ? "−" : "+"}
                  {money(p.amount, p.currency)}
                </span>
                <span className="text-ink-inverse/70">
                  {PAYMENT_METHODS.find(([v]) => v === p.method)?.[1] ?? p.method}
                </span>
                {p.reference && (
                  <span className="font-mono text-sm text-ink-inverse/50">
                    {p.reference}
                  </span>
                )}
                <span className="text-sm text-ink-inverse/45">
                  {when(p.received_at)}
                </span>
                <span className="ml-auto text-sm text-ink-inverse/40">
                  recorded by {p.recorded_by}
                </span>
              </div>
            ))}
          </div>
        )}

        <form action={recordPayment} className="mt-5 flex flex-wrap items-end gap-3">
          {hidden}
          <label className="min-w-32">
            <span className={LABEL}>Amount</span>
            <input
              name="amount"
              type="number"
              min="1"
              step="1"
              required
              className={`mt-1 ${FIELD}`}
            />
          </label>
          <label className="min-w-36">
            <span className={LABEL}>Method</span>
            <select name="method" className={`mt-1 ${FIELD}`} defaultValue="bank_transfer">
              {PAYMENT_METHODS.map(([value, label]) => (
                <option key={value} value={value} className="bg-midnight">
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="min-w-32">
            <span className={LABEL}>Direction</span>
            <select name="direction" className={`mt-1 ${FIELD}`} defaultValue="received">
              <option value="received" className="bg-midnight">
                Received
              </option>
              <option value="refunded" className="bg-midnight">
                Refunded
              </option>
            </select>
          </label>
          <label className="min-w-40 flex-1">
            <span className={LABEL}>Bank or UPI reference</span>
            <input name="reference" className={`mt-1 ${FIELD}`} />
          </label>
          <label className="min-w-36">
            <span className={LABEL}>Received on</span>
            <input type="date" name="received_at" className={`mt-1 ${FIELD}`} />
          </label>
          <button type="submit" className={BUTTON}>
            Record
          </button>
        </form>
      </section>

      {/* ------------------------------------------------------------ acceptance */}

      <section className="mt-10">
        <h2 className="font-serif text-xl">Accepted terms</h2>
        <p className="mt-2 max-w-[70ch] text-sm leading-relaxed text-ink-inverse/55">
          Record the version they actually saw. &ldquo;They agreed to the terms&rdquo;
          is not a defence once the terms have been edited. Terms and cancellation are
          both required before a reservation can be confirmed.
        </p>

        {r.acceptances.length > 0 && (
          <div className="mt-5">
            {r.acceptances.map((a) => (
              <div
                key={a.id}
                className="flex flex-wrap items-center gap-x-5 gap-y-1 border-t border-white/12 py-3 text-[15px]"
              >
                <span>{POLICIES.find(([v]) => v === a.policy)?.[1] ?? a.policy}</span>
                <span className="font-mono text-sm text-ink-inverse/55">
                  v{a.version}
                </span>
                <span className="text-sm text-ink-inverse/60">by {a.accepted_by}</span>
                {a.channel && (
                  <span className="text-sm text-ink-inverse/45">via {a.channel}</span>
                )}
                <span className="ml-auto text-sm text-ink-inverse/40">
                  {when(a.accepted_at, true)}
                </span>
              </div>
            ))}
          </div>
        )}

        <form action={recordAcceptance} className="mt-5 flex flex-wrap items-end gap-3">
          {hidden}
          <label className="min-w-44">
            <span className={LABEL}>Policy</span>
            <select name="policy" className={`mt-1 ${FIELD}`} defaultValue="terms">
              {POLICIES.map(([value, label]) => (
                <option key={value} value={value} className="bg-midnight">
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="min-w-32">
            <span className={LABEL}>Version</span>
            <input
              name="version"
              required
              placeholder="2026-08-10"
              className={`mt-1 ${FIELD}`}
            />
          </label>
          <label className="min-w-44 flex-1">
            <span className={LABEL}>Accepted by</span>
            <input
              name="accepted_by"
              required
              defaultValue={r.group_lead_name ?? ""}
              className={`mt-1 ${FIELD}`}
            />
          </label>
          <label className="min-w-32">
            <span className={LABEL}>How</span>
            <select name="channel" className={`mt-1 ${FIELD}`} defaultValue="phone">
              <option value="phone" className="bg-midnight">
                On a call
              </option>
              <option value="whatsapp" className="bg-midnight">
                WhatsApp
              </option>
              <option value="email" className="bg-midnight">
                Email
              </option>
              <option value="in_person" className="bg-midnight">
                In person
              </option>
            </select>
          </label>
          <button type="submit" className={BUTTON}>
            Record
          </button>
        </form>
      </section>

      {/* ------------------------------------------------------------ lifecycle */}

      <section className="mt-10 border-t border-white/12 pt-8">
        <h2 className="font-serif text-xl">Move this reservation</h2>
        {r.allowed_transitions.length === 0 ? (
          <p className="mt-3 text-[15px] text-ink-inverse/60">
            This reservation is in a final state. Nothing moves from here.
          </p>
        ) : (
          <form action={moveState} className="mt-4 flex flex-wrap items-end gap-3">
            {hidden}
            <label className="min-w-52">
              <span className={LABEL}>New state</span>
              <select name="target_state" className={`mt-1 ${FIELD}`}>
                {r.allowed_transitions.map((s) => (
                  <option key={s} value={s} className="bg-midnight">
                    {stateLabel(s)}
                  </option>
                ))}
              </select>
            </label>
            <label className="min-w-64 flex-1">
              <span className={LABEL}>Reason (recorded, and required)</span>
              <input name="reason" required className={`mt-1 ${FIELD}`} />
            </label>
            <button type="submit" className={BUTTON}>
              Move
            </button>
          </form>
        )}
        {r.cancellation_reason && (
          <p className="mt-4 text-sm text-ink-inverse/55">
            Cancelled: {r.cancellation_reason}
          </p>
        )}
      </section>
    </>
  );
}
