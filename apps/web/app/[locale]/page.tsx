import { setRequestLocale } from "next-intl/server";

import { HeroStatus } from "@/components/hero-status";
import { JourneyCard } from "@/components/journey-card";
import { RouteProfile } from "@/components/route-profile";
import { Scene, SceneBackdrop } from "@/components/scene";
import { TerrainField } from "@/components/terrain-field";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { api, type Locale } from "@/lib/api";
import { brand, displayLocalized, whatsappLink } from "@/lib/brand";
import { HIGHEST, legStatus, STATIONS } from "@/lib/route-profile";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

/**
 * One fact in the hinge band. No icon, no box.
 *
 * The mockups all put four icon-and-heading trust pillars here ("Safe & Trusted",
 * "Family Friendly", "Responsible Travel") and every one of them is a claim any
 * operator can make for free, which is why they persuade nobody. These four are
 * readings instead: they change, they carry a time, and a competitor cannot copy
 * them by editing their homepage.
 */
/**
 * Hours since the newest verification, in words.
 *
 * Lives outside the component because `Date.now()` in a component body is a read of
 * mutable global state, which the React compiler rejects: the same render would
 * produce a different result on a re-run, and that is exactly what memoisation
 * assumes cannot happen.
 */
function since(iso: string | null | undefined, locale: string) {
  if (!iso) return "not yet";
  const hours = Math.max(
    1,
    Math.round((Date.now() - new Date(iso).getTime()) / 3_600_000),
  );
  const rtf = new Intl.RelativeTimeFormat(locale === "hi" ? "hi-IN" : "en-IN", {
    numeric: "auto",
  });
  return hours < 48 ? rtf.format(-hours, "hour") : rtf.format(-Math.round(hours / 24), "day");
}

function Fact({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="border-t border-tone-line pt-4 sm:border-l sm:border-t-0 sm:pl-6 sm:pt-0">
      <p className="text-sm text-tone-muted">{label}</p>
      <p className="type-reading mt-1.5 text-lg text-tone-strong">{value}</p>
      {note && <p className="mt-1 text-sm text-tone-muted">{note}</p>}
    </div>
  );
}

export default async function Home({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const typed = locale as Locale;

  const [journeys, checklist, status, live] = await Promise.all([
    api.journeys(typed),
    api.permitChecklist(typed),
    api.status(typed),
    api.live(typed),
  ]);
  const wa = whatsappLink({ intent: "journey" });
  const campaign = brand.campaign.flagship;

  const legs = STATIONS.filter((s) => s.from);
  const confirmed = status
    ? legs.filter((s) => {
        const leg = legStatus(status.routes, s);
        return leg && leg.state !== "unknown";
      }).length
    : 0;
  const mandatory = checklist?.requirements.filter((r) => r.is_mandatory).length ?? 0;
  const asOf = since(status?.as_of, locale);

  return (
    <main id="main" className="flex-1">
      {/*
        1. Hero. Dark register.

        Asymmetric split rather than the centred stack this used to be: the headline
        holds the left, the live status panel holds the right, and the photograph
        runs behind both. The contour field sits over the photograph and under the
        text, which is the same visual language as the elevation profile further
        down the page.
      */}
      <section className="register-dark relative isolate overflow-hidden">
        <SceneBackdrop name="hero" />
        <TerrainField />
        {/* Scrim. Reads the headline side down hard and leaves the right of the
            frame open, so the photograph is visible where nothing sits on it. */}
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10 bg-gradient-to-r from-midnight via-midnight/85 to-midnight/35"
        />

        <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 pb-20 pt-16 sm:px-6 lg:min-h-[calc(100dvh-4rem)] lg:grid-cols-[1.2fr_minmax(0,23rem)] lg:gap-16 lg:pb-24 lg:pt-24">
          <div>
            <p className="max-w-[24ch] font-serif text-[1.375rem] leading-snug text-tone-muted sm:text-2xl">
              {displayLocalized(campaign.headlineLead, locale)}
            </p>
            <h1 className="type-display mt-3 max-w-[15ch] text-tone-strong">
              {displayLocalized(campaign.headlineTurn, locale)}
            </h1>
            <p className="mt-7 max-w-[44ch] text-lg leading-relaxed text-tone-body">
              {displayLocalized(campaign.support, locale)}
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-3">
              <Link
                href="/journeys"
                className="rounded-full bg-gold px-6 py-3 text-sm font-medium text-midnight transition-transform hover:brightness-105 active:translate-y-px"
              >
                {displayLocalized(campaign.primaryCta, locale)}
              </Link>
              {wa ? (
                <a
                  href={wa}
                  className="rounded-full px-6 py-3 text-sm font-medium text-ink-inverse ring-1 ring-white/25 transition-colors hover:ring-white/50"
                >
                  {displayLocalized(campaign.secondaryCta, locale)}
                </a>
              ) : (
                <Link
                  href="/enquire"
                  className="rounded-full px-6 py-3 text-sm font-medium text-ink-inverse ring-1 ring-white/25 transition-colors hover:ring-white/50"
                >
                  {displayLocalized(campaign.secondaryCta, locale)}
                </Link>
              )}
            </div>
          </div>

          <HeroStatus data={status} live={live} locale={typed} />
        </div>
      </section>

      {/*
        2. The hinge. Navy, overlapping the light section below it.

        This is where the page changes register, and the band is the transition and
        the argument at the same time: four readings, each one a thing we checked
        rather than a thing we say about ourselves.
      */}
      <div className="register-light relative px-4 sm:px-6">
        {/* `register-dark` rather than bare navy: it declares its own register, so
            the tone and status variables resolve for anything placed inside it later
            rather than inheriting the light values from the section it overlaps. */}
        <div className="register-dark mx-auto -mt-px max-w-6xl rounded-2xl px-6 py-7 sm:px-8">
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <p className="text-sm text-tone-muted">Highest ground</p>
              <p className="type-reading mt-1.5 text-lg text-tone-strong">
                about {HIGHEST.altitudeM.toLocaleString("en-IN")} m
              </p>
              <p className="mt-1 text-sm text-tone-muted">{HIGHEST.name}</p>
            </div>
            <Fact
              label="Documents required"
              value={mandatory > 0 ? String(mandatory) : "Being confirmed"}
              note={mandatory > 0 ? "Inner-line permit area" : undefined}
            />
            <Fact
              label="Legs confirmed"
              value={`${confirmed} of ${legs.length}`}
              note="Anything else is unknown to us"
            />
            <Fact label="Last checked" value={asOf} note="By a coordinator, on the ground" />
          </div>
        </div>
      </div>

      {/*
        3. Journeys. Light register: this is what we are offering, not what we have
        verified.
      */}
      <section className="register-light px-4 pb-24 pt-20 sm:px-6 sm:pb-28 sm:pt-24">
        <div className="mx-auto max-w-6xl">
          <h2 className="type-section max-w-[20ch]">Three ways into the sacred Kumaon</h2>

          {journeys && journeys.length > 0 ? (
            <div className="mt-14 grid gap-14 md:grid-cols-2 lg:grid-cols-3">
              {journeys.map((journey) => (
                <JourneyCard key={journey.id} journey={journey} />
              ))}
            </div>
          ) : (
            <p className="mt-8 max-w-[62ch] text-tone-body">
              Journeys are still being prepared. Nothing is published until the
              itinerary, altitudes and accommodation have been confirmed by our
              operations team.
            </p>
          )}
        </div>
      </section>

      {/* 4. Homestay. Light register, split composition. Decision D5. */}
      <section className="register-light border-t border-tone-line px-4 py-20 sm:px-6 sm:py-28">
        <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-2 lg:gap-16">
          <div>
            <h2 className="type-section max-w-[18ch]">
              The room is the point, not the compromise
            </h2>
            <div className="mt-6 max-w-[62ch] space-y-4 leading-relaxed text-tone-body">
              <p>
                Most operators apologise for the accommodation above Dharchula. There
                are no luxury hotels on this road, and anyone who tells you otherwise
                has not been.
              </p>
              <p>
                We built a journey around that instead. Nights with host families, food
                from their kitchen, conversation with people whose grandparents walked
                these passes. The money stays in the household rather than reaching a
                chain.
              </p>
              <p>
                We will tell you exactly what each stay has and does not have: hot
                water, heating, network, whether the bathroom is shared. No surprises
                at 3,500 metres.
              </p>
            </div>
            <Link
              href="/journeys/homestay-immersion"
              // Gold is unreadable as text on the light register: #c89a4e against
              // snow is about 2.3:1, well under the 4.5:1 body minimum. Rather than
              // introducing a second accent, the link keeps full-contrast ink and
              // carries gold as the underline, so the accent is still doing the
              // pointing and the words are still legible.
              className="mt-8 inline-flex items-center gap-2 text-sm font-medium text-tone-strong underline decoration-gold decoration-2 underline-offset-4 transition-colors hover:decoration-saffron"
            >
              See the homestay journey
              <svg viewBox="0 0 16 16" className="size-4" aria-hidden="true" fill="none">
                <path
                  d="M3 8h9m0 0-3.2-3.2M12 8l-3.2 3.2"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </Link>
          </div>
          <Scene name="homestay-kitchen" sizes="(min-width: 1024px) 50vw, 100vw" />
        </div>
      </section>

      {/*
        5. The route, as elevation. Back to the dark register, because everything in
        this section is a verified reading with a time on it.

        This is the section the redesign exists for. Altitude is the risk on this
        road and a four-cell table of badges never said so.
      */}
      <section className="register-dark px-4 py-20 sm:px-6 sm:py-28">
        <div className="mx-auto max-w-6xl">
          <div className="max-w-[52ch]">
            <h2 className="type-section text-ink-inverse">
              From 910 metres to four and a half thousand
            </h2>
            <p className="mt-5 leading-relaxed text-ink-inverse/70">
              The drive drops into the Kali gorge before it climbs, and above Gunji it
              forks: one arm to Jyolingkong below Adi Kailash, the other to Nabhidhang
              for Om Parvat. This is what your body is being asked to do.
            </p>
          </div>

          <div className="mt-12">
            <RouteProfile routes={status?.routes ?? []} locale={locale} />
          </div>

          <Link
            href="/status"
            className="mt-10 inline-flex items-center gap-2 text-sm text-gold underline-offset-4 hover:underline"
          >
            Every segment, with who checked it
            <svg viewBox="0 0 16 16" className="size-4" aria-hidden="true" fill="none">
              <path
                d="M3 8h9m0 0-3.2-3.2M12 8l-3.2 3.2"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </Link>
        </div>
      </section>

      {/* 6. Close. */}
      <section className="register-dark border-t border-white/10 px-4 py-20 sm:px-6 sm:py-24">
        <div className="mx-auto max-w-2xl text-center">
          <p className="font-serif text-2xl leading-snug text-ink-inverse sm:text-3xl">
            {displayLocalized(brand.identity.promise, locale)}
          </p>
          <p className="mt-5 text-ink-inverse/65">
            Talk to someone who lives in Pithoragarh and has driven this road.
          </p>
          <Link
            href="/enquire"
            className="mt-8 inline-block rounded-full bg-gold px-6 py-3 text-sm font-medium text-midnight transition-transform hover:brightness-105 active:translate-y-px"
          >
            {displayLocalized(campaign.secondaryCta, locale)}
          </Link>
        </div>
      </section>
    </main>
  );
}
