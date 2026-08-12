import { setRequestLocale } from "next-intl/server";

import { JourneyCard } from "@/components/journey-card";
import { JourneyListLd } from "@/components/structured-data";
import { routing } from "@/i18n/routing";
import { api, type Locale } from "@/lib/api";
import { buildMetadata } from "@/lib/brand";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

/**
 * `generateMetadata` rather than a static export, purely so the canonical can
 * carry the locale. A canonical that guessed the locale would point half the
 * site at the wrong URL.
 */
export async function generateMetadata({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;
  return buildMetadata({
  title: "Journeys",
  description:
    "Pilgrimages and cultural journeys through Kumaon, guided from Pithoragarh.",
  path: "/journeys",
    locale,
  });
}

export default async function JourneysPage({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const journeys = await api.journeys(locale as Locale);

  return (
    <>
      {journeys && <JourneyListLd journeys={journeys} locale={locale} />}
    <main id="main" className="flex-1 bg-midnight px-4 py-16 text-ink-inverse sm:px-6 sm:py-24">
      <div className="mx-auto max-w-6xl">
        <h1 className="max-w-[18ch] font-serif text-4xl leading-tight sm:text-5xl">
          Journeys
        </h1>
        <p className="mt-5 max-w-[58ch] text-[15px] leading-relaxed text-ink-inverse/70">
          Every journey below is operated from Kumaon by people who live there. Where a
          detail is still being confirmed, it says so rather than guessing.
        </p>

        {journeys === null ? (
          <p className="mt-14 max-w-[60ch] text-ink-inverse/60">
            We cannot load journeys right now. Please try again shortly.
          </p>
        ) : journeys.length === 0 ? (
          <p className="mt-14 max-w-[60ch] text-ink-inverse/60">
            No journeys are published yet. Nothing appears here until its itinerary,
            altitudes and accommodation have been confirmed.
          </p>
        ) : (
          <div className="mt-14 grid gap-12 md:grid-cols-2 lg:grid-cols-3">
            {journeys.map((journey) => (
              <div key={journey.id} className="relative">
                <JourneyCard journey={journey} />
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
    </>
  );
}
