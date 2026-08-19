import { setRequestLocale } from "next-intl/server";

import { LiveSources, permitVerdict } from "@/components/live-sources";
import { RouteProfile } from "@/components/route-profile";
import { SceneArt } from "@/components/scene-art";
import { StatusAlerts } from "@/components/status-alerts";
import { StatusBadge, StatusChip } from "@/components/status-badge";
import { StatusLd } from "@/components/structured-data";
import { Band, Content } from "@/components/ui/band";
import { QuietAction } from "@/components/ui/action";
import { ContentsRail } from "@/components/ui/contents-rail";
import { Surface } from "@/components/ui/surface";
import { api, type Locale } from "@/lib/api";
import { buildMetadata } from "@/lib/brand";
import { legStatus, STATIONS } from "@/lib/route-profile";

/**
 * Live route and permit status.
 *
 * Doc 03 wants this to become "a signature trust and organic-discovery asset", and
 * spells out the AEO requirement: "The status summary must exist in readable page
 * text, not only a widget." Everything here is server-rendered HTML with real
 * timestamps and named sources, so it can be read, cited and quoted.
 *
 * **The design problem this page had is that its true answer is "nothing yet".** Zero
 * segments have been verified, so the old page went from a heading to an apologetic
 * grey paragraph and then to somebody else's data. That reads as a broken site rather
 * than as a careful one. The rebuild puts the honest unknown where a reassuring
 * summary would normally go, and gives it the full material treatment: a counted
 * figure, an explanation of what a check actually is, and the elevation instrument
 * underneath it showing all six legs marked as never checked.
 *
 * **The profile is the centrepiece.** It is also the only thing on this page that is
 * true regardless of whether the API is reachable: the altitudes are researched
 * constants, not live data, so a reader still learns the shape of the road when the
 * status service is down. It draws at 390 px as well as at 1440.
 */

export async function generateMetadata({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;
  return buildMetadata({
    title: "Route and permit status",
    description:
      "Current road, permit and weather conditions on the route to Adi Kailash and Om Parvat, with the time each was last verified.",
    path: "/status",
    locale,
  });
}

const SOURCE_LABEL: Record<string, string> = {
  official_notice: "Official notice",
  district_or_tourism: "District or tourism confirmation",
  operating_partner: "Operating partner",
  field_coordinator: "Our field coordinator",
  supplier_observation: "Supplier observation",
  weather_api: "Weather service",
};

const CONDITION_LABEL: Record<string, string> = {
  clear: "Clear",
  partly_cloudy: "Partly cloudy",
  overcast: "Overcast",
  rain: "Rain",
  heavy_rain: "Heavy rain",
  snow: "Snow",
  heavy_snow: "Heavy snow",
  fog: "Fog",
  storm: "Storm",
  unknown: "Unknown",
};

function fmt(iso: string, locale: string) {
  return new Intl.DateTimeFormat(locale === "hi" ? "hi-IN" : "en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  }).format(new Date(iso));
}

/**
 * Weather readings come back in whatever order the query produced them. Sorting
 * them by position on the road makes the section read as the same journey the
 * profile above it draws, rather than as an unordered set of place names.
 */
const ROAD_ORDER = STATIONS.map((s) => s.name.toLowerCase());
function roadRank(place: string) {
  const i = ROAD_ORDER.indexOf(place.trim().toLowerCase());
  return i === -1 ? ROAD_ORDER.length : i;
}

/** One label-and-value pair in the masthead ledger. */
function Fact({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="type-meta text-tone-muted">{label}</dt>
      <dd className="type-body mt-1 font-medium text-tone-strong">{value}</dd>
    </div>
  );
}

export default async function StatusPage({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;
  setRequestLocale(locale);
  // Fetched together: the two are read side by side on the page, and a sequential
  // pair would add the slower one's latency to the faster one for no reason.
  const [data, live] = await Promise.all([
    api.status(locale as Locale),
    api.live(locale as Locale),
  ]);

  const routes = data?.routes ?? [];
  // Counted per leg of the road rather than per published segment, because the two
  // are different granularities: four segments is what a coordinator can realistically
  // drive, six legs is what the road does, and one covering segment would otherwise
  // read as "1 / 6" when it has in fact answered for three of them. A stale reading
  // resolves to `unknown` inside legStatus, so it is correctly not counted.
  const roadLegs = STATIONS.filter((s) => s.from);
  const legCount = roadLegs.length;
  const verified = roadLegs.filter((station) => {
    const leg = legStatus(routes, station);
    return leg !== null && leg.state !== "unknown";
  }).length;
  const lastCheck = routes.reduce<string | null>(
    (newest, r) => (newest === null || r.verified_at > newest ? r.verified_at : newest),
    null,
  );
  const verdict = permitVerdict(live);

  const weather = [...(data?.weather ?? [])].sort(
    (a, b) => roadRank(a.place) - roadRank(b.place),
  );

  const rail = [
    { id: "elevation", label: "The road, as elevation" },
    { id: "confirmed", label: "What we have confirmed" },
    ...(weather.length > 0 ? [{ id: "weather", label: "Weather along the road" }] : []),
    { id: "outside", label: "What others are publishing" },
    { id: "alerts", label: "Tell me when this changes" },
  ];

  return (
    <>
      {data && <StatusLd status={data} locale={locale} />}
      <main id="main" data-lead-band className="flex-1 register-dark">
        {/* ---------------------------------------------------------------
            Masthead. The title, then the three measured facts that describe
            the state of this page itself. Three of the four things a visitor
            wants to know here are currently "nothing yet", and saying so in
            large type is the whole proposition.
            --------------------------------------------------------------- */}
        <Band register="dark" tight lead glow grain>
          <Content>
            <h1 className="type-display glow-display text-tone-strong">
              Route and permit status
            </h1>
            <p className="type-lead mt-[var(--stack-title)] text-tone-body">
              What our coordinators have actually confirmed, and when. Anything past
              its re-check time is marked as not recently verified, which means
              unknown rather than open.
            </p>

            <div className="mt-[var(--stack-block)] flex flex-wrap items-end gap-x-14 gap-y-9">
              <div>
                <p className="type-figure text-tone-strong">
                  {verified}
                  <span className="text-tone-muted"> / {legCount}</span>
                </p>
                <p className="type-meta measure-meta mt-3 text-tone-muted">
                  legs of the road confirmed by one of our coordinators
                </p>
              </div>
              <dl className="flex flex-wrap gap-x-12 gap-y-7">
                <Fact
                  label="Last coordinator check"
                  value={lastCheck ? fmt(lastCheck, locale) : "Never"}
                />
                <Fact
                  label="State permit portal"
                  value={verdict ? verdict.chip : "Not read"}
                />
                <Fact
                  label="Newest reading on this page"
                  value={
                    data?.as_of ? (
                      <time dateTime={data.as_of}>{fmt(data.as_of, locale)} IST</time>
                    ) : (
                      "None"
                    )
                  }
                />
              </dl>
            </div>

            {/* The one fact on this page that can override everything else. It is
                somebody else's reading, so it is attributed in the sentence itself
                rather than presented in our own verification language. */}
            {verdict?.state === "not_issuing" && (
              <Surface
                radius="action"
                className="mt-[var(--stack-block)] flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:justify-between sm:gap-8 sm:p-6 sm:ps-7"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-baseline sm:gap-6">
                  <StatusChip
                    tone={verdict.tone}
                    shape={verdict.shape}
                    className="self-start sm:translate-y-1"
                  >
                    {verdict.chip}
                  </StatusChip>
                  <p className="type-body measure-body text-tone-strong">
                    The state portal says Inner Line Permits are suspended. While that
                    holds, nobody travels above Chiyalekh, including us.
                  </p>
                </div>
                <QuietAction href="#outside" className="shrink-0 self-start sm:self-auto">
                  Read the notice
                </QuietAction>
              </Surface>
            )}

            {data === null && (
              <Surface radius="action" className="mt-[var(--stack-block)] p-5 sm:p-6 sm:ps-7">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-baseline sm:gap-6">
                  <StatusChip className="self-start sm:translate-y-1" tone="unverified" shape="clock">
                    Status service unreachable
                  </StatusChip>
                  <p className="type-body measure-body text-tone-strong">
                    We cannot confirm conditions from here right now. Please speak to
                    the team before travelling.
                  </p>
                </div>
              </Surface>
            )}

            {data?.any_blocking && (
              <Surface radius="action" className="mt-[var(--stack-block)] p-5 sm:p-6 sm:ps-7">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-baseline sm:gap-6">
                  <StatusChip className="self-start sm:translate-y-1" tone="suspended" shape="cross">
                    At least one segment blocked
                  </StatusChip>
                  <p className="type-body measure-body text-tone-strong">
                    One or more segments are closed, suspended, or not recently
                    verified. Departures affected by it cannot be paid for until
                    conditions are confirmed.
                  </p>
                </div>
              </Surface>
            )}
          </Content>
        </Band>

        {/* ---------------------------------------------------------------
            The instrument. Researched constants rather than live data, so it
            still tells a reader the shape of the road when the status service
            is down, and it is the only thing on this page that does.
            --------------------------------------------------------------- */}
        <Band register="dark" id="elevation" glow grain>
          <Content>
            <h2 className="type-title-1 text-tone-strong">The road, as elevation</h2>
            <p className="type-lead mt-[var(--stack-title)] text-tone-body">
              From 910 m in the Kali gorge to about 4,570 m below Adi Kailash, with
              almost the whole gain in the last quarter of the drive. Each leg carries
              what we have confirmed about it, which at the moment is nothing.
            </p>
            <div className="mt-[var(--stack-block)]">
              <RouteProfile routes={routes} locale={locale} />
            </div>
          </Content>
        </Band>

        {/* ---------------------------------------------------------------
            Everything else, with the contents rail filling the column that
            was 640px of dead space on the old page.
            --------------------------------------------------------------- */}
        {/* `glow` but not `grain`: this band runs to about 4,000px and
            `feTurbulence` is CPU-rasterised at the element's size, so grain on
            something this tall is a real cost on the cheap Android panels most of
            this audience holds. The bloom is two static radial gradients and costs
            nothing at any height. */}
        <Band register="dark" glow>
          <Content>
            <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_14rem] lg:gap-x-16 xl:gap-x-24">
              <div className="min-w-0">
                {/* ----------------------------------------------- confirmed */}
                <section>
                  <h2 id="confirmed" className="type-title-1 text-tone-strong">
                    What we have confirmed
                  </h2>

                  {routes.length === 0 ? (
                    /* An empty route list is a fact, not a reason to omit the
                       section. Nine fabricated verifications were removed from the
                       database on 17 Aug 2026; until a coordinator publishes a real
                       one, this is the true answer and the page gives it whole. */
                    <Surface
                      radius="frame"
                      className="relative mt-[var(--stack-block)] overflow-hidden"
                    >
                      <div
                        aria-hidden
                        /* CSS mask on the box, not SceneArt's own `feather`: the
                           SVG mask is authored in the 0-100 viewBox and this box is
                           wide and short, so `slice` crops to roughly y 34-66 and the
                           ramp never reaches transparent. It ends on a visible line
                           at about 0.6 alpha. The box mask ramps over 70% of 256px,
                           which is 179px and clears the 120px floor. */
                        className="pointer-events-none absolute inset-x-0 top-0 h-48 mask-b-from-30% opacity-45 sm:h-64"
                      >
                        <SceneArt seed="status-nothing-verified" />
                      </div>
                      <div className="relative px-6 pb-8 pt-36 sm:px-10 sm:pb-10 sm:pt-48">
                        <p className="type-figure text-tone-strong">0</p>
                        <p className="type-meta mt-3 text-tone-muted">
                          segment checks published by our coordinators
                        </p>
                        <h3 className="type-title-2 mt-8 text-tone-strong">
                          Nothing has been verified yet
                        </h3>
                        <p className="type-body measure-body mt-4 text-tone-body">
                          A check is a person, not a feed. It means one of our
                          coordinators has driven a segment, or spoken to somebody who
                          drove it that day, and has put a name and a time against what
                          they found. Nobody has published one for this season.
                        </p>
                        <p className="type-body measure-body mt-4 text-tone-body">
                          We would rather show you an empty page than a reassuring one.
                          What other people publish about this road is further down,
                          along with how old each of those readings is.
                        </p>
                        <QuietAction href="/enquire" className="mt-8">
                          Ask us about a segment
                        </QuietAction>
                      </div>
                    </Surface>
                  ) : (
                    <ul className="mt-[var(--stack-block)]">
                      {routes.map((route) => (
                        <li
                          key={route.id}
                          className="grid gap-x-10 gap-y-4 border-t border-tone-line py-7 first:border-t-0 first:pt-0 md:grid-cols-[minmax(0,1fr)_auto]"
                        >
                          <div className="min-w-0">
                            <h3 className="type-title-2 text-tone-strong">
                              {route.segment_name}
                            </h3>
                            {route.requires_permit && (
                              <p className="type-meta mt-2 text-tone-muted">
                                Inner-line permit required
                              </p>
                            )}
                            {route.summary && (
                              <p className="type-body measure-body mt-4 text-tone-body">
                                {route.summary}
                              </p>
                            )}
                            <dl className="mt-5 flex flex-wrap gap-x-10 gap-y-4">
                              <Fact
                                label="Verified"
                                value={
                                  <time dateTime={route.verified_at}>
                                    {fmt(route.verified_at, locale)} IST
                                  </time>
                                }
                              />
                              <Fact
                                label="Source"
                                value={SOURCE_LABEL[route.source] ?? route.source}
                              />
                              <Fact
                                label="Next check due"
                                value={
                                  <time dateTime={route.next_verification_due}>
                                    {fmt(route.next_verification_due, locale)} IST
                                  </time>
                                }
                              />
                            </dl>
                          </div>
                          <div className="md:pt-1">
                            <StatusBadge status={route} />
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                {/* ------------------------------------------------- weather */}
                {weather.length > 0 && (
                  <section className="mt-[var(--band-y)]">
                    <h2 id="weather" className="type-title-1 text-tone-strong">
                      Weather along the road
                    </h2>
                    <p className="type-lead mt-[var(--stack-title)] text-tone-body">
                      A reading is not a forecast. Everything below came from a data
                      feed unless a row says a coordinator saw it, and a data feed has
                      never stood in the Kali gorge.
                    </p>
                    <ul className="mt-[var(--stack-block)]">
                      {weather.map((w) => (
                        <li
                          key={w.id}
                          className="grid gap-x-12 gap-y-4 border-t border-tone-line py-7 first:border-t-0 first:pt-0 md:grid-cols-[17rem_minmax(0,1fr)]"
                        >
                          <div>
                            <h3 className="type-title-2 text-tone-strong">{w.place}</h3>
                            <p className="type-meta type-reading mt-2 text-tone-body">
                              {CONDITION_LABEL[w.condition] ?? w.condition}
                              {w.temp_min_c !== null && w.temp_max_c !== null
                                ? `, ${w.temp_min_c}° to ${w.temp_max_c}°C`
                                : ""}
                            </p>
                            {(w.is_stale || w.is_severe || w.is_field_verified) && (
                              <div className="mt-3 flex flex-wrap gap-2">
                                {w.is_stale && (
                                  <StatusChip tone="unverified" shape="clock">
                                    Not recently checked
                                  </StatusChip>
                                )}
                                {w.is_severe && !w.is_stale && (
                                  <StatusChip tone="suspended" shape="warn">
                                    Severe conditions
                                  </StatusChip>
                                )}
                                {w.is_field_verified && (
                                  <StatusChip tone="open" shape="tick">
                                    Seen by our coordinator
                                  </StatusChip>
                                )}
                              </div>
                            )}
                          </div>
                          <div className="min-w-0">
                            {w.advisory && (
                              <p className="type-body measure-body text-tone-body">
                                {w.advisory}
                              </p>
                            )}
                            <p className="type-meta type-reading mt-4 text-tone-muted">
                              <time dateTime={w.observed_at}>
                                {fmt(w.observed_at, locale)} IST
                              </time>
                              {", "}
                              {w.is_field_verified
                                ? "seen by our coordinator"
                                : (SOURCE_LABEL[w.source] ?? w.source).toLowerCase()}
                            </p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}

                {/* -------------------------------------------------- others */}
                <div className="mt-[var(--band-y)]">
                  <LiveSources data={live} locale={locale as Locale} />
                </div>

                {/* -------------------------------------------------- alerts */}
                <section id="alerts" className="mt-[var(--band-y)]">
                  <StatusAlerts />
                </section>

                <p className="type-meta measure-meta mt-[var(--band-y-tight)] text-tone-muted">
                  We publish what we can verify and mark what we cannot. Nothing on this
                  page is a guarantee of access, weather or darshan. If a segment
                  matters to your travel, ask us before you set out.
                </p>
              </div>

              <ContentsRail items={rail} label="On this page" />
            </div>
          </Content>
        </Band>
      </main>
    </>
  );
}
