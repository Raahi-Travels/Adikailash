import { setRequestLocale } from "next-intl/server";

import { familyLabel, JourneyCard } from "@/components/journey-card";
import { Scene, SceneBackdrop } from "@/components/scene";
import { JourneyListLd } from "@/components/structured-data";
import { PrimaryAction, QuietAction } from "@/components/ui/action";
import { Band, BleedGrid, Constellation, Content } from "@/components/ui/band";
import { EmptyState } from "@/components/ui/empty-state";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { api, type JourneySummary, type Locale } from "@/lib/api";
import { buildMetadata } from "@/lib/brand";
import { journeyScene } from "@/lib/imagery";

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

/**
 * The clearance a hero section needs to keep its first line out from under the
 * floating nav pill.
 *
 * `<main data-hero-page>` opts out of the layout's automatic top padding so the
 * photograph can run under the pill, which means the *type* inside the hero has to
 * ask for the room itself. Written as an inline style rather than an arbitrary
 * Tailwind value because it composes runtime custom properties, and a class that
 * silently fails to be generated is worse than one that is not a class.
 */
const HERO_CLEARANCE = {
  paddingBlockStart:
    "calc(var(--chrome-top) + var(--nav-h) + var(--nav-inset) * 2 + 2.5rem)",
};

const COUNT_WORD = [
  "No",
  "One",
  "Two",
  "Three",
  "Four",
  "Five",
  "Six",
  "Seven",
  "Eight",
  "Nine",
  "Ten",
];

/** Spelled out up to ten, then numerals. Never a rounded-up "several". */
function counted(n: number, singular: string, plural: string) {
  const word = n < COUNT_WORD.length ? COUNT_WORD[n] : String(n);
  return `${word} ${n === 1 ? singular : plural}`;
}

/**
 * The journeys index.
 *
 * It used to be a page title floating over three identically shaped cards in a
 * row, which is the single fastest way to make a catalogue read as generated: the
 * same crop, the same height and the same weight three times says the operator
 * has no view about which of these is the thing they actually do.
 *
 * So the page is composed instead. The flagship pilgrimage takes a band of its
 * own, at title-1 scale, with a photograph that breaks the reading column and runs
 * off the right edge of the viewport, and it carries the page's only gold action.
 * Everything else follows in the constellation, on the dark register, at unequal
 * spans and unequal vertical offsets.
 *
 * **Which journey leads is read from the data, never hardcoded.** A catalogue that
 * loses its flagship must not leave a page insisting there is one, and a heading
 * that counts what is below it must count what is actually below it.
 */
export default async function JourneysPage({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const journeys = await api.journeys(locale as Locale);

  if (journeys === null || journeys.length === 0) {
    return (
      <main id="main" className="flex-1">
        <Band register="light" glow grain>
          <Content>
            <h1 className="type-title-1 text-tone-strong">Journeys</h1>
            <EmptyState
              className="mt-10 max-w-[46rem]"
              seed="journeys-index"
              title={
                journeys === null
                  ? "We cannot load the journeys right now"
                  : "No journeys are published yet"
              }
              body={
                journeys === null
                  ? "This is our end, not yours. The catalogue lives on a service this page could not reach. Please try again shortly, or write to us and we will answer with the same detail the page would have carried."
                  : "A journey appears here only once its itinerary, its altitudes and the places you sleep have been walked and confirmed. Until then there is nothing on this page to choose between."
              }
              action={<QuietAction href="/enquire">Ask us directly</QuietAction>}
            />
          </Content>
        </Band>
      </main>
    );
  }

  // The flagship is a property of the journey, not a position in the list. If the
  // family ever disappears from the catalogue the first published journey leads,
  // and nothing on the page claims a flagship that is not there.
  const flagship: JourneySummary =
    journeys.find((j) => j.family === "sacred_flagship") ?? journeys[0];
  const rest = journeys.filter((j) => j.id !== flagship.id);

  const heroScene = journeyScene(flagship.slug, "card").key;
  const flagshipFigure = journeyScene(flagship.slug, "detail").key;

  return (
    <>
      <JourneyListLd journeys={journeys} locale={locale} />

      <main id="main" data-hero-page className="flex-1">
        {/* ------------------------------------------------------------------
            The opening. A photograph carrying the page rather than a title
            floating in cream above a grid.
        ------------------------------------------------------------------ */}
        <section
          data-register-mark="dark"
          className="register-dark relative isolate flex min-h-[28rem] items-end overflow-hidden sm:min-h-[34rem] lg:min-h-[38rem]"
        >
          <SceneBackdrop
            name={heroScene}
            scrim="left"
            sizes="(min-width: 1024px) 1440px, calc(100vw * 1.35)"
          />
          <div
            className="mx-auto w-full max-w-[75rem] px-[var(--gutter)] pb-[var(--band-y-tight)]"
            style={HERO_CLEARANCE}
          >
            <h1 className="type-display glow-display max-w-[12ch] text-tone-strong">
              Journeys
            </h1>
            <p className="type-lead mt-6 text-tone-body">
              Every journey here is run from Kumaon by people who live there. Where a
              detail is still being checked, the page says so rather than guessing.
            </p>
            <p className="type-meta mt-6 text-tone-muted">
              {counted(journeys.length, "journey", "journeys")} published.
            </p>
          </div>
        </section>

        {/* ------------------------------------------------------------------
            The flagship. A band of its own, and the only gold on the page.
        ------------------------------------------------------------------ */}
        <Band register="light" glow grain>
          <BleedGrid>
            {/*
              `pop-right` runs from the reading column's left edge to the viewport
              edge, so the photograph leaves the page on the right instead of
              sitting in a box. Inside it, an asymmetric two-column split: the type
              never crosses onto the picture, which is the one thing the overlap
              contract forbids at body size.
            */}
            <div className="pop-right grid items-center gap-y-10 lg:grid-cols-[minmax(0,25rem)_minmax(0,1fr)] lg:gap-x-16">
              <div>
                <p className="type-meta text-tone-muted">
                  {familyLabel(flagship.family)}
                </p>
                <h2 className="type-title-1 mt-3 text-tone-strong">
                  <Link
                    href={`/journeys/${flagship.slug}`}
                    className="underline-offset-[0.3em] hover:underline hover:decoration-gold/70 hover:decoration-1"
                  >
                    {flagship.name}
                  </Link>
                </h2>
                {flagship.essence && (
                  <p className="type-lead mt-5 text-tone-body">{flagship.essence}</p>
                )}

                <div className="mt-10 flex flex-wrap items-end gap-x-12 gap-y-8">
                  {flagship.duration_nights !== null && (
                    <p className="text-tone-strong">
                      <span className="type-figure type-reading block">
                        {flagship.duration_nights}
                      </span>
                      <span className="type-meta mt-2 block text-tone-muted">
                        nights on the road
                      </span>
                    </p>
                  )}
                  <dl className="flex flex-wrap gap-x-10 gap-y-6">
                    <div className="min-w-0">
                      <dt className="type-meta text-tone-muted">Starting gateway</dt>
                      <dd
                        className={`type-body mt-1 ${flagship.gateway ? "text-tone-strong" : "text-tone-muted"}`}
                      >
                        {flagship.gateway ?? "To be confirmed"}
                      </dd>
                    </div>
                    <div className="min-w-0">
                      <dt className="type-meta text-tone-muted">Highest point</dt>
                      <dd
                        className={`type-body type-reading mt-1 ${flagship.highest_altitude_m ? "text-tone-strong" : "text-tone-muted"}`}
                      >
                        {flagship.highest_altitude_m
                          ? `${flagship.highest_altitude_m.toLocaleString("en-IN")} m`
                          : "To be confirmed"}
                      </dd>
                    </div>
                  </dl>
                </div>

                <div className="mt-10 flex flex-wrap gap-4">
                  <PrimaryAction href={`/journeys/${flagship.slug}`}>
                    See it day by day
                  </PrimaryAction>
                  <QuietAction href="/plan">What to prepare</QuietAction>
                </div>
              </div>

              {/*
                Not `PhotoFigure`, which feathers the bottom only on a light
                ground and would leave this picture a hard-edged rectangle butted
                against the reading column. The picture is the largest thing on the
                page and every edge of it is on show, so it takes the radial
                dissolve instead: the ramp is half the box radius, which is 224px
                at this size and well over the 200px floor, and what fades into
                cream here is pale dawn haze rather than the dark rock edge that
                goes muddy over snow. No radius, because a corner the mask has
                already taken to nothing has nothing left to round.
              */}
              <figure className="relative order-first aspect-4/5 w-full overflow-hidden sm:aspect-4/3 lg:order-none lg:aspect-5/4">
                <Scene
                  name={flagshipFigure}
                  fill
                  feather="vignette"
                  radius="none"
                  sizes="(min-width: 1024px) 62vw, calc(100vw * 1.35)"
                />
              </figure>
            </div>
          </BleedGrid>
        </Band>

        {/* ------------------------------------------------------------------
            Everything else. Dark plates on the luminous cream ground, at unequal
            spans and unequal vertical offsets, so two journeys never read as one
            template printed twice.
        ------------------------------------------------------------------ */}
        {rest.length > 0 && (
          <Band register="light" glow grain>
            <Content>
              <h2 className="type-title-1 text-tone-strong">Also from Kumaon</h2>
              <p className="type-body mt-5 text-tone-body">
                {counted(rest.length, "other journey", "other journeys")} published,
                at lower altitude and across a longer season than the flagship
                pilgrimage.
              </p>
            </Content>
            <Content className="mt-[var(--stack-block)]">
              <Constellation>
                {rest.map((journey) => (
                  <JourneyCard key={journey.id} journey={journey} />
                ))}
              </Constellation>
            </Content>
          </Band>
        )}

        {/* ------------------------------------------------------------------
            For the people who are not choosing yet.
        ------------------------------------------------------------------ */}
        <Band register="light" tight glow grain>
          <Content>
            <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <h2 className="type-title-2 text-tone-strong">
                  Not ready to pick one
                </h2>
                <p className="type-body mt-4 text-tone-body">
                  Most people arrive here before they know which of these is theirs.
                  The planning pages cover permits, altitude and what the days
                  actually demand, and you can ask us anything the pages do not
                  answer.
                </p>
              </div>
              <div className="flex flex-wrap gap-4">
                <QuietAction href="/plan">Plan your journey</QuietAction>
                <QuietAction href="/enquire">Ask us a question</QuietAction>
              </div>
            </div>
          </Content>
        </Band>
      </main>
    </>
  );
}
