import { setRequestLocale } from "next-intl/server";

import { StatusBadge } from "@/components/status-badge";
import { StatusAlerts } from "@/components/status-alerts";
import { StatusLd } from "@/components/structured-data";
import { api, type Locale } from "@/lib/api";
import { buildMetadata } from "@/lib/brand";

/**
 * Live route and permit status.
 *
 * Doc 03 wants this to become "a signature trust and organic-discovery asset", and
 * spells out the AEO requirement: "The status summary must exist in readable page
 * text, not only a widget." Everything here is server-rendered HTML with real
 * timestamps and named verifiers, so it can be read, cited and quoted.
 */

/**
 * `generateMetadata` rather than a static export, purely so the canonical can
 * carry the locale. A canonical that guessed the locale would point half the
 * site at the wrong URL.
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

export default async function StatusPage({ params }: PageProps<"/[locale]"> ) {
  const { locale } = await params;
  setRequestLocale(locale);
  const data = await api.status(locale as Locale);

  return (
    <>
      {data && <StatusLd status={data} locale={locale} />}
    <main id="main" className="flex-1 register-dark px-4 py-16 text-ink-inverse sm:px-6 sm:py-20">
      <div className="mx-auto max-w-4xl">
        <h1 className="font-serif text-4xl leading-tight sm:text-5xl">
          Route and permit status
        </h1>
        <p className="mt-5 max-w-[62ch] text-[15px] leading-relaxed text-ink-inverse/70">
          What our coordinators have actually confirmed, and when. Anything past its
          re-check time is marked as not recently verified, which means unknown rather
          than open. Conditions in the high Himalaya change faster than any page can.
        </p>

        {data === null && (
          <p className="mt-12 rounded-lg bg-himalayan px-5 py-4 text-[15px] ring-1 ring-white/10">
            Status is unavailable right now. We cannot confirm conditions from here.
            Please speak to the team before travelling.
          </p>
        )}

        {data && !data.has_data && (
          <p className="mt-12 rounded-lg bg-himalayan px-5 py-4 text-[15px] ring-1 ring-white/10">
            Nothing has been published yet. Verified updates begin when the season opens
            and our coordinators start checking the road.
          </p>
        )}

        {data?.any_blocking && (
          <p className="mt-10 rounded-lg bg-saffron/15 px-5 py-4 text-[15px] ring-1 ring-saffron/30">
            <span className="font-medium">
              At least one segment is closed, suspended, or not recently verified.
            </span>{" "}
            Departures affected by it cannot be paid for until conditions are confirmed.
          </p>
        )}

        {data && data.routes.length > 0 && (
          <section className="mt-14">
            <h2 className="font-serif text-2xl">Road and permits</h2>
            <div className="mt-6">
              {data.routes.map((route) => (
                <article
                  key={route.id}
                  className="border-t border-white/12 py-6"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="text-lg">{route.segment_name}</h3>
                      {route.requires_permit && (
                        <p className="mt-1 text-sm text-ink-inverse/55">
                          Inner-line permit required
                        </p>
                      )}
                    </div>
                    <StatusBadge status={route} />
                  </div>

                  {route.summary && (
                    <p className="mt-3 max-w-[62ch] text-[15px] leading-relaxed text-ink-inverse/75">
                      {route.summary}
                    </p>
                  )}

                  <dl className="mt-4 flex flex-wrap gap-x-8 gap-y-2 text-sm text-ink-inverse/55">
                    <div className="flex gap-2">
                      <dt>Verified</dt>
                      <dd className="text-ink-inverse/80">
                        <time dateTime={route.verified_at}>
                          {fmt(route.verified_at, locale)} IST
                        </time>
                      </dd>
                    </div>
                    <div className="flex gap-2">
                      <dt>Source</dt>
                      <dd className="text-ink-inverse/80">
                        {SOURCE_LABEL[route.source] ?? route.source}
                      </dd>
                    </div>
                    <div className="flex gap-2">
                      <dt>Next check due</dt>
                      <dd className="text-ink-inverse/80">
                        <time dateTime={route.next_verification_due}>
                          {fmt(route.next_verification_due, locale)} IST
                        </time>
                      </dd>
                    </div>
                  </dl>
                </article>
              ))}
            </div>
          </section>
        )}

        {data && data.weather.length > 0 && (
          <section className="mt-16">
            <h2 className="font-serif text-2xl">Weather</h2>
            <p className="mt-3 max-w-[62ch] text-sm leading-relaxed text-ink-inverse/60">
              A reading is not a forecast. Where it says our coordinator saw these
              conditions, a person was standing there. Where it says weather service,
              it came from a data feed and nobody has confirmed it on the ground.
            </p>
            <div className="mt-6">
              {data.weather.map((w) => (
                <article key={w.id} className="border-t border-white/12 py-6">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="text-lg">{w.place}</h3>
                      <p className="mt-1 text-sm text-ink-inverse/70">
                        {CONDITION_LABEL[w.condition] ?? w.condition}
                        {w.temp_min_c !== null && w.temp_max_c !== null
                          ? `, ${w.temp_min_c}° to ${w.temp_max_c}°C`
                          : ""}
                      </p>
                    </div>
                    {w.is_stale ? (
                      <span className="rounded-full px-3 py-1 text-sm text-status-unverified ring-1 ring-status-unverified/30">
                        Not recently checked
                      </span>
                    ) : w.is_severe ? (
                      <span className="rounded-full px-3 py-1 text-sm text-status-suspended ring-1 ring-status-suspended/30">
                        Severe conditions
                      </span>
                    ) : null}
                  </div>

                  {w.advisory && (
                    <p className="mt-3 max-w-[62ch] text-[15px] leading-relaxed text-ink-inverse/75">
                      {w.advisory}
                    </p>
                  )}

                  <dl className="mt-4 flex flex-wrap gap-x-8 gap-y-2 text-sm text-ink-inverse/55">
                    <div className="flex gap-2">
                      <dt>Observed</dt>
                      <dd className="text-ink-inverse/80">
                        <time dateTime={w.observed_at}>
                          {fmt(w.observed_at, locale)} IST
                        </time>
                      </dd>
                    </div>
                    <div className="flex gap-2">
                      <dt>Source</dt>
                      <dd className="text-ink-inverse/80">
                        {w.is_field_verified
                          ? "Seen by our coordinator"
                          : (SOURCE_LABEL[w.source] ?? w.source)}
                      </dd>
                    </div>
                  </dl>
                </article>
              ))}
            </div>
          </section>
        )}

        <div className="mt-16">
          <StatusAlerts />
        </div>

        <p className="mt-10 border-t border-white/12 pt-6 text-sm leading-relaxed text-ink-inverse/55">
          We publish what we can verify and mark what we cannot. Nothing on this page is
          a guarantee of access, weather or darshan. If a segment matters to your
          travel, ask us before you set out.
        </p>
      </div>
    </main>
    </>
  );
}
