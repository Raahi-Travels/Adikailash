import { getTranslations, setRequestLocale } from "next-intl/server";

import { SceneBackdrop } from "@/components/scene";
import { PrimaryAction, QuietAction } from "@/components/ui/action";
import { Band, Content } from "@/components/ui/band";
import { EmptyState } from "@/components/ui/empty-state";
import { PhotoNote } from "@/components/ui/figure";
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
 * This is a comparison surface before it is a conversion one. Somebody arriving here
 * is holding a leave calendar and asking which window is survivable, which group is
 * still forming, and what any of it commits them to. So the page is built as an
 * instrument: a season chart drawn from the published dates themselves, then a ledger
 * grouped by month, then one way out for people none of it suits.
 *
 * **Nothing here is invented.** Every number on the page is a field of `Departure`
 * or arithmetic on two of them: the window comes from the earliest start and the
 * latest end, the nights from the difference, the places from `reserved_count` and
 * `capacity`. There is no price the API did not send, no "selling fast", no seasonal
 * claim beyond the months the data itself occupies. When the list is empty the empty
 * state is the design rather than an apology, because "no dates yet" is the true
 * answer and a table of blank rows is not.
 */

export async function generateMetadata({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;
  return buildMetadata({
    title: "Departure dates",
    description:
      "Confirmed and forming departure dates for Adi Kailash and Om Parvat, with group size, what is included and what each date is currently open for.",
    path: "/departures",
    locale,
  });
}

/**
 * What the visitor may do, keyed by departure **state**.
 *
 * The CTA comes from the state, not from `payment_action`. Those are two different
 * questions: the state says whether this date is open to a person, `payment_action`
 * says whether money may move. Right now payments are globally off (decisions O2 to
 * O4), so every departure reports `payment_action: "none"`, and reading the CTA off
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

/**
 * Which status token carries each state.
 *
 * Colour is the third signal here, never the first: every mark on this page is
 * accompanied by the state's own words, because doc 02 requires status to survive
 * greyscale. The token is written as a `var()` in an inline style rather than a
 * `bg-status-*` class because the class name would be assembled at runtime and
 * Tailwind's scanner would never generate it.
 */
const STATE_TONE: Record<string, string> = {
  proposed: "var(--color-status-unverified)",
  waitlist_open: "var(--color-status-waitlist)",
  conditional_reservation: "var(--color-status-limited)",
  open_for_booking: "var(--color-status-open)",
  minimum_group_pending: "var(--color-status-limited)",
  confirmed: "var(--color-status-open)",
  preparation: "var(--color-status-open)",
  ready_to_depart: "var(--color-status-open)",
  in_progress: "var(--color-status-open)",
  suspended: "var(--color-status-suspended)",
  rescheduled: "var(--color-status-changed)",
  cancelled: "var(--color-status-suspended)",
  completed: "var(--color-status-done)",
};

const TONE_FALLBACK = "var(--color-status-unverified)";

/**
 * The state's label in the reader's own language.
 *
 * The API sends `state_label`, but only in English. Doc 02 calls Hindi "a first-class
 * layout, not a smaller translation", so where `messages/*.json` has the state we use
 * it and where it does not we fall back rather than printing a key.
 */
const STATE_KEY: Record<string, string> = {
  waitlist_open: "waitlistOpen",
  conditional_reservation: "conditionalReservation",
  open_for_booking: "openForBooking",
  minimum_group_pending: "minimumGroupPending",
  confirmed: "confirmed",
  suspended: "suspended",
  rescheduled: "rescheduled",
  cancelled: "cancelled",
  completed: "completed",
};

/**
 * States where `reserved_count` can be read plainly against `capacity`.
 *
 * A waitlisted or suspended departure can carry a reserved count that does not mean
 * what the meter would appear to say, and drawing eight empty seats beside the words
 * "waitlist open" is a contradiction the reader has to resolve. Where the number is
 * not plainly readable we print the API's own availability sentence and nothing else.
 */
const COUNTABLE = new Set([
  "proposed",
  "conditional_reservation",
  "open_for_booking",
  "minimum_group_pending",
  "confirmed",
  "preparation",
]);

const DAY = 86_400_000;

function tag(locale: string) {
  return locale === "hi" ? "hi-IN" : "en-IN";
}

function monthLabel(iso: string, locale: string) {
  return new Intl.DateTimeFormat(tag(locale), {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(iso));
}

function monthId(iso: string) {
  return `month-${iso.slice(0, 7)}`;
}

function dayMonth(iso: string, locale: string) {
  return new Intl.DateTimeFormat(tag(locale), {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(iso));
}

function fullDate(iso: string, locale: string) {
  return new Intl.DateTimeFormat(tag(locale), {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(iso));
}

function nights(start: string, end: string) {
  return Math.max(0, Math.round((Date.parse(end) - Date.parse(start)) / DAY));
}

/**
 * The season chart, computed from the dates themselves.
 *
 * The window is not a season we assert, it is the span the published departures
 * actually occupy, rounded out to whole months so the axis has somewhere to put its
 * labels. If one date is published the chart is one month wide, and that is the true
 * shape of what has been published.
 *
 * Bars are packed into lanes so two overlapping departures never draw on top of each
 * other. With sequential dates that resolves to a single lane and the chart stays one
 * line high.
 */
function season(items: Departure[], locale: string) {
  const starts = items.map((d) => Date.parse(d.start_date));
  const ends = items.map((d) => Date.parse(d.end_date));
  const first = new Date(Math.min(...starts));
  const last = new Date(Math.max(...ends));

  const from = Date.UTC(first.getUTCFullYear(), first.getUTCMonth(), 1);
  const to = Date.UTC(last.getUTCFullYear(), last.getUTCMonth() + 1, 1);
  const span = Math.max(to - from, DAY);

  const months: Array<{ key: string; label: string; left: number }> = [];
  for (let cursor = from; cursor < to; ) {
    const at = new Date(cursor);
    const next = Date.UTC(at.getUTCFullYear(), at.getUTCMonth() + 1, 1);
    months.push({
      key: at.toISOString().slice(0, 7),
      label: new Intl.DateTimeFormat(tag(locale), {
        month: "short",
        timeZone: "UTC",
      }).format(at),
      left: ((cursor - from) / span) * 100,
    });
    cursor = next;
  }

  const sorted = [...items].sort((a, b) => Date.parse(a.start_date) - Date.parse(b.start_date));
  const lanes: Departure[][] = [];
  const laneEnd: number[] = [];
  for (const d of sorted) {
    const s = Date.parse(d.start_date);
    let lane = laneEnd.findIndex((end) => end + DAY * 3 < s);
    if (lane === -1) {
      lanes.push([]);
      laneEnd.push(-Infinity);
      lane = lanes.length - 1;
    }
    lanes[lane].push(d);
    laneEnd[lane] = Date.parse(d.end_date);
  }

  const geometry = (d: Departure) => {
    const s = Date.parse(d.start_date);
    const e = Date.parse(d.end_date);
    return {
      left: ((s - from) / span) * 100,
      width: ((e + DAY - s) / span) * 100,
    };
  };

  return { months, lanes, geometry };
}

/**
 * The season chart.
 *
 * A row of month labels, a hairline per month boundary, and one bar per departure
 * positioned and sized by its real dates. Each bar is a link into the entry below, so
 * this is navigation as well as an overview, which is why it carries no heading of
 * its own: the months underneath are the headings.
 *
 * Every bar keeps a 3rem minimum width so a short departure on a phone is still a
 * target you can hit, and the track clips horizontally so that minimum can never push
 * the page into a horizontal scroll.
 */
function SeasonChart({
  items,
  locale,
  stateLabel,
}: {
  items: Departure[];
  locale: string;
  stateLabel: (d: Departure) => string;
}) {
  const { months, lanes, geometry } = season(items, locale);

  // One legend entry per state actually present, in the order the dates run.
  const legend: Array<{ state: string; label: string }> = [];
  for (const d of items) {
    if (!legend.some((l) => l.state === d.state)) {
      legend.push({ state: d.state, label: stateLabel(d) });
    }
  }

  return (
    <nav aria-label="Published dates by month">
      <div className="relative h-7 overflow-x-clip">
        {months.map((m) => (
          <span
            key={m.key}
            style={{ left: `${m.left}%` }}
            className="type-meta absolute top-0 pl-2 text-tone-body"
          >
            {m.label}
          </span>
        ))}
      </div>

      <div className="relative overflow-x-clip">
        {months.map((m) => (
          <span
            key={m.key}
            aria-hidden
            style={{ left: `${m.left}%` }}
            className="absolute inset-y-0 w-px bg-tone-line"
          />
        ))}

        {lanes.map((lane, index) => (
          <div key={index} className="relative h-14">
            {lane.map((d) => {
              const { left, width } = geometry(d);
              return (
                <a
                  key={d.id}
                  href={`#departure-${d.id}`}
                  style={{ left: `${left}%`, width: `${width}%`, minWidth: "3rem" }}
                  className="group absolute inset-y-0 flex flex-col justify-center gap-2 pl-2"
                >
                  <span className="type-meta type-reading text-tone-strong">
                    {new Intl.DateTimeFormat(tag(locale), {
                      day: "numeric",
                      timeZone: "UTC",
                    }).format(new Date(d.start_date))}
                  </span>
                  <span className="sr-only">
                    {`${fullDate(d.start_date, locale)} to ${fullDate(d.end_date, locale)}, ${d.journey_name}`}
                  </span>
                  <span
                    aria-hidden
                    style={{ background: STATE_TONE[d.state] ?? TONE_FALLBACK }}
                    className="h-2.5 rounded-pill transition-transform duration-[var(--dur-base)] ease-standard group-hover:scale-y-150 motion-reduce:transition-none motion-reduce:group-hover:scale-y-100"
                  />
                </a>
              );
            })}
          </div>
        ))}
      </div>

      {/* The axis. A rule inside an instrument, not a divider between sections. */}
      <div aria-hidden className="h-px w-full bg-tone-line" />

      <ul className="mt-5 flex flex-wrap gap-x-7 gap-y-2">
        {legend.map((l) => (
          <li key={l.state} className="type-meta flex items-center gap-2 text-tone-body">
            <span
              aria-hidden
              style={{ background: STATE_TONE[l.state] ?? TONE_FALLBACK }}
              className="size-2.5 shrink-0 rounded-pill"
            />
            {l.label}
          </li>
        ))}
      </ul>
      <p className="type-meta measure-meta mt-3 text-tone-body">
        Each bar is one departure, drawn on the days it actually runs. Select one to
        jump to it.
      </p>
    </nav>
  );
}

/**
 * The capacity meter.
 *
 * `capacity` marks, `reserved_count` of them filled. It is drawn only where the two
 * numbers can be read plainly against the state, and the sentence beneath is the
 * accessible version of it: the marks are decoration over a fact that is written out.
 */
function Places({ capacity, reserved }: { capacity: number; reserved: number }) {
  if (capacity <= 0 || capacity > 40) return null;
  const held = Math.min(Math.max(reserved, 0), capacity);

  return (
    <div className="mt-3">
      <span aria-hidden className="flex flex-wrap gap-1">
        {Array.from({ length: capacity }, (_, i) => (
          <span
            key={i}
            className={`h-4 w-1 rounded-pill ${i < held ? "bg-tone-strong" : "bg-tone-line"}`}
          />
        ))}
      </span>
      <p className="type-meta type-reading mt-2 text-tone-body">
        {held} of {capacity} places reserved
      </p>
    </div>
  );
}

function StateMark({ state, label }: { state: string; label: string }) {
  return (
    <p className="type-meta flex items-center gap-2 text-tone-strong">
      <span
        aria-hidden
        style={{ background: STATE_TONE[state] ?? TONE_FALLBACK }}
        className="size-2.5 shrink-0 rounded-pill"
      />
      {label}
    </p>
  );
}

/**
 * One departure.
 *
 * A ledger row rather than a card: three fields across a twelve column grid, with the
 * date carrying the weight because the date is what a person is comparing. The lead
 * departure, the nearest one still open to somebody, is set a size larger and holds
 * the page's one gold action; everything after it is the same row in a quieter voice,
 * which is what stops a list of four dates reading as four identical boxes.
 */
function DepartureEntry({
  departure: d,
  locale,
  stateLabel,
  lead,
  gold,
}: {
  departure: Departure;
  locale: string;
  stateLabel: string;
  lead: boolean;
  gold: boolean;
}) {
  const action = ACTION[d.state] ?? FALLBACK_ACTION;
  const paymentNote = PAYMENT_NOTE[d.payment_action];
  // Carry the date into the conversation. Doc 04: "The customer should not have to
  // repeat which package they were viewing."
  const wa = whatsappLink({
    intent: "journey",
    journey: d.journey_name,
    departure: `${dayMonth(d.start_date, "en")} to ${dayMonth(d.end_date, "en")}`,
  });
  const href = wa ?? "/enquire";

  return (
    <article
      id={`departure-${d.id}`}
      className="grid scroll-mt-12 items-start gap-x-10 gap-y-6 py-[var(--space-xl)] lg:grid-cols-12"
    >
      <div className="lg:col-span-3 lg:row-start-1">
        <p className="type-figure text-tone-strong">
          <time dateTime={d.start_date}>{dayMonth(d.start_date, locale)}</time>
        </p>
        <p className="type-meta type-reading mt-2 text-tone-body">
          Returns {dayMonth(d.end_date, locale)}, {nights(d.start_date, d.end_date)} nights
        </p>
      </div>

      <div className="lg:col-span-8 lg:col-start-4 lg:row-start-1">
        <h3 className={lead ? "type-title-1" : "type-title-2"}>
          <Link
            href={`/journeys/${d.journey_slug}`}
            className="text-tone-strong underline decoration-tone-line decoration-1 underline-offset-[10px] transition-colors duration-[var(--dur-fast)] hover:decoration-tone-strong"
          >
            {d.journey_name}
          </Link>
        </h3>
        <p className="type-meta mt-2 text-tone-body">{d.tier_name}</p>
      </div>

      <div className="lg:col-span-3 lg:col-start-1 lg:row-start-2">
        <StateMark state={d.state} label={stateLabel} />
        {/* The API's availability sentence, unless it is saying the same word as the
            state above it. "Open for booking" followed by "Open" is one fact typeset
            twice. */}
        {d.availability_label &&
          !stateLabel.toLowerCase().startsWith(d.availability_label.toLowerCase()) && (
            <p className="type-meta measure-meta mt-2 text-tone-body">
              {d.availability_label}
            </p>
          )}
        {COUNTABLE.has(d.state) && (
          <Places capacity={d.capacity} reserved={d.reserved_count} />
        )}
      </div>

      <div className="lg:col-span-8 lg:col-start-4 lg:row-start-2">
        <p className={`${lead ? "type-lead" : "type-body"} measure-card text-tone-body`}>
          {action.note}
        </p>

        <dl className="type-meta measure-meta mt-4 flex flex-col gap-1 text-tone-body">
          {d.price ? (
            <div className="flex gap-2">
              <dt className="text-tone-strong">Price</dt>
              <dd>{d.price}</dd>
            </div>
          ) : (
            <div className="flex gap-2">
              <dt className="text-tone-strong">Price</dt>
              <dd>On enquiry. We quote once the group and the vehicle are settled.</dd>
            </div>
          )}
          {d.gateway && (
            <div className="flex gap-2">
              <dt className="text-tone-strong">Starts from</dt>
              <dd>{d.gateway}</dd>
            </div>
          )}
          {/*
            Doc 06: where a licensed partner operates the trip, say so on the page the
            visitor is buying from, not only in the terms.
          */}
          {d.operator_disclosed && d.operator_name && (
            <div className="flex gap-2">
              <dt className="text-tone-strong">Operated by</dt>
              <dd>{d.operator_name}</dd>
            </div>
          )}
        </dl>

        <div className="mt-6">
          {/*
            When the WhatsApp number is still undecided (O9), `whatsappLink` returns
            null and we fall back to the enquiry form rather than rendering a dead CTA.
          */}
          {/*
            A waitlist that is open is, by its own name, something a person may join,
            so it gets a quiet action. It never gets the gold one: the group is full,
            and the loudest thing on a page should not be the date you cannot have.
          */}
          {action.emphasis || d.state === "waitlist_open" ? (
            gold && action.emphasis ? (
              <PrimaryAction href={href}>{action.label}</PrimaryAction>
            ) : (
              <QuietAction href={href}>{action.label}</QuietAction>
            )
          ) : (
            /*
              No button and no disabled-looking chip. Where the state does not permit
              an action, the state's own words in the column beside this one and the
              note above are the whole answer; a greyed-out pill saying "On hold" is a
              control that cannot be pressed, which reads as a fault rather than as a
              fact.
            */
            <p className="type-meta text-tone-body">
              There is nothing to do on this date at the moment.
            </p>
          )}
          {action.emphasis && paymentNote && (
            <p className="type-meta measure-meta mt-4 text-tone-body">{paymentNote}</p>
          )}
        </div>
      </div>
    </article>
  );
}

export default async function DeparturesPage({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [departures, t] = await Promise.all([
    api.departures(locale as Locale),
    getTranslations("departure"),
  ]);

  const list = [...(departures ?? [])].sort(
    (a, b) => Date.parse(a.start_date) - Date.parse(b.start_date),
  );
  const has = list.length > 0;

  const stateLabel = (d: Departure) => {
    const key = STATE_KEY[d.state];
    return key ? t(key) : d.state_label;
  };

  // Grouped by month, because that is how people actually plan leave. Server-side, so
  // the month headings are real text in the HTML rather than something JavaScript
  // assembles after the page has already been read by a crawler.
  const months = new Map<string, Departure[]>();
  for (const d of list) {
    const key = d.start_date.slice(0, 7);
    const bucket = months.get(key);
    if (bucket) bucket.push(d);
    else months.set(key, [d]);
  }

  // The one departure that gets the gold. The nearest date a person can actually act
  // on; if none of them is open to anybody, the gold moves to the private departure
  // request at the foot of the page, so there is exactly one on the page either way.
  const leadId = list.find((d) => (ACTION[d.state] ?? FALLBACK_ACTION).emphasis)?.id ?? null;

  const windowText = has
    ? `${fullDate(list[0].start_date, locale)} to ${fullDate(
        list.reduce((a, b) => (Date.parse(a.end_date) > Date.parse(b.end_date) ? a : b))
          .end_date,
        locale,
      )}`
    : null;
  const gateways = [...new Set(list.map((d) => d.gateway).filter(Boolean))];
  const journeys = [...new Set(list.map((d) => d.journey_name))];

  return (
    <main id="main" data-hero-page className="flex-1">
      {/*
        Dark, and that is a correction rather than a preference: this hero used to set
        ink-dark type over a dark photograph at 1.14:1, which is unreadable and was
        invisible in every check that did not render the page.
      */}
      <Band register="dark" className="pt-0">
        <SceneBackdrop name="departures" scrim="left" />
        {/*
          The pill is fixed and this page opts out of the layout's clearance, so the
          hero owns the offset itself. Inline rather than an arbitrary utility: the
          value is a `calc()` of four custom properties and belongs in one place.
        */}
        <div
          style={{
            paddingBlockStart:
              "calc(var(--chrome-top) + var(--nav-h) + var(--nav-inset) * 2 + var(--space-2xl))",
          }}
        >
          <Content>
          <h1 className="type-display glow-display text-tone-strong">When we are going</h1>
          <p className="type-lead mt-[var(--stack-title)] text-tone-body">
            Small groups on fixed dates, plus private departures on dates you choose.
            Every date below says what it is open for right now, and a date that is
            still forming is described that way rather than sold as confirmed.
          </p>

          {has && (
            /*
              The label reads under its value, but `dt` still comes first in the
              markup: a `dd` before its own `dt` is invalid, and a screen reader
              announces the pair in document order regardless of how it is painted.
              `flex-col-reverse` is the whole difference.
            */
            <dl className="mt-[var(--stack-block)] flex flex-wrap items-end gap-x-14 gap-y-8">
              <div className="flex flex-col-reverse">
                <dt className="type-meta mt-2 text-tone-muted">
                  {list.length === 1 ? "date published" : "dates published"}
                </dt>
                <dd className="type-figure type-reading text-tone-strong">{list.length}</dd>
              </div>
              <div className="flex flex-col-reverse">
                <dt className="type-meta mt-1 text-tone-muted">The published window</dt>
                <dd className="type-meta type-reading text-tone-strong">{windowText}</dd>
              </div>
              {journeys.length === 1 && (
                <div className="flex flex-col-reverse">
                  <dt className="type-meta mt-1 text-tone-muted">Journey</dt>
                  <dd className="type-meta text-tone-strong">{journeys[0]}</dd>
                </div>
              )}
              {gateways.length === 1 && (
                <div className="flex flex-col-reverse">
                  <dt className="type-meta mt-1 text-tone-muted">Everyone starts from</dt>
                  <dd className="type-meta text-tone-strong">{gateways[0]}</dd>
                </div>
              )}
            </dl>
          )}
          </Content>
        </div>
      </Band>

      <Band register="light" glow grain>
        <Content>
          {departures === null && (
            <EmptyState
              seed="departures-offline"
              title="We cannot load the dates right now"
              body="This page reads the calendar from our own system, and that request did not come back. Nothing is wrong with the dates themselves. Ask us and we will send the current list, or try this page again in a few minutes."
              action={<QuietAction href="/enquire">Ask us for the current dates</QuietAction>}
            />
          )}

          {departures !== null && !has && (
            <EmptyState
              seed="departures"
              title="No dates are published yet"
              body="The Adi Kailash season runs roughly May to October, and we publish a date only once the road and the permit position for that window are clear enough to stand behind. Publishing a calendar first and rearranging it later is how people end up with non refundable flights around a departure that was never going to run."
            />
          )}

          {has && (
            <>
              <SeasonChart items={list} locale={locale} stateLabel={stateLabel} />

              {[...months.entries()].map(([key, group]) => (
                <section
                  key={key}
                  id={monthId(group[0].start_date)}
                  className="mt-[var(--band-y-tight)]"
                >
                  <h2 className="type-title-1 text-tone-strong">
                    {monthLabel(group[0].start_date, locale)}
                  </h2>
                  <p className="type-meta type-reading mt-2 text-tone-body">
                    {group.length === 1 ? "1 date" : `${group.length} dates`}
                  </p>
                  {group.map((d) => (
                    <DepartureEntry
                      key={d.id}
                      departure={d}
                      locale={locale}
                      stateLabel={stateLabel(d)}
                      lead={d.id === leadId}
                      gold={d.id === leadId}
                    />
                  ))}
                </section>
              ))}
            </>
          )}

          {/*
            What actually decides a date, placed at the foot of the calendar because
            that is the question a person has by the time they have read it. The
            checkpost photograph is evidence rather than mood, so it is never graded:
            it is what the barrier looks like, and stylising it would be the one place
            this site cannot afford to.
          */}
          <aside className="mt-[var(--band-y-tight)] flex flex-col gap-10 sm:flex-row sm:items-center sm:gap-14">
            <PhotoNote
              name="permits"
              className="shrink-0"
              sizes="(min-width: 640px) 340px, 60vw"
            />
            <div>
              <h2 className="type-title-2 text-tone-strong">
                What decides whether a date runs
              </h2>
              <p className="type-body mt-[var(--stack-title)] text-tone-body">
                Every date here depends on the inner line permit for that window and on
                the road being open on the day. The route and permit page shows what a
                coordinator has verified so far, and where a leg has never been checked
                it says exactly that instead of guessing.
              </p>
              <p className="type-meta mt-5">
                <Link
                  href="/status"
                  className="text-tone-strong underline decoration-tone-line decoration-2 underline-offset-4 transition-colors duration-[var(--dur-fast)] hover:decoration-tone-strong"
                >
                  Route and permit status
                </Link>
              </p>
            </div>
          </aside>
        </Content>
      </Band>

      <Band register="dark" glow grain>
        <Content>
          <div className="flex flex-col gap-[var(--stack-block)] lg:flex-row lg:items-center lg:justify-between lg:gap-20">
          <div className="max-w-[42rem]">
            <h2 className="type-title-1 text-tone-strong">
              {has ? "Nothing here fits?" : "Tell us when you can travel"}
            </h2>
            <p className="type-body mt-[var(--stack-title)] text-tone-body">
              Most of what we run is private: your family, your pace, dates that suit
              your leave rather than ours. Tell us roughly when, and we will tell you
              honestly whether that window works on this route before anybody talks
              about money.
            </p>
            {/*
              One action, and it is gold. The route and permit page is already linked
              from the note above the fold of this band, and a second pill beside this
              one would make the page end on a choice rather than on an invitation.
              The gold budget is one fill per viewport: this one and the lead
              departure's are two full screens apart.
            */}
            <div className="mt-[var(--stack-title)]">
              <PrimaryAction href="/enquire">Plan a private departure</PrimaryAction>
            </div>
          </div>

          {/*
            A circle rather than a framed picture. A kitchen fire is one of the few
            subjects that survives a square crop, and a circle has no edge to feather,
            so this is the one image treatment that can sit beside a paragraph without
            either a hard rectangle or a mask ramp too short to read as anything but a
            smudge. Offset below the text block so it sits off the grid.
          */}
          <PhotoNote
            name="homestay-kitchen"
            className="shrink-0 lg:translate-y-6"
            sizes="(min-width: 1024px) 340px, 60vw"
            label="Private departures sleep in village houses, not in a hotel on the highway."
          />
          </div>

          <p className="type-meta measure-meta mt-[var(--band-y-tight)] text-tone-muted">
            Dates can move. Landslides, permit decisions and weather on this route are
            outside anyone&apos;s control, and we would rather change a date than run
            one we are not confident about. What happens to your money when a date
            changes is set out in our{" "}
            <Link
              href="/policies/cancellation"
              className="text-tone-strong underline decoration-tone-line decoration-2 underline-offset-4 transition-colors duration-[var(--dur-fast)] hover:decoration-tone-strong"
            >
              cancellation policy
            </Link>
            .
          </p>
        </Content>
      </Band>
    </main>
  );
}
