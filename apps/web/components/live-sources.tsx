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
    <p className="type-reading mt-2 text-xs text-tone-muted">
      Read {age(source.fetched_at, locale)}
      {source.is_stale && ", and we have not been able to refresh it since"}
      {source.last_error && ". The last attempt failed"}
    </p>
  );
}

function Block({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-t border-tone-line py-7">
      <h3 className="text-[15px] font-medium text-tone-strong">{title}</h3>
      <div className="mt-3">{children}</div>
    </section>
  );
}

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
  const road = data.road_register;
  const roadPayload = road?.payload as unknown as RoadPayload | undefined;
  const alerts = data.hazard_alerts;
  const alertsPayload = alerts?.payload as unknown as AlertsPayload | undefined;
  const beds = data.bed_availability;
  const bedsPayload = beds?.payload as unknown as BedsPayload | undefined;

  const notIssuing = permitPayload?.is_issuing === false;

  return (
    <div>
      <h2 className="type-section text-tone-strong">What others are publishing</h2>
      <p className="mt-4 max-w-[68ch] leading-relaxed text-tone-body">
        Read from government portals rather than checked by us. Kept apart from the
        route status above for that reason.
      </p>

      {/* The permit state, given the weight it actually carries. Not a row in a
          list: it is the fact that decides whether anything else matters. */}
      {permit && permitPayload && (
        <section
          className={`mt-8 rounded-2xl p-5 ring-1 sm:p-6 ${
            notIssuing
              ? "bg-status-suspended/12 ring-status-suspended/35"
              : "bg-ink/[0.04] ring-tone-line"
          }`}
        >
          <h3 className="text-[15px] font-medium text-tone-strong">
            Inner Line Permits
          </h3>
          <p className="mt-2 text-lg text-tone-strong">
            {permitPayload.is_issuing === null
              ? "We could not tell"
              : permitPayload.is_issuing
                ? "Being issued"
                : "Not being issued"}
          </p>

          {permitPayload.notice && (
            <blockquote className="mt-4 border-l-2 border-status-suspended/50 pl-4 text-[15px] leading-relaxed text-tone-body">
              {permitPayload.notice}
            </blockquote>
          )}

          {permitPayload.uncertainty && (
            <p className="mt-3 text-[15px] leading-relaxed text-tone-body">
              {permitPayload.uncertainty}
            </p>
          )}

          {notIssuing && (
            <p className="mt-4 text-[15px] leading-relaxed text-tone-body">
              While this holds, nobody can travel above Chiyalekh, including us.
              Departures are not sold against a suspended permit. Talk to us about
              dates once it reopens rather than booking around it.
            </p>
          )}

          <Freshness source={permit} locale={locale} />
          {permit.source_url && (
            <a
              href={permit.source_url}
              rel="nofollow noopener"
              className="mt-1 inline-block text-sm font-medium text-tone-strong underline decoration-gold decoration-2 underline-offset-4"
            >
              Read the portal yourself
            </a>
          )}
        </section>
      )}

      <div className="mt-4">
        {road && roadPayload && (
          <Block title="State road closure register">
            {/* The caveat comes first. It is the more important half of what this
                source has to say, and a reader who takes "no closures" as "open"
                would be reading the most exposed stretch as clear. */}
            <p className="max-w-[68ch] text-[15px] leading-relaxed text-tone-body">
              {roadPayload.caveat}
            </p>

            {roadPayload.closures.filter((c) => c.is_closed && c.on_corridor).length >
            0 ? (
              <ul className="mt-4">
                {roadPayload.closures
                  .filter((c) => c.is_closed && c.on_corridor)
                  .slice(0, 6)
                  .map((closure) => (
                    <li
                      key={`${closure.road}-${closure.from}`}
                      className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-t border-tone-line py-2.5 first:border-t-0"
                    >
                      <span className="min-w-0 flex-1 text-[15px] text-tone-strong">
                        {closure.road}
                      </span>
                      <span className="text-sm text-status-suspended">
                        {closure.status}
                      </span>
                      {closure.duration && (
                        <span className="type-reading text-sm text-tone-muted">
                          {closure.duration}
                        </span>
                      )}
                    </li>
                  ))}
              </ul>
            ) : (
              <p className="mt-3 text-[15px] text-tone-muted">
                No closures listed on our stretch right now, which is not the same as
                the road being clear.
              </p>
            )}
            <Freshness source={road} locale={locale} />
          </Block>
        )}

        {alerts && alertsPayload && alertsPayload.alerts.length > 0 && (
          <Block title="Weather warnings for this district">
            <ul className="space-y-2.5">
              {alertsPayload.alerts.slice(0, 4).map((alert) => (
                <li
                  key={alert.title}
                  className="max-w-[68ch] text-[15px] leading-relaxed text-tone-body"
                >
                  {alert.title}
                </li>
              ))}
            </ul>
            <p className="mt-3 text-sm text-tone-muted">
              This feed carries {alertsPayload.covers}.
            </p>
            <Freshness source={alerts} locale={locale} />
          </Block>
        )}

        {beds && bedsPayload && bedsPayload.properties.length > 0 && (
          <Block title="Government rest house beds">
            <p className="max-w-[68ch] text-[15px] leading-relaxed text-tone-body">
              Kumaon Mandal Vikas Nigam runs the only accommodation above Dharchula.
              These are its own numbers for a night about a month out, which is a
              question about capacity rather than about this weekend.
            </p>
            <ul className="mt-4">
              {bedsPayload.properties.map((property) => (
                <li
                  key={property.name}
                  className="flex flex-wrap items-baseline gap-x-4 gap-y-1 border-t border-tone-line py-2.5 first:border-t-0"
                >
                  <span className="min-w-0 flex-1 text-[15px] text-tone-strong">
                    {property.name}
                  </span>
                  <span className="type-reading text-sm text-tone-body">
                    {property.available_beds} of {property.total_beds} beds
                  </span>
                  {property.is_full && (
                    <span className="text-sm text-status-suspended">Full</span>
                  )}
                  {property.is_scarce && (
                    <span className="text-sm text-status-limited">Nearly full</span>
                  )}
                </li>
              ))}
            </ul>
            <Freshness source={beds} locale={locale} />
          </Block>
        )}
      </div>

      <p className="mt-6 max-w-[68ch] border-t border-tone-line pt-6 text-sm leading-relaxed text-tone-muted">
        {data.coverage_note}
      </p>
    </div>
  );
}
