import { setRequestLocale } from "next-intl/server";

import { JourneyCard } from "@/components/journey-card";
import { LiveStatusBar } from "@/components/live-status-bar";
import { Scene, SceneBackdrop } from "@/components/scene";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { api, type Locale } from "@/lib/api";
import { brand, displayLocalized, whatsappLink } from "@/lib/brand";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function Home({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const typed = locale as Locale;

  const [journeys, checklist] = await Promise.all([
    api.journeys(typed),
    api.permitChecklist(typed),
  ]);
  const wa = whatsappLink({ intent: "journey" });

  return (
    <main id="main" className="flex-1 bg-midnight text-ink-inverse">
      {/* Hero. Editorial-manifesto shape: the line is the design, and the backdrop is
          heavily scrimmed so it supports the headline rather than competing with it.
          With no backdrop file present this degrades to the original typographic hero. */}
      <section className="relative isolate overflow-hidden px-4 pb-14 pt-16 sm:px-6 sm:pb-20 sm:pt-24 lg:pb-28 lg:pt-32">
        <SceneBackdrop name="hero" />
        <div className="mx-auto max-w-6xl">
          {/* Measure tuned so the line breaks after "plan." rather than mid-clause.
              Descender clearance matters here: "journeys" and "beginning" both drop
              below the baseline at this size, so leading stays above 1.05. */}
          <h1 className="max-w-[26ch] font-serif text-[2.5rem] leading-[1.1] tracking-[-0.02em] sm:text-[3.5rem] lg:text-[4rem]">
            {displayLocalized(brand.campaign.flagship.headline, locale)}
          </h1>
          <p className="mt-6 max-w-[46ch] text-lg leading-relaxed text-ink-inverse/70">
            {displayLocalized(brand.campaign.flagship.support, locale)}
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-3">
            <Link
              href="/journeys"
              className="rounded-full bg-gold px-6 py-3 text-sm font-medium text-midnight transition-transform hover:brightness-105 active:scale-[0.98]"
            >
              {displayLocalized(brand.campaign.flagship.primaryCta, locale)}
            </Link>
            {wa ? (
              <a
                href={wa}
                className="rounded-full px-6 py-3 text-sm font-medium text-ink-inverse ring-1 ring-white/25 transition-colors hover:ring-white/50"
              >
                {displayLocalized(brand.campaign.flagship.secondaryCta, locale)}
              </a>
            ) : (
              <Link
                href="/enquire"
                className="rounded-full px-6 py-3 text-sm font-medium text-ink-inverse ring-1 ring-white/25 transition-colors hover:ring-white/50"
              >
                {displayLocalized(brand.campaign.flagship.secondaryCta, locale)}
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* The trust device, placed where a metrics strip would normally go. */}
      <div className="px-4 sm:px-6">
        <LiveStatusBar locale={typed} />
      </div>

      {/* Journeys. Rules and rhythm rather than three identical cards. */}
      <section className="px-4 py-20 sm:px-6 sm:py-28">
        <div className="mx-auto max-w-6xl">
          <h2 className="max-w-[20ch] font-serif text-3xl leading-tight sm:text-4xl">
            Three ways into the sacred Kumaon
          </h2>

          {journeys && journeys.length > 0 ? (
            <div className="mt-12 grid gap-12 md:grid-cols-2 lg:grid-cols-3">
              {journeys.map((journey) => (
                <div key={journey.id} className="relative">
                  <JourneyCard journey={journey} />
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-8 max-w-[60ch] text-ink-inverse/60">
              Journeys are still being prepared. Nothing is published until the
              itinerary, altitudes and accommodation have been confirmed by our
              operations team.
            </p>
          )}
        </div>
      </section>

      {/* Homestay. The differentiator gets a split composition of its own, not a
          card in a grid. Decision D5. */}
      <section className="border-t border-white/10 px-4 py-20 sm:px-6 sm:py-28">
        <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-2">
          <div>
            <h2 className="max-w-[18ch] font-serif text-3xl leading-tight sm:text-4xl">
              The room is the point, not the compromise
            </h2>
            <div className="mt-6 max-w-[54ch] space-y-4 text-[15px] leading-relaxed text-ink-inverse/70">
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
              className="mt-8 inline-flex items-center gap-2 text-sm text-gold"
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

      {/* Permits. Real configured data, with the caveat the API ships alongside it. */}
      <section className="border-t border-white/10 bg-himalayan/40 px-4 py-20 sm:px-6 sm:py-28">
        <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-[1fr_1.1fr]">
          <div>
            <h2 className="max-w-[18ch] font-serif text-3xl leading-tight sm:text-4xl">
              What you will need to carry
            </h2>
            <p className="mt-6 max-w-[52ch] text-[15px] leading-relaxed text-ink-inverse/70">
              Adi Kailash sits inside an inner-line area. The paperwork is real, and
              missing one document at Dharchula ends the trip there. We handle the
              submission; you bring the originals.
            </p>
            <Link
              href="/plan"
              className="mt-8 inline-flex items-center gap-2 text-sm text-gold"
            >
              Full preparation guide
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

          {checklist && checklist.requirements.length > 0 ? (
            <ul className="space-y-4">
              {checklist.requirements.map((req) => (
                <li key={req.id} className="flex gap-3.5">
                  <svg
                    viewBox="0 0 16 16"
                    className="mt-0.5 size-4 shrink-0 text-gold"
                    aria-hidden="true"
                    fill="none"
                  >
                    <path
                      d="M3.5 8.4l3 3 6-6.8"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  <div>
                    <p className="text-[15px] text-ink-inverse">
                      {req.label}
                      {!req.is_mandatory && (
                        <span className="ml-2 text-sm text-ink-inverse/50">
                          recommended
                        </span>
                      )}
                    </p>
                    {req.description && (
                      <p className="mt-1 max-w-[52ch] text-sm leading-relaxed text-ink-inverse/60">
                        {req.description}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-ink-inverse/60">
              The document list is being confirmed with the permit authority.
            </p>
          )}
        </div>
      </section>

      <section className="border-t border-white/10 px-4 py-20 sm:px-6 sm:py-24">
        <div className="mx-auto max-w-2xl text-center">
          <p className="font-serif text-2xl leading-snug sm:text-3xl">
            {displayLocalized(brand.identity.promise, locale)}
          </p>
          <p className="mt-5 text-[15px] text-ink-inverse/65">
            Talk to someone who lives in Pithoragarh and has driven this road.
          </p>
          <Link
            href="/enquire"
            className="mt-8 inline-block rounded-full bg-gold px-6 py-3 text-sm font-medium text-midnight transition-transform hover:brightness-105 active:scale-[0.98]"
          >
            {displayLocalized(brand.campaign.flagship.secondaryCta, locale)}
          </Link>
        </div>
      </section>
    </main>
  );
}
