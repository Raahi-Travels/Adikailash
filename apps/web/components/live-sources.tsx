import { StatusChip, type ChipShape, type ChipTone } from "@/components/status-badge";
import { QuietAction } from "@/components/ui/action";
import { Surface } from "@/components/ui/surface";
import type { LiveSource, LiveSources as LiveSourcesData, Locale } from "@/lib/api";

/**
 * What other people publish about this road, kept visibly separate from what we
 * verified ourselves.
 *
 * Doc 08: third-party data must not be labelled authoritative without defined
 * verification. So this section never borrows the language of the route status above
 * it. A scraped government table and a coordinator who drove the road are different
 * kinds of claim, and a reader who cannot tell them apart will trust the wrong one.
 *
 * The permit state leads because it outranks everything else: if permits are not
 * being issued, no other fact on this page changes anybody's plans. It is quoted
 * verbatim rather than paraphrased, because "suspended until further orders" is not a
 * sentence to put in our own words.
 */

type PermitPayload = {
  is_issuing: boolean | null;
  notice: string | null;
  registration_open: boolean | null;
  uncertainty: string | null;
};

type RoadPayload = {
  caveat: string;
  unreported_above: string;
  closures: {
    road: string;
    status: string;
    is_closed: boolean;
    on_corridor: boolean;
    from: string | null;
    duration: string | null;
  }[];
};

type AlertsPayload = {
  covers: string;
  alerts: { title: string; published: string | null; is_severe: boolean }[];
};

type BedsPayload = {
  on_date: string;
  properties: {
    name: string;
    total_beds: number;
    available_beds: number;
    tariff_inr: number;
    is_full: boolean;
    is_scarce: boolean;
  }[];
};

/* ---------------------------------------------------------------- permit state */

export type PermitVerdict = {
  /** `unreadable` means the portal answered too long ago to repeat, not that it said no. */
  state: "issuing" | "not_issuing" | "unclear" | "unreadable";
  /** A whole sentence, because a bare word here is the one thing worth misreading. */
  headline: string;
  chip: string;
  tone: ChipTone;
  shape: ChipShape;
};

/**
 * The permit verdict, derived once and used twice: as the headline of the panel
 * below, and as the alert the status page raises at the top of itself.
 *
 * **A stale permit verdict is withheld rather than shown**, which is the opposite of
 * how every other reading on this page degrades, and deliberately so. This one is
 * binary and consequential in both directions: a stale "not being issued" turns away
 * somebody whose trip is now possible, and a stale "being issued" sends somebody
 * towards a closed border. Everything else here is a detail a reader can discount;
 * this is the fact they would act on.
 *
 * It matters in practice rather than in theory. The production host is in Kuala
 * Lumpur and this portal refuses non-Indian addresses, so the reading can sit
 * un-refreshable for as long as that is true.
 */
export function permitVerdict(data: LiveSourcesData | null): PermitVerdict | null {
  const permit = data?.permit_portal;
  if (!permit) return null;
  const payload = permit.payload as unknown as PermitPayload | undefined;

  if (permit.is_stale) {
    return {
      state: "unreadable",
      headline: "We cannot tell you whether Inner Line Permits are being issued",
      chip: "Cannot tell",
      tone: "unverified",
      shape: "clock",
    };
  }
  if (payload?.is_issuing === true) {
    return {
      state: "issuing",
      headline: "The state portal says Inner Line Permits are being issued",
      chip: "Being issued",
      tone: "open",
      shape: "tick",
    };
  }
  if (payload?.is_issuing === false) {
    return {
      state: "not_issuing",
      headline: "The state portal says Inner Line Permits are not being issued",
      chip: "Not being issued",
      tone: "suspended",
      shape: "cross",
    };
  }
  return {
    state: "unclear",
    headline: "The state portal did not say whether Inner Line Permits are being issued",
    chip: "No answer",
    tone: "unverified",
    shape: "ring",
  };
}

/* -------------------------------------------------------------------- helpers */

function age(iso: string, locale: Locale) {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  const rtf = new Intl.RelativeTimeFormat(locale === "hi" ? "hi-IN" : "en-IN", {
    numeric: "auto",
  });
  if (mins < 60) return rtf.format(-Math.max(mins, 1), "minute");
  if (mins < 1440) return rtf.format(-Math.round(mins / 60), "hour");
  return rtf.format(-Math.round(mins / 1440), "day");
}

function Freshness({ source, locale }: { source: LiveSource; locale: Locale }) {
  return (
    <p className="type-meta type-reading measure-meta mt-5 text-tone-muted">
      Read {age(source.fetched_at, locale)}
      {source.is_stale && ", and we have not been able to refresh it since"}
      {source.last_error && ". The last attempt failed"}
    </p>
  );
}

/**
 * A source block.
 *
 * No rule above it and no box around it. The redesign removed every hairline that
 * was doing a divider's job: what separates these is the space, and the heading is
 * at title size so it does not need a line to announce itself.
 */
function Block({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-[var(--band-y-tight)] first:mt-0">
      <h3 className="type-title-2 text-tone-strong">{title}</h3>
      <div className="mt-[var(--stack-title)]">{children}</div>
    </section>
  );
}

/** One row of a source's table. Two lines on a phone, one from `sm`. */
function Row({
  name,
  children,
}: {
  name: string;
  children: React.ReactNode;
}) {
  return (
    <li className="grid gap-x-8 gap-y-1.5 border-t border-tone-line py-4 first:border-t-0 first:pt-0 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-baseline">
      <span className="type-body text-tone-strong measure-none">{name}</span>
      <span className="flex flex-wrap items-baseline gap-x-5 gap-y-1 sm:justify-end">
        {children}
      </span>
    </li>
  );
}

/* ----------------------------------------------------------------------------- */

export function LiveSources({
  data,
  locale,
}: {
  data: LiveSourcesData | null;
  locale: Locale;
}) {
  if (!data) return null;

  const permit = data.permit_portal;
  const permitPayload = permit?.payload as unknown as PermitPayload | undefined;
  const verdict = permitVerdict(data);
  const road = data.road_register;
  const roadPayload = road?.payload as unknown as RoadPayload | undefined;
  const alerts = data.hazard_alerts;
  const alertsPayload = alerts?.payload as unknown as AlertsPayload | undefined;
  const beds = data.bed_availability;
  const bedsPayload = beds?.payload as unknown as BedsPayload | undefined;

  const corridorClosures =
    roadPayload?.closures.filter((c) => c.is_closed && c.on_corridor) ?? [];

  return (
    <div>
      <h2 id="outside" className="type-title-1 text-tone-strong">
        What others are publishing
      </h2>
      <p className="type-lead mt-[var(--stack-title)] text-tone-body">
        Read from government portals rather than checked by us. Kept apart from the
        road above for exactly that reason.
      </p>

      {/* The permit state, given the weight it actually carries. Not a row in a
          list: it is the fact that decides whether anything else matters. */}
      {permit && permitPayload && verdict && (
        <Surface
          radius="frame"
          className="mt-[var(--stack-block)] p-6 sm:p-8 lg:p-10"
        >
          <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
            <StatusChip tone={verdict.tone} shape={verdict.shape}>
              {verdict.chip}
            </StatusChip>
            <p className="type-meta text-tone-muted">Inner Line Permits</p>
          </div>

          <h3 className="type-title-2 mt-5 text-tone-strong">{verdict.headline}</h3>

          {verdict.state === "unreadable" && (
            <p className="type-body measure-body mt-5 text-tone-body">
              We have not been able to reach the portal recently enough to trust what
              it last told us, so we are not going to repeat it. Ask us, or read the
              portal yourself.
            </p>
          )}

          {/* Verbatim, and set apart by indent and italic rather than by a rule
              down the side. "Suspended until further orders" is not a sentence to
              put in our own words. */}
          {verdict.state !== "unreadable" && permitPayload.notice && (
            <blockquote className="mt-6 ps-5 sm:ps-8">
              <p className="type-lead measure-body italic text-tone-body">
                {permitPayload.notice}
              </p>
              <p className="type-meta mt-3 text-tone-muted">
                Quoted as published, not paraphrased.
              </p>
            </blockquote>
          )}

          {verdict.state !== "unreadable" && permitPayload.uncertainty && (
            <p className="type-body measure-body mt-5 text-tone-body">
              {permitPayload.uncertainty}
            </p>
          )}

          {verdict.state === "not_issuing" && (
            <p className="type-body measure-body mt-5 text-tone-body">
              While this holds, nobody can travel above Chiyalekh, including us.
              Departures are not sold against a suspended permit. Talk to us about
              dates once it reopens rather than booking around it.
            </p>
          )}

          <Freshness source={permit} locale={locale} />
          {permit.source_url && (
            <QuietAction href={permit.source_url} className="mt-6">
              Read the portal yourself
            </QuietAction>
          )}
        </Surface>
      )}

      <div className="mt-[var(--band-y-tight)]">
        {road && roadPayload && (
          <Block title="State road closure register">
            {/* The caveat comes first. It is the more important half of what this
                source has to say, and a reader who takes "no closures" as "open"
                would be reading the most exposed stretch as clear. */}
            <p className="type-body measure-body text-tone-body">
              {roadPayload.caveat}
            </p>

            {corridorClosures.length > 0 ? (
              <ul className="mt-6">
                {corridorClosures.slice(0, 6).map((closure) => (
                  <Row key={`${closure.road}-${closure.from}`} name={closure.road}>
                    <span className="type-meta font-medium text-status-suspended">
                      {closure.status}
                    </span>
                    {closure.duration && (
                      <span className="type-meta type-reading text-tone-muted">
                        {closure.duration}
                      </span>
                    )}
                  </Row>
                ))}
              </ul>
            ) : (
              <p className="type-body measure-body mt-4 text-tone-muted">
                No closures listed on our stretch right now, which is not the same as
                the road being clear.
              </p>
            )}
            <Freshness source={road} locale={locale} />
          </Block>
        )}

        {alerts && alertsPayload && alertsPayload.alerts.length > 0 && (
          <Block title="Weather warnings for this district">
            <ul className="flex flex-col gap-3">
              {alertsPayload.alerts.slice(0, 4).map((alert) => (
                <li key={alert.title} className="type-body measure-body text-tone-body">
                  {alert.title}
                </li>
              ))}
            </ul>
            <p className="type-meta measure-meta mt-4 text-tone-muted">
              This feed carries {alertsPayload.covers}.
            </p>
            <Freshness source={alerts} locale={locale} />
          </Block>
        )}

        {beds && bedsPayload && bedsPayload.properties.length > 0 && (
          <Block title="Government rest house beds">
            <p className="type-body measure-body text-tone-body">
              Kumaon Mandal Vikas Nigam runs the only accommodation above Dharchula.
              These are its own numbers for a night about a month out, which is a
              question about capacity rather than about this weekend.
            </p>
            <ul className="mt-6">
              {bedsPayload.properties.map((property) => (
                <Row key={property.name} name={property.name}>
                  <span className="type-meta type-reading text-tone-body">
                    {property.available_beds} of {property.total_beds} beds
                  </span>
                  {property.is_full && (
                    <span className="type-meta font-medium text-status-suspended">
                      Full
                    </span>
                  )}
                  {property.is_scarce && (
                    <span className="type-meta font-medium text-status-limited">
                      Nearly full
                    </span>
                  )}
                </Row>
              ))}
            </ul>
            <Freshness source={beds} locale={locale} />
          </Block>
        )}
      </div>

      <p className="type-meta measure-meta mt-[var(--band-y-tight)] text-tone-muted">
        {data.coverage_note}
      </p>
    </div>
  );
}
