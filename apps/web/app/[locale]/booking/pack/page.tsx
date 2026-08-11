import { setRequestLocale } from "next-intl/server";

import { buildMetadata } from "@/lib/brand";

/**
 * The trip pack: the booking, printed.
 *
 * Doc 09 lists a "printed or offline contingency pack" among Phase 3's manual
 * allowances, and it is not a nicety here. There is no mobile network for long
 * stretches above Dharchula, so the version of this that matters is the one on
 * paper in somebody's bag.
 *
 * That constraint drives every decision on this page:
 *
 *   - Light ground, black text. The rest of the site is midnight navy, which on an
 *     inkjet is a wet grey page and an empty cartridge.
 *   - No images, no icons, no background colours. Nothing that fails to print.
 *   - The state sentence is included in full, because the paper copy will be read
 *     days after it was printed and "held" must still not read as "booked".
 *   - Emergency contact and the honest gaps are on it, since the whole point is the
 *     moment when nobody can look anything up.
 */

export const metadata = {
  ...buildMetadata({
    title: "Trip pack",
    description: "A printable summary of your booking.",
    path: "/booking/pack",
  }),
  robots: { index: false, follow: false },
};

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8010";

type Pack = {
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
  accepted_policies: { policy: string; version: string; accepted_at: string | null }[];
  documents_outstanding: number;
  outstanding: string[];
  updates: { id: number; category: string; title: string; body: string; created_at: string }[];
};

function money(amount: string, currency = "INR") {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(Number(amount));
}

function when(iso: string | null) {
  if (!iso) return null;
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  }).format(new Date(iso));
}

const POLICY_LABEL: Record<string, string> = {
  terms: "Terms of service",
  cancellation: "Cancellation and refunds",
  privacy: "Privacy",
  consent: "Consent",
};

const H = "mt-8 text-[11pt] font-semibold uppercase tracking-[0.1em] text-black";
const RULE = "mt-2 border-t border-black/25 pt-3";

export default async function TripPackPage({
  params,
  searchParams,
}: PageProps<"/[locale]/booking/pack">) {
  const { locale } = await params;
  const { token } = await searchParams;
  setRequestLocale(locale);

  const value = typeof token === "string" ? token : "";
  let pack: Pack | null = null;
  if (value) {
    try {
      const res = await fetch(
        `${BASE}/traveller/booking?token=${encodeURIComponent(value)}&locale=${locale}`,
        { cache: "no-store" },
      );
      if (res.ok) pack = await res.json();
    } catch {
      pack = null;
    }
  }

  if (!pack) {
    return (
      <main id="main" className="flex-1 bg-white px-6 py-16 text-black">
        <div className="mx-auto max-w-2xl">
          <h1 className="text-2xl">Trip pack</h1>
          <p className="mt-4 text-[15px] leading-relaxed">
            This link is not valid. It may have expired. Please ask the team for a new
            one.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main id="main" className="flex-1 bg-white px-6 py-10 text-black print:p-0">
      <div className="mx-auto max-w-2xl text-[10.5pt] leading-relaxed">
        {/* Screen-only. Nothing that says "click" belongs on the paper copy. */}
        <p className="mb-8 rounded border border-black/20 px-4 py-3 text-[10pt] print:hidden">
          Print this page, or save it as a PDF. There is no mobile network for long
          stretches above Dharchula, so the copy that matters is the one in your bag.
        </p>

        <header className="border-b-2 border-black pb-3">
          <div className="flex items-baseline justify-between gap-4">
            <h1 className="text-[16pt] font-semibold">
              {pack.journey_name ?? "Your journey"}
            </h1>
            <span className="font-mono text-[11pt]">{pack.reference}</span>
          </div>
          <p className="mt-1">
            {when(pack.start_date)} to {when(pack.end_date)}
            {pack.gateway ? ` · starting from ${pack.gateway}` : ""}
          </p>
        </header>

        {/*
          In full, on the paper. This will be read days after printing, and "held"
          must not have quietly become "booked" in somebody's memory by then.
        */}
        <section>
          <h2 className={H}>Status of this booking</h2>
          <div className={RULE}>
            <p className="font-semibold">{pack.state_label}</p>
            <p className="mt-1">{pack.state_meaning}</p>
          </div>
        </section>

        <section>
          <h2 className={H}>Who is travelling</h2>
          <ul className={RULE}>
            {pack.travellers.map((t) => (
              <li key={t.full_name} className="flex justify-between border-b border-black/10 py-1.5">
                <span>{t.full_name}</span>
                <span className="text-black/60">
                  {t.role === "group_lead" ? "main contact" : ""}
                  {t.is_senior ? (t.role === "group_lead" ? " · elder" : "elder") : ""}
                </span>
              </li>
            ))}
            {pack.travellers.length < pack.party_size && (
              <li className="py-1.5">
                {pack.party_size - pack.travellers.length} traveller(s) still to be named
              </li>
            )}
          </ul>
        </section>

        <section>
          <h2 className={H}>Who is looking after you</h2>
          <div className={RULE}>
            <p>{pack.coordinator ?? "Not assigned. Tell us if you see this."}</p>
            {/*
              Deliberately not a fabricated phone number. The support number is still
              decision O9, and a printed page carrying a made-up emergency contact is
              worse than one that says to write it down.
            */}
            <p className="mt-3 border border-black/25 px-3 py-2">
              Emergency contact number:
              <span className="ml-2 inline-block min-w-[45%] border-b border-black/40" />
              <span className="mt-1 block text-[9.5pt] text-black/60">
                Write your coordinator&apos;s number here before you leave. Do not rely
                on being able to look it up above Dharchula.
              </span>
            </p>
          </div>
        </section>

        <section>
          <h2 className={H}>Money</h2>
          <div className={RULE}>
            <p>
              {money(pack.amount_received, pack.currency)} received of{" "}
              {money(pack.amount_due, pack.currency)}.
              {Number(pack.balance_outstanding) > 0 &&
                ` ${money(pack.balance_outstanding, pack.currency)} outstanding.`}
            </p>
            <p className="mt-1 text-black/70">
              Nothing is ever paid through this website. If anyone asks you to, it is
              not us.
            </p>
          </div>
        </section>

        {pack.outstanding.length > 0 && (
          <section>
            <h2 className={H}>Still outstanding</h2>
            <ul className={RULE}>
              {pack.outstanding.map((item) => (
                <li key={item} className="border-b border-black/10 py-1.5">
                  {item}
                </li>
              ))}
            </ul>
          </section>
        )}

        {pack.accepted_policies.length > 0 && (
          <section>
            <h2 className={H}>What you agreed to</h2>
            <ul className={RULE}>
              {pack.accepted_policies.map((a) => (
                <li
                  key={`${a.policy}-${a.version}`}
                  className="flex justify-between border-b border-black/10 py-1.5"
                >
                  <span>{POLICY_LABEL[a.policy] ?? a.policy}</span>
                  <span className="text-black/60">
                    version {a.version}
                    {a.accepted_at ? ` · ${when(a.accepted_at)}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {pack.updates.length > 0 && (
          <section>
            <h2 className={H}>Messages from your coordinator</h2>
            <div className={RULE}>
              {pack.updates.map((u) => (
                <article key={u.id} className="border-b border-black/10 py-2.5">
                  <div className="flex justify-between gap-4">
                    <p className="font-semibold">{u.title}</p>
                    <span className="shrink-0 text-black/60">{when(u.created_at)}</span>
                  </div>
                  <p className="mt-1 whitespace-pre-line">{u.body}</p>
                </article>
              ))}
            </div>
          </section>
        )}

        <footer className="mt-10 border-t-2 border-black pt-3 text-[9.5pt] leading-relaxed text-black/70">
          <p>
            Printed from your booking page. It was accurate at the moment it was
            printed and the booking can change after that, so check the live page when
            you have signal.
          </p>
          <p className="mt-2">
            We do not guarantee darshan, weather, visibility or route access. High
            altitude travel carries real health risk. Route and permit information is
            what our coordinators last verified, with the time shown.
          </p>
        </footer>
      </div>
    </main>
  );
}
