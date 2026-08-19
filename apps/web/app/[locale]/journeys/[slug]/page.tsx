import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";

import { AltitudeProfile } from "@/components/altitude-profile";
import { familyLabel } from "@/components/journey-card";
import { Scene, SceneBackdrop } from "@/components/scene";
import { BreadcrumbLd, JourneyLd } from "@/components/structured-data";
import { PrimaryAction, QuietAction } from "@/components/ui/action";
import { Band, BleedGrid, Content } from "@/components/ui/band";
import { EmptyState } from "@/components/ui/empty-state";
import { Link } from "@/i18n/navigation";
import { api, type Locale, type Stay } from "@/lib/api";
import { whatsappLink } from "@/lib/brand";
import { journeyScene } from "@/lib/imagery";

/**
 * Journey detail: doc 03 calls this "the most important conversion asset" and
 * requires it to be "a complete, crawlable and shareable source of truth".
 *
 * The page is built around one question, which is the question this business is
 * actually answering: **what is settled, and what is not.** So an unconfirmed fact
 * renders as "To be confirmed" rather than vanishing, a day that depends on the
 * road says so on that day, and the altitude profile publishes the gaps in its own
 * data instead of drawing a smooth line through them. A missing altitude is
 * information; a silently absent row reads as though the question was never asked.
 *
 * Structurally it alternates register: the photograph and the name on midnight,
 * what is settled on the luminous cream, the itinerary and its altitude back on
 * midnight because that is the register this site gives to measured things, then
 * the hosts and the health warning on cream again. The register change is the
 * divider; there is not a hairline rule anywhere on the page.
 */

/**
 * The clearance a hero needs to keep its first line clear of the floating pill.
 *
 * `<main data-hero-page>` opts out of the layout's automatic top padding so the
 * photograph can run under the nav, which means the type has to ask for the room
 * itself. An inline style rather than an arbitrary Tailwind class because it
 * composes runtime custom properties, and a class that silently fails to be
 * generated is worse than one that was never a class.
 */
const HERO_CLEARANCE = {
  paddingBlockStart:
    "calc(var(--chrome-top) + var(--nav-h) + var(--nav-inset) * 2 + 2.5rem)",
};

const BLOCK_GAP = { marginBlockStart: "var(--band-y-tight)" };

/**
 * Operations writes a placeholder into a text field while the real answer is being
 * signed off, and it carries an internal reference: "TO BE CONFIRMED by
 * operations, see decision O6". Publishing that verbatim leaks a decision log onto
 * a customer page and says less than the plain phrase does.
 *
 * Treating it as absent is not hiding anything. The field renders "To be
 * confirmed" either way, which is exactly what the marker means.
 */
function settled(value: string | null): string | null {
  if (!value) return null;
  return /^\s*TO BE CONFIRMED\b/i.test(value) ? null : value;
}

/** One label over one value, with the unconfirmed case spelled out rather than dropped. */
function Fact({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="min-w-0">
      <dt className="type-meta text-tone-muted">{label}</dt>
      <dd
        className={`type-body type-reading mt-2 ${value ? "text-tone-strong" : "text-tone-muted"}`}
      >
        {value ?? "To be confirmed"}
      </dd>
    </div>
  );
}

/**
 * Comfort truth, spelled out. Doc 03's "Accommodation reality".
 *
 * A wrapping row of label-and-value pairs rather than a two-column grid of rows
 * with the value pushed to the right: at 390px that grid put "Running hot water"
 * and "Unconfirmed" into a collision.
 */
function StayFacts({ stay }: { stay: Stay }) {
  const rows: [string, boolean | null][] = [
    ["Running hot water", stay.has_running_hot_water],
    ["Heating", stay.has_heating],
    ["Mobile network", stay.has_mobile_network],
    ["Shared bathroom", stay.is_shared_bathroom],
  ];
  return (
    <dl className="mt-5 flex flex-wrap gap-x-8 gap-y-4">
      {rows.map(([label, value]) => (
        <div key={label} className="min-w-0">
          <dt className="type-meta text-tone-muted">{label}</dt>
          <dd
            className={`type-meta mt-1 font-normal ${value === null ? "text-tone-muted" : "text-tone-strong"}`}
          >
            {value === null ? "Unconfirmed" : value ? "Yes" : "No"}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export default async function JourneyDetailPage({
  params,
}: PageProps<"/[locale]/journeys/[slug]">) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const journey = await api.journey(slug, locale as Locale);
  if (!journey) notFound();

  const wa = whatsappLink({ journey: journey.name, intent: "journey" });
  const homestays = journey.stages
    .map((s) => s.stay)
    .filter((s): s is Stay => s !== null && s.kind === "homestay");

  const heroScene = journeyScene(journey.slug, "card").key;
  const figureScene = journeyScene(journey.slug, "detail").key;
  const routeDependentDays = journey.stages.filter((s) => s.is_route_dependent).length;

  return (
    <>
      <JourneyLd journey={journey} locale={locale} />
      <BreadcrumbLd
        locale={locale}
        trail={[
          { name: "Journeys", path: "/journeys" },
          { name: journey.name, path: `/journeys/${journey.slug}` },
        ]}
      />

      <main id="main" data-hero-page className="flex-1">
        {/* ------------------------------------------------------------------
            The name, on the mountain it is named after.
        ------------------------------------------------------------------ */}
        <section
          data-register-mark="dark"
          className="register-dark relative isolate flex min-h-[30rem] items-end overflow-hidden sm:min-h-[36rem] lg:min-h-[40rem]"
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
            <Link
              href="/journeys"
              className="type-meta text-tone-muted transition-colors duration-[var(--dur-fast)] hover:text-tone-strong"
            >
              Journeys
            </Link>
            <p className="type-meta mt-6 text-tone-muted">
              {familyLabel(journey.family)}
            </p>
            <h1 className="type-display glow-display mt-3 max-w-[15ch] text-tone-strong">
              {journey.name}
            </h1>
            {journey.essence && (
              <p className="type-lead mt-6 text-tone-body">{journey.essence}</p>
            )}

            {/* Doc 03: distinguish approved facts from pending ones, visibly. */}
            {!journey.is_fully_translated && locale === "hi" && (
              <p lang="en" className="type-body measure-meta mt-6 text-tone-muted">
                Parts of this page are still shown in English. The Hindi translation
                is being written and reviewed.
              </p>
            )}

            <div className="mt-10 flex flex-wrap gap-4">
              <PrimaryAction href={wa ?? "/enquire"}>
                Ask about this journey
              </PrimaryAction>
              <QuietAction href="/plan">What to prepare</QuietAction>
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------------------
            What is settled. The page's real subject.
        ------------------------------------------------------------------ */}
        <Band register="light" glow grain id="at-a-glance">
          <Content>
            {/*
              The heading holds a narrow left column and the facts fill the rest,
              rather than a full-width title over a sparse three-across grid with
              360px of nothing beside it. The audit's "dead right column" is not
              fixed by widening the grid; it is fixed by giving the width a job.
            */}
            <div className="grid gap-x-16 gap-y-10 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
              <div>
                <h2 className="type-title-1 text-tone-strong">
                  What is settled, and what is not
                </h2>
                <p className="type-body mt-5 text-tone-body">
                  Everything below is either a fact somebody here has checked, or
                  the words &ldquo;to be confirmed&rdquo;. There is no third state,
                  and nothing has been filled in to make the page look finished.
                </p>
              </div>

              <dl className="grid gap-x-12 gap-y-10 sm:grid-cols-2">
                <Fact
                  label="Nights"
                  value={
                    journey.duration_nights ? String(journey.duration_nights) : null
                  }
                />
                <Fact label="Starting gateway" value={journey.gateway} />
                <Fact
                  label="Highest point"
                  value={
                    journey.highest_altitude_m
                      ? `${journey.highest_altitude_m.toLocaleString("en-IN")} m above sea level`
                      : null
                  }
                />
                {/* Only when there is an itinerary. "Days written up: to be
                    confirmed" is not what an unwritten itinerary means, and the
                    section below already says so in a whole sentence. */}
                {journey.stages.length > 0 && (
                  <Fact
                    label="Days written up"
                    value={String(journey.stages.length)}
                  />
                )}
                <Fact
                  label="Service tiers"
                  value={
                    journey.tiers.length
                      ? journey.tiers.map((t) => t.name).join(", ")
                      : null
                  }
                />
                <Fact
                  label="Content last reviewed"
                  value={journey.last_reviewed_at}
                />
              </dl>
            </div>
          </Content>

          {journey.tiers.length > 0 && (
            <div style={BLOCK_GAP}>
              <Content>
              <h2 className="type-title-1 text-tone-strong">How the tiers differ</h2>
              <p className="type-body mt-5 text-tone-body">
                Concrete differences only. A tier that still reads &ldquo;to be
                confirmed&rdquo; has not been signed off, and we would rather say
                that than describe a service nobody has agreed to run.
              </p>
              {/*
                A stacked list, not three columns. Three equal boxes in a row is the
                shape that made the old catalogue read as generated, and it is
                especially wrong here: with every tier currently unconfirmed, three
                identical boxes say the same nothing three times, side by side.
              */}
              <ul className="mt-10 flex max-w-[58rem] flex-col gap-10">
                {journey.tiers.map((tier) => (
                  <li
                    key={tier.id}
                    className="grid gap-x-10 gap-y-3 sm:grid-cols-[minmax(0,14rem)_minmax(0,1fr)]"
                  >
                    <div>
                      <h3 className="type-title-2 text-tone-strong">{tier.name}</h3>
                      {tier.is_private && (
                        <p className="type-meta mt-2 text-tone-muted">
                          Private departure
                        </p>
                      )}
                    </div>
                    <div>
                      <p
                        className={`type-body ${settled(tier.differentiators) ? "text-tone-body" : "text-tone-muted"}`}
                      >
                        {settled(tier.differentiators) ?? "To be confirmed."}
                      </p>
                      {tier.max_group_size && (
                        <p className="type-meta mt-3 text-tone-body">
                          Up to {tier.max_group_size} travellers
                        </p>
                      )}
                    </div>
                  </li>
                ))}
                </ul>
              </Content>
            </div>
          )}
        </Band>

        {/* ------------------------------------------------------------------
            The itinerary and its altitude, on midnight: the register this site
            gives to things somebody measured.
        ------------------------------------------------------------------ */}
        <Band register="dark" glow grain id="day-by-day">
          <BleedGrid>
            {/*
              The one sanctioned grid break on this page, and it is flush with the
              top of the band rather than floating inside it. A picture that starts
              partway down a section always shows a top edge, and no mask fixes
              that because a mask fades what is inside the box rather than the line
              where the box begins. Run it `full` and pull it up through the band's
              own top padding and there are only three edges left, two of them past
              the viewport and the third dissolving downward into the itinerary.

              No scrim, and that does not break the mask-and-scrim pair: the pair
              exists so a photograph never passes through mid-grey on its way to
              nothing, and what is behind this one is already midnight. A scrim
              here would be a flat rectangle laid over the band's own gradient.

              Ramps, against the 200px floor: 268px at 390, 238px at 768, 339px at
              1440.
            */}
            {journey.stages.length > 0 && (
              <figure
                className="full relative aspect-4/5 sm:aspect-16/9 lg:aspect-21/9"
                style={{ marginBlockStart: "calc(var(--band-y) * -1)" }}
              >
                <Scene
                  name={figureScene}
                  fill
                  feather="bottom"
                  scrim={false}
                  radius="none"
                  sizes="calc(100vw * 1.35)"
                />
              </figure>
            )}

            <div style={journey.stages.length > 0 ? BLOCK_GAP : undefined}>
              <h2 className="type-title-1 text-tone-strong">Day by day</h2>
              <p className="type-body mt-5 text-tone-body">
                The days as they are actually run.{" "}
                {routeDependentDays > 0
                  ? "Where a day turns on the road or on a permit, it says so on that day. Neither of those is ours to decide, and both change through the season."
                  : "Where a detail is still being checked, the day says so rather than reading as though it were settled."}
              </p>
            </div>

            <div style={BLOCK_GAP}>
              {journey.stages.length > 0 ? (
                <ol className="flex flex-col gap-12">
                  {journey.stages.map((stage) => (
                    <li
                      key={stage.id}
                      className="grid gap-x-10 gap-y-2 sm:grid-cols-[minmax(0,6rem)_minmax(0,1fr)]"
                    >
                      <p className="type-meta type-reading text-tone-muted">
                        Day {stage.day_number}
                      </p>
                      <div>
                        <h3 className="type-title-2 text-tone-strong">
                          {stage.title}
                        </h3>
                        {stage.travel_note && (
                          <p className="type-body mt-3 text-tone-body">
                            {stage.travel_note}
                          </p>
                        )}
                        {stage.altitude_note && (
                          <p className="type-body mt-3 text-tone-body">
                            {stage.altitude_note}
                          </p>
                        )}
                        {stage.is_route_dependent && (
                          <p className="type-meta mt-4 text-status-limited">
                            Depends on the road and on permits, and may change.
                          </p>
                        )}
                        {stage.stay && (
                          <div className="mt-6">
                            <p className="type-meta text-tone-muted">Night</p>
                            <p className="type-body mt-1 text-tone-strong">
                              {stage.stay.name}
                            </p>
                            <StayFacts stay={stage.stay} />
                          </div>
                        )}
                      </div>
                    </li>
                  ))}
                </ol>
              ) : (
                <EmptyState
                  seed={`itinerary-${journey.slug}`}
                  className="max-w-[46rem]"
                  title="The day by day is not published yet"
                  body="An itinerary appears here once the route, the timings and the places you sleep have been walked and confirmed, rather than adapted from somebody else's brochure. Ask us and we will tell you where this one has reached."
                  action={<QuietAction href="/enquire">Ask where it stands</QuietAction>}
                />
              )}
            </div>
          </BleedGrid>

          {journey.altitude && (
            <div style={BLOCK_GAP}>
              <Content>
                <AltitudeProfile data={journey.altitude} />
              </Content>
            </div>
          )}
        </Band>

        {/* ------------------------------------------------------------------
            The households, and the sentence about doctors that has to be here.
        ------------------------------------------------------------------ */}
        <Band register="light" glow grain>
          {homestays.length > 0 && (
            <div style={{ marginBlockEnd: "var(--band-y-tight)" }}>
              <Content>
              <h2 className="type-title-1 text-tone-strong">Your hosts</h2>
              <ul className="mt-12 flex flex-col gap-14 md:grid md:grid-cols-2 md:gap-x-14">
                {homestays.map((stay) => (
                  <li key={stay.id}>
                    <h3 className="type-title-2 text-tone-strong">{stay.name}</h3>
                    {stay.village && (
                      <p className="type-meta mt-2 text-tone-muted">{stay.village}</p>
                    )}
                    {stay.household_story && (
                      <p className="type-body mt-4 text-tone-body">
                        {stay.household_story}
                      </p>
                    )}
                    <StayFacts stay={stay} />
                    {stay.limitations_note && (
                      <p className="type-body mt-4 text-tone-muted">
                        {stay.limitations_note}
                      </p>
                    )}
                  </li>
                ))}
                </ul>
              </Content>
            </div>
          )}

          <Content>
            <h2 className="type-title-2 text-tone-strong">Before you decide</h2>
            <p className="type-body mt-5 text-tone-body">
              This is high altitude travel on mountain roads. We do not assess
              anyone&rsquo;s fitness and cannot tell you whether the journey is safe
              for you or for your parents. Please speak to a qualified doctor first.
              What we can do is tell you honestly what the days demand.
            </p>
            <div className="mt-9 flex flex-wrap gap-4">
              <PrimaryAction href={wa ?? "/enquire"}>
                Ask us about the pace
              </PrimaryAction>
              <QuietAction href="/journeys">All journeys</QuietAction>
            </div>
          </Content>
        </Band>
      </main>
    </>
  );
}
