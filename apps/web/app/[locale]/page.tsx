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
    <div>
      <dt className="text-sm text-tone-muted">{label}</dt>
      <dd className="type-reading mt-1.5 text-[1.35rem] leading-none text-tone-strong">
        {value}
      </dd>
      {note && <dd className="mt-1.5 text-sm text-tone-muted">{note}</dd>}
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
        {/* The panorama's peaks sit right of centre; object-center cropped them out. */}
        {/* The panorama is 2.3:1 and its peaks sit right of centre and low. A phone
            crops it to a tall slice, and centring that slice lands on empty sky, so
            the mobile framing pulls right *and* down. The desktop framing takes over
            at `sm`, where the frame is wide enough for the horizon to be the middle. */}
        <SceneBackdrop
          name="hero"
          position="object-[68%_46%] sm:object-[68%_center]"
        />
        <TerrainField />
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 pb-20 pt-[17rem] sm:px-6 sm:pt-16 lg:min-h-[calc(100dvh-11rem)] lg:grid-cols-[1.2fr_minmax(0,23rem)] lg:gap-16 lg:pb-24 lg:pt-24">
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
                  className="rounded-full px-6 py-3 text-sm font-medium text-tone-strong ring-1 ring-tone-line transition-colors hover:ring-tone-line"
                >
                  {displayLocalized(campaign.secondaryCta, locale)}
                </a>
              ) : (
                <Link
                  href="/enquire"
                  className="rounded-full px-6 py-3 text-sm font-medium text-tone-strong ring-1 ring-tone-line transition-colors hover:ring-tone-line"
                >
                  {displayLocalized(campaign.secondaryCta, locale)}
                </Link>
              )}
            </div>
          </div>

          <HeroStatus data={status} live={live} locale={typed} />
        </div>

        {/*
          The four readings, inside the hero rather than in a band below it.

          They were a separate slab between the hero and the journeys, which left the
          hero ending in a stretch of empty navy and then interrupted the page with a
          box before it had said anything. Here they do two jobs at once: they fill
          the foot of the fold, and they give the headline the context it was missing.
          "Others begin with a calling" says nothing about where you would be going;
          4,570 m, four documents and a date do.

          A hairline rather than a container, because the photograph is already the
          surface and a second box on top of it would be one too many.
        */}
        <div className="relative mx-auto max-w-6xl px-4 pb-10 sm:px-6 lg:pb-14">
          <dl className="grid gap-x-8 gap-y-6 border-t border-tone-line pt-7 sm:grid-cols-2 lg:grid-cols-4">
            <Fact
              label="Highest ground"
              value={`about ${HIGHEST.altitudeM.toLocaleString("en-IN")} m`}
              note={HIGHEST.name}
            />
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
          </dl>
        </div>
      </section>

      {/*
        3. Journeys. Light register: this is what we are offering, not what we have
        verified.
      */}
      <section className="register-light px-4 pb-24 pt-20 sm:px-6 sm:pb-28 sm:pt-24">
        <div className="mx-auto max-w-6xl">
          <h2 className="type-section max-w-[20ch]">Three ways into the sacred Kumaon</h2>

          {journeys && journeys.length > 0 ? (
            <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
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
      <section className="register-light overflow-hidden border-t border-tone-line px-4 py-20 sm:px-6 sm:py-28">
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
          {/* Runs off the right edge rather than sitting in a rounded box beside the
              text. A photograph bordered on all four sides reads as an illustration
              dropped into an article; one that leaves the frame reads as the room the
              paragraph is describing.

              The bleed is done with a width that overshoots the column, not with a
              `calc(50% - 50vw)` margin. That margin widened the document past the
              viewport and put a gutter down the whole page, because nothing above it
              clipped the overflow. This cannot: the section owns the clipping. */}
          <div className="relative h-[24rem] w-full overflow-hidden rounded-l-2xl lg:h-[32rem] lg:w-[calc(100%+6rem)] lg:rounded-l-3xl">
            <Scene name="homestay-kitchen" fill sizes="(min-width: 1024px) 55vw, 100vw" />
          </div>
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
            <h2 className="type-section text-tone-strong">
              From 910 metres to four and a half thousand
            </h2>
            <p className="mt-5 leading-relaxed text-tone-body">
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

      {/*
        6. Close.

        On a photograph rather than on bare navy. This was a centred paragraph in the
        middle of an empty dark band, which is where a page goes to end rather than
        where it asks for something. The picture is the checkpost barrier below
        Chiyalekh: the actual gate this whole page has been describing, and the last
        thing a traveller sees before the part we cannot promise anything about.
      */}
      <section className="register-dark relative isolate overflow-hidden">
        <SceneBackdrop name="permits" position="object-[50%_40%]" scrim="centre" />
        <div className="mx-auto max-w-2xl px-4 py-28 text-center sm:px-6 sm:py-36">
          <p className="font-serif text-[1.75rem] leading-snug text-tone-strong sm:text-[2.25rem]">
            {displayLocalized(brand.identity.promise, locale)}
          </p>
          <p className="mt-6 text-lg text-tone-body">
            Talk to someone who lives in Pithoragarh and has driven this road.
          </p>
          <Link
            href="/enquire"
            className="mt-9 inline-block rounded-full bg-gold px-7 py-3.5 text-sm font-medium text-midnight transition-transform hover:brightness-105 active:translate-y-px"
          >
            {displayLocalized(campaign.secondaryCta, locale)}
          </Link>
        </div>
      </section>
    </main>
  );
}
