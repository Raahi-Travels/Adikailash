import { setRequestLocale } from "next-intl/server";

import { Altitude, Departures as CalendarIcon, Group, Vehicle } from "@/components/icons";
import { SceneBackdrop } from "@/components/scene";
import { Link } from "@/i18n/navigation";
import { api, type Departure, type Locale } from "@/lib/api";
import { buildMetadata, whatsappLink } from "@/lib/brand";

/**
 * Public departure dates.
 *
 * The hard rule here comes from doc 04: a departure's lifecycle state decides what a
 * visitor is allowed to do, and the page must not offer an action the state does not
 * permit. The API already computes `payment_action`; this page renders that and never
 * second-guesses it. A "Book now" button on a minimum-group-pending departure is the
 * exact overpromise the whole state machine exists to prevent.
 *
 * Dates are grouped by month because that is how people actually plan leave.
 */

export const metadata = buildMetadata({
  title: "Departure dates",
  description:
    "Confirmed and forming departure dates for Adi Kailash and Om Parvat, with group size, what is included and what each date is currently open for.",
  path: "/departures",
});

/**
 * What the visitor may do, keyed by departure **state**.
 *
 * The CTA comes from the state, not from `payment_action`. Those are two different
 * questions: the state says whether this date is open to a person, `payment_action`
 * says whether money may move. Right now payments are globally off (decisions O2 to
 * O4), so every departure reports `payment_action: "none"` — and reading the CTA off
 * that would label a perfectly open departure "not open yet".
 *
 * Doc 04 requires a conditional reservation to be "described honestly", so each note
 * says what actually happens next rather than borrowing retail language.
 */
const ACTION: Record<string, { label: string; note: string; emphasis: boolean }> = {
  proposed: {
    label: "Register interest",
    note: "We are planning this date. Telling us now shapes whether it runs.",
    emphasis: true,
  },
  waitlist_open: {
    label: "Join the waitlist",
    note: "The group is full. We will come back to you if a place opens.",
    emphasis: false,
  },
  conditional_reservation: {
    label: "Hold a place",
    note: "A conditional hold, not a booking. It becomes a booking only once the group and the route are confirmed, and it is refundable until then.",
    emphasis: true,
  },
  open_for_booking: {
    label: "Enquire about this date",
    note: "Open. We talk it through before anything is held.",
    emphasis: true,
  },
  minimum_group_pending: {
    label: "Enquire about this date",
    note: "Running only if a few more people join. We will tell you where the count stands.",
    emphasis: true,
  },
  confirmed: {
    label: "Enquire about this date",
    note: "Confirmed and running. Ask us whether places are left.",
    emphasis: true,
  },
  preparation: {
    label: "Enquire about this date",
    note: "Confirmed and close to departure. Joining late is sometimes possible.",
    emphasis: true,
  },
  ready_to_depart: {
    label: "Leaving shortly",
    note: "This group is about to set out.",
    emphasis: false,
  },
  in_progress: {
    label: "On the road",
    note: "This group is travelling right now.",
    emphasis: false,
  },
  suspended: {
    label: "On hold",
    note: "Suspended while conditions are unclear. We are not taking anyone new onto it.",
    emphasis: false,
  },
  rescheduled: {
    label: "Being moved",
    note: "This date is moving. Ask us where it is likely to land.",
    emphasis: false,
  },
  cancelled: {
    label: "Cancelled",
    note: "This date is not running.",
    emphasis: false,
  },
};

const FALLBACK_ACTION = {
  label: "Ask us about this date",
  note: "Talk to a person before anything is held.",
  emphasis: true,
};

/**
 * The money position, stated separately from the CTA.
 *
 * `none` here means no payment may be taken, which today is true of every departure
 * because the platform-wide payment gate is closed until O2 to O4 are settled.
 */
const PAYMENT_NOTE: Record<string, string> = {
  none: "Nothing is paid on this website. Anything to do with money happens with a person.",
  protected_reservation:
    "A refundable hold, not a purchase. It is returned in full if the departure does not confirm.",
  deposit: "A deposit reserves your place. The balance is due before departure.",
  balance: "The remaining balance is due for this departure.",
};

function monthKey(iso: string, locale: string) {
  return new Intl.DateTimeFormat(locale === "hi" ? "hi-IN" : "en-IN", {
    month: "long",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  }).format(new Date(iso));
}

function dayRange(start: string, end: string, locale: string) {
  const tag = locale === "hi" ? "hi-IN" : "en-IN";
  const opts = { day: "numeric", month: "short", timeZone: "Asia/Kolkata" } as const;
  const s = new Intl.DateTimeFormat(tag, opts).format(new Date(start));
  const e = new Intl.DateTimeFormat(tag, opts).format(new Date(end));
  return `${s} to ${e}`;
}

function nights(start: string, end: string) {
  const ms = new Date(end).getTime() - new Date(start).getTime();
  return Math.max(0, Math.round(ms / 86_400_000));
}

function DepartureRow({
  departure: d,
  locale,
}: {
  departure: Departure;
  locale: string;
}) {
  const action = ACTION[d.state] ?? FALLBACK_ACTION;
  const paymentNote = PAYMENT_NOTE[d.payment_action];
  // Carry the date into the conversation. Doc 04: "The customer should not have to
  // repeat which package they were viewing."
  const wa = whatsappLink({
    intent: "journey",
    journey: d.journey_name,
    departure: dayRange(d.start_date, d.end_date, "en"),
  });
  const placesLeft = Math.max(0, d.capacity - d.reserved_count);

  return (
    <article className="border-t border-white/12 py-7">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        <div>
          <p className="text-sm text-ink-inverse/55">
            <time dateTime={d.start_date}>{dayRange(d.start_date, d.end_date, locale)}</time>
            <span className="mx-2 text-ink-inverse/30">·</span>
            {nights(d.start_date, d.end_date)} nights
          </p>
          <h3 className="mt-1.5 font-serif text-xl">
            <Link
              href={`/journeys/${d.journey_slug}`}
              className="transition-colors hover:text-gold"
            >
              {d.journey_name}
            </Link>
          </h3>
          <p className="mt-1 text-[15px] text-ink-inverse/70">{d.tier_name}</p>
        </div>

        <div className="text-right">
          <p className="text-sm text-ink-inverse/75">{d.state_label}</p>
          {d.price ? (
            <p className="mt-1 font-serif text-lg">{d.price}</p>
          ) : (
            <p className="mt-1 text-sm text-ink-inverse/45">Price on enquiry</p>
          )}
        </div>
      </div>

      <dl className="mt-4 flex flex-wrap gap-x-7 gap-y-2 text-sm text-ink-inverse/60">
        <div className="flex items-center gap-2">
          <Group className="size-4 shrink-0 text-ink-inverse/40" />
          <dt className="sr-only">Group</dt>
          <dd>
            {d.availability_label}
            {placesLeft > 0 && placesLeft <= 4 ? `, ${placesLeft} of ${d.capacity} left` : ""}
          </dd>
        </div>
        {d.gateway && (
          <div className="flex items-center gap-2">
            <Vehicle className="size-4 shrink-0 text-ink-inverse/40" />
            <dt className="sr-only">Starts from</dt>
            <dd>Starts from {d.gateway}</dd>
          </div>
        )}
        {/*
          Doc 06: where a licensed partner operates the trip, say so on the page the
          visitor is buying from, not only in the terms.
        */}
        {d.operator_disclosed && d.operator_name && (
          <div className="flex items-center gap-2">
            <Altitude className="size-4 shrink-0 text-ink-inverse/40" />
            <dt className="sr-only">Operated by</dt>
            <dd>Operated by {d.operator_name}</dd>
          </div>
        )}
      </dl>

      <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-3">
        {/*
          When the WhatsApp number is still undecided (O9), `whatsappLink` returns
          null and we fall back to the enquiry form rather than rendering a dead CTA.
        */}
        {action.emphasis ? (
          wa ? (
            <a
              href={wa}
              className="rounded-full bg-gold px-5 py-2.5 text-sm font-medium text-midnight transition-transform hover:brightness-105 active:scale-[0.98]"
            >
              {action.label}
            </a>
          ) : (
            <Link
              href="/enquire"
              className="rounded-full bg-gold px-5 py-2.5 text-sm font-medium text-midnight transition-transform hover:brightness-105 active:scale-[0.98]"
            >
              {action.label}
            </Link>
          )
        ) : (
          <span className="rounded-full px-4 py-2 text-sm text-ink-inverse/60 ring-1 ring-white/15">
            {action.label}
          </span>
        )}
        <div className="max-w-[52ch] text-sm leading-relaxed text-ink-inverse/55">
          <p>{action.note}</p>
          {action.emphasis && paymentNote && (
            <p className="mt-1 text-ink-inverse/40">{paymentNote}</p>
          )}
        </div>
      </div>
    </article>
  );
}

export default async function DeparturesPage({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const departures = await api.departures(locale as Locale);

  // Group by month. Server-side so the month headings are real text in the HTML.
  const months = new Map<string, Departure[]>();
  for (const d of departures ?? []) {
    const key = monthKey(d.start_date, locale);
    const bucket = months.get(key);
    if (bucket) bucket.push(d);
    else months.set(key, [d]);
  }

  return (
    <main id="main" className="flex-1 bg-midnight text-ink-inverse">
      {/* Header band. The calendar reads as a spreadsheet without it; a road under the
          heading attaches the dates to a place. Falls back to ridge art with no file. */}
      <section className="relative isolate overflow-hidden px-4 py-16 sm:px-6 sm:py-20">
        <SceneBackdrop name="departures" />
        <div className="mx-auto max-w-4xl">
          <div className="flex items-center gap-3 text-gold">
            <CalendarIcon className="size-6" />
            <p className="text-sm uppercase tracking-[0.14em]">Dates</p>
          </div>
          <h1 className="mt-4 font-serif text-4xl leading-tight sm:text-5xl">
            When we are going
          </h1>
          <p className="mt-5 max-w-[62ch] text-[15px] leading-relaxed text-ink-inverse/70">
            Small groups on fixed dates, plus private departures on dates you choose.
            Each date below says exactly what it is open for right now. A date that is
            still forming is described that way rather than sold as confirmed.
          </p>
        </div>
      </section>

      <div className="px-4 pb-16 sm:px-6 sm:pb-20">
        <div className="mx-auto max-w-4xl">
        {departures === null && (
          <p className="mt-12 rounded-lg bg-himalayan px-5 py-4 text-[15px] ring-1 ring-white/10">
            We cannot load dates right now. Please message us and we will send the
            current calendar.
          </p>
        )}

        {departures !== null && departures.length === 0 && (
          <div className="mt-12 rounded-lg bg-himalayan px-5 py-6 ring-1 ring-white/10">
            <p className="text-[15px] leading-relaxed">
              No dates are published yet. The Adi Kailash season runs roughly May to
              October, and we open dates once the road and permit position for the year
              is clear.
            </p>
            <Link
              href="/enquire"
              className="mt-4 inline-block text-sm text-gold underline-offset-4 hover:underline"
            >
              Tell us when you want to travel
            </Link>
          </div>
        )}

        {[...months.entries()].map(([month, list]) => (
          <section key={month} className="mt-14">
            <h2 className="font-serif text-2xl text-ink-inverse/85">{month}</h2>
            <div className="mt-4">
              {list.map((d) => (
                <DepartureRow key={d.id} departure={d} locale={locale} />
              ))}
            </div>
          </section>
        ))}

        <div className="mt-16 border-t border-white/12 pt-8">
          <h2 className="font-serif text-2xl">Nothing here fits?</h2>
          <p className="mt-3 max-w-[62ch] text-[15px] leading-relaxed text-ink-inverse/70">
            Most of what we run is private: your family, your pace, dates that suit your
            leave. Tell us roughly when, and we will tell you honestly whether that
            window works on this route.
          </p>
          <div className="mt-5 flex flex-wrap gap-4">
            <Link
              href="/enquire"
              className="rounded-full bg-gold px-5 py-2.5 text-sm font-medium text-midnight transition-transform hover:brightness-105 active:scale-[0.98]"
            >
              Plan a private departure
            </Link>
            <Link
              href="/status"
              className="rounded-full px-5 py-2.5 text-sm text-ink-inverse/80 ring-1 ring-white/20 transition-colors hover:text-ink-inverse"
            >
              Check route and permit status
            </Link>
          </div>
        </div>

        <p className="mt-12 text-sm leading-relaxed text-ink-inverse/55">
          Dates can move. Landslides, permit decisions and weather on this route are
          outside anyone&apos;s control, and we would rather change a date than run one we
          are not confident about. What happens to your money when a date changes is set
          out in our{" "}
          <Link href="/policies/cancellation" className="text-gold underline-offset-4 hover:underline">
            cancellation policy
          </Link>
          .
        </p>
        </div>
      </div>
    </main>
  );
}
