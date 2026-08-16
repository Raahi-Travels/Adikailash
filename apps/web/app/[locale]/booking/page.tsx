import { setRequestLocale } from "next-intl/server";

import { FamilyShares } from "@/components/family-shares";
import { Caution, Permit, Verified } from "@/components/icons";
import { Link } from "@/i18n/navigation";
import { buildMetadata } from "@/lib/brand";

/**
 * The traveller's own booking.
 *
 * Doc 09's Phase 2 exit condition has two halves. The admin queue is the staff half;
 * this is the customer half: a visible state, the payment trail, the accepted terms
 * and who owns their preparation.
 *
 * The single most important element is the state sentence. "Held" and "confirmed"
 * are a week apart operationally and a world apart to somebody deciding whether to
 * book a flight from Chennai, so the API returns a full sentence of meaning
 * alongside the label and this page renders it at the top, in full, always.
 *
 * Nothing internal appears: no internal note, no coordinator's next action, no
 * other traveller's health flag.
 */

export const metadata = {
  ...buildMetadata({
    title: "Your booking",
    description: "The state of your journey, what has been paid, and what is outstanding.",
    path: "/booking",
  }),
  // Reached by a private link and specific to one party.
  robots: { index: false, follow: false },
};

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8010";

type Booking = {
  reference: string;
  state: string;
  state_label: string;
  state_meaning: string;
  journey_name: string | null;
  start_date: string | null;
  end_date: string | null;
  gateway: string | null;
  party_size: number;
  travellers: { full_name: string; role: string; is_senior: boolean }[];
  coordinator: string | null;
  amount_due: string;
  amount_received: string;
  balance_outstanding: string;
  currency: string;
  payments: {
    direction: string;
    amount: string;
    method: string;
    reference: string | null;
    received_at: string;
  }[];
  online_payment_available: boolean;
  accepted_policies: {
    policy: string;
    version: string;
    accepted_by: string;
    accepted_at: string | null;
  }[];
  documents_outstanding: number;
  outstanding: string[];
  is_ready: boolean;
  updates: {
    id: number;
    category: string;
    title: string;
    body: string;
    published_by: string;
    created_at: string;
  }[];
};

const UPDATE_LABEL: Record<string, string> = {
  route_change: "Route change",
  preparation: "Preparation",
  departure_logistics: "Departure logistics",
  payment: "Payment",
  incident: "Incident",
  general: "Update",
};

const METHOD_LABEL: Record<string, string> = {
  bank_transfer: "Bank transfer",
  upi: "UPI",
  cash: "Cash",
  cheque: "Cheque",
};

const POLICY_LABEL: Record<string, string> = {
  terms: "Terms of service",
  cancellation: "Cancellation and refunds",
  privacy: "Privacy",
  consent: "Consent",
};

/** States where the party is genuinely committed, which changes the page's tone. */
const COMMITTED = new Set(["confirmed", "preparing", "ready", "travelled"]);

function money(amount: string, currency = "INR") {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(Number(amount));
}

function when(iso: string | null, locale: string) {
  if (!iso) return null;
  return new Intl.DateTimeFormat(locale === "hi" ? "hi-IN" : "en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  }).format(new Date(iso));
}

export default async function BookingPage({
  params,
  searchParams,
}: PageProps<"/[locale]/booking">) {
  const { locale } = await params;
  const { token } = await searchParams;
  setRequestLocale(locale);

  const value = typeof token === "string" ? token : "";

  let booking: Booking | null = null;
  let failed = false;
  if (value) {
    try {
      const res = await fetch(
        `${BASE}/traveller/booking?token=${encodeURIComponent(value)}&locale=${locale}`,
        { cache: "no-store" },
      );
      if (res.ok) booking = await res.json();
      else failed = true;
    } catch {
      failed = true;
    }
  }

  return (
    <main
      id="main"
      className="flex-1 register-dark px-4 py-16 text-ink-inverse sm:px-6 sm:py-20"
    >
      <div className="mx-auto max-w-3xl">
        {!value && (
          <>
            <h1 className="font-serif text-4xl leading-tight">Your booking</h1>
            <p className="mt-5 max-w-[62ch] text-[15px] leading-relaxed text-ink-inverse/70">
              This page opens from the private link we sent you. If you do not have it
              to hand, message the team and we will send a new one.
            </p>
          </>
        )}

        {value && failed && (
          <>
            <h1 className="font-serif text-4xl leading-tight">Your booking</h1>
            <p className="mt-6 rounded-lg bg-himalayan px-5 py-4 text-[15px] leading-relaxed ring-1 ring-white/10">
              This link is not valid. It may have expired. Please ask the team for a
              new one.
            </p>
          </>
        )}

        {booking && (
          <>
            <p className="text-sm uppercase tracking-[0.14em] text-gold">
              {booking.reference}
            </p>
            <h1 className="mt-4 font-serif text-4xl leading-tight sm:text-[2.75rem]">
              {booking.journey_name ?? "Your journey"}
            </h1>
            {booking.start_date && (
              <p className="mt-3 text-[15px] text-ink-inverse/70">
                {when(booking.start_date, locale)} to {when(booking.end_date, locale)}
                {booking.gateway ? `, starting from ${booking.gateway}` : ""}
              </p>
            )}

            {/*
              The state, in full. Never abbreviated to the label alone: the label is
              what someone skims, the sentence is what stops them booking a flight
              against a hold.
            */}
            <section
              className={`mt-8 rounded-lg px-5 py-5 ring-1 ${
                COMMITTED.has(booking.state)
                  ? "bg-status-open/10 ring-status-open/30"
                  : "bg-saffron/10 ring-saffron/25"
              }`}
            >
              <h2 className="text-lg">{booking.state_label}</h2>
              <p className="mt-2 max-w-[62ch] text-[15px] leading-relaxed text-ink-inverse/80">
                {booking.state_meaning}
              </p>
            </section>

            {booking.updates.length > 0 && (
              <section className="mt-10">
                <h2 className="font-serif text-2xl">From your coordinator</h2>
                <div className="mt-4">
                  {booking.updates.map((u) => (
                    <article key={u.id} className="border-t border-white/12 py-5">
                      <div className="flex flex-wrap items-baseline gap-x-3">
                        <span
                          className={`text-sm ${
                            u.category === "route_change" || u.category === "incident"
                              ? "text-saffron"
                              : "text-ink-inverse/45"
                          }`}
                        >
                          {UPDATE_LABEL[u.category] ?? "Update"}
                        </span>
                        <span className="ml-auto text-sm text-ink-inverse/45">
                          {when(u.created_at, locale)}
                        </span>
                      </div>
                      <h3 className="mt-1.5 text-[17px]">{u.title}</h3>
                      <p className="mt-2 max-w-[62ch] whitespace-pre-line text-[15px] leading-relaxed text-ink-inverse/75">
                        {u.body}
                      </p>
                      <p className="mt-2 text-sm text-ink-inverse/40">
                        {u.published_by}
                      </p>
                    </article>
                  ))}
                </div>
              </section>
            )}

            <section className="mt-10">
              <div className="flex items-center gap-2.5">
                {booking.is_ready ? (
                  <Verified className="size-5 text-status-open" />
                ) : (
                  <Permit className="size-5 text-ink-inverse/45" />
                )}
                <h2 className="font-serif text-2xl">
                  {booking.is_ready ? "Nothing outstanding" : "Still to do"}
                </h2>
              </div>
              {booking.is_ready ? (
                <p className="mt-3 max-w-[62ch] text-[15px] leading-relaxed text-ink-inverse/70">
                  Everything we need is in place. We will be in touch before you travel.
                </p>
              ) : (
                <ul className="mt-4 space-y-2.5">
                  {booking.outstanding.map((item) => (
                    <li
                      key={item}
                      className="flex gap-3 text-[15px] leading-relaxed text-ink-inverse/80"
                    >
                      <span aria-hidden className="mt-2 size-1 shrink-0 rounded-full bg-gold" />
                      {item}
                    </li>
                  ))}
                </ul>
              )}
              {booking.documents_outstanding > 0 && (
                <Link
                  href={`/documents?token=${encodeURIComponent(value)}`}
                  className="mt-5 inline-block rounded-full bg-gold px-5 py-2.5 text-sm font-medium text-midnight"
                >
                  Send your documents
                </Link>
              )}
            </section>

            <section className="mt-10">
              <h2 className="font-serif text-2xl">Who is travelling</h2>
              {booking.travellers.length === 0 ? (
                <p className="mt-3 text-[15px] text-ink-inverse/60">
                  Nobody has been named yet. We need every traveller&apos;s name as it
                  appears on their identity document, because permits are issued
                  against them.
                </p>
              ) : (
                <ul className="mt-4">
                  {booking.travellers.map((t) => (
                    <li
                      key={t.full_name}
                      className="flex flex-wrap items-center gap-x-4 border-t border-white/12 py-3 text-[15px]"
                    >
                      {t.full_name}
                      {t.role === "group_lead" && (
                        <span className="text-sm text-ink-inverse/45">
                          main contact
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-3 text-sm text-ink-inverse/50">
                {booking.travellers.length} of {booking.party_size} named
              </p>
            </section>

            <section className="mt-10">
              <h2 className="font-serif text-2xl">Payments</h2>
              <p className="mt-3 text-[15px] leading-relaxed text-ink-inverse/70">
                {money(booking.amount_received, booking.currency)} received of{" "}
                {money(booking.amount_due, booking.currency)}.
                {Number(booking.balance_outstanding) > 0 && (
                  <> {money(booking.balance_outstanding, booking.currency)} outstanding.</>
                )}
              </p>

              {booking.payments.length > 0 && (
                <ul className="mt-4">
                  {booking.payments.map((p, i) => (
                    <li
                      key={`${p.received_at}-${i}`}
                      className="flex flex-wrap items-center gap-x-5 border-t border-white/12 py-3 text-[15px]"
                    >
                      <span
                        className={
                          p.direction === "refunded"
                            ? "text-status-suspended"
                            : "text-status-open"
                        }
                      >
                        {p.direction === "refunded" ? "Refunded " : "Received "}
                        {money(p.amount, booking.currency)}
                      </span>
                      <span className="text-ink-inverse/60">
                        {METHOD_LABEL[p.method] ?? p.method}
                      </span>
                      {p.reference && (
                        <span className="font-mono text-sm text-ink-inverse/45">
                          {p.reference}
                        </span>
                      )}
                      <span className="ml-auto text-sm text-ink-inverse/45">
                        {when(p.received_at, locale)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}

              {/*
                Decision O8 is open and no gateway exists, so there is deliberately no
                pay button. Saying so is better than a dead end.
              */}
              {!booking.online_payment_available && (
                <p className="mt-5 rounded-lg bg-himalayan px-5 py-4 text-sm leading-relaxed ring-1 ring-white/10">
                  We do not take payment on this website. Anything to do with money
                  happens with a person, and every amount received is listed above with
                  its reference. If something is missing here, tell us before you send
                  anything more.
                </p>
              )}
            </section>

            <section className="mt-10">
              <h2 className="font-serif text-2xl">What you agreed to</h2>
              {booking.accepted_policies.length === 0 ? (
                <p className="mt-3 max-w-[62ch] text-[15px] leading-relaxed text-ink-inverse/70">
                  Nothing recorded yet. We will go through the terms and the
                  cancellation policy with you before anything is confirmed.
                </p>
              ) : (
                <ul className="mt-4">
                  {booking.accepted_policies.map((a) => (
                    <li
                      key={`${a.policy}-${a.version}`}
                      className="flex flex-wrap items-center gap-x-4 border-t border-white/12 py-3 text-[15px]"
                    >
                      <Link
                        href={`/policies/${a.policy}`}
                        className="text-gold underline-offset-4 hover:underline"
                      >
                        {POLICY_LABEL[a.policy] ?? a.policy}
                      </Link>
                      <span className="text-sm text-ink-inverse/45">
                        version {a.version}
                      </span>
                      <span className="ml-auto text-sm text-ink-inverse/45">
                        {a.accepted_by}
                        {a.accepted_at ? `, ${when(a.accepted_at, locale)}` : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="mt-10 border-t border-white/12 pt-8">
              <h2 className="font-serif text-2xl">Who is looking after you</h2>
              {booking.coordinator ? (
                <p className="mt-3 text-[15px] leading-relaxed text-ink-inverse/75">
                  {booking.coordinator} is your coordinator. Any question about this
                  journey reaches them.
                </p>
              ) : (
                <p className="mt-3 flex items-start gap-2.5 text-[15px] leading-relaxed text-saffron/90">
                  <Caution className="mt-0.5 size-5 shrink-0" />
                  Nobody is assigned to your booking yet. If you are seeing this,
                  please tell us: it is our mistake, not yours.
                </p>
              )}
            </section>

            <FamilyShares token={value} />

            <div className="mt-10 border-t border-white/12 pt-8">
              <h2 className="font-serif text-2xl">Take it with you</h2>
              <p className="mt-3 max-w-[62ch] text-[15px] leading-relaxed text-ink-inverse/70">
                There is no mobile network for long stretches above Dharchula. Print
                this before you leave, or save it as a PDF.
              </p>
              <div className="mt-5 flex flex-wrap gap-3">
                <Link
                  href={`/booking/pack?token=${encodeURIComponent(value)}`}
                  className="inline-block rounded-full px-5 py-2.5 text-sm text-ink-inverse ring-1 ring-white/25 transition-colors hover:ring-white/50"
                >
                  Open your trip pack
                </Link>
                {/*
                  The companion is the during-trip page. It caches itself, so opening
                  it once before leaving is what makes it work at altitude — which is
                  why the link says that rather than just naming the page.
                */}
                <Link
                  href={`/trip?token=${encodeURIComponent(value)}`}
                  className="inline-block rounded-full px-5 py-2.5 text-sm text-ink-inverse ring-1 ring-white/25 transition-colors hover:ring-white/50"
                >
                  Open your journey page. Do this before you leave
                </Link>
              </div>
            </div>

            <p className="mt-10 text-sm leading-relaxed text-ink-inverse/50">
              This page is live. It changes as your booking does, so it is worth
              checking rather than relying on an older message. We do not guarantee
              darshan, weather, visibility or route access.
            </p>
          </>
        )}
      </div>
    </main>
  );
}
