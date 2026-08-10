import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";

import { Scene } from "@/components/scene";
import { Link } from "@/i18n/navigation";
import { api, type Locale, type Stay } from "@/lib/api";
import { journeyScene } from "@/lib/imagery";
import { whatsappLink } from "@/lib/brand";

/**
 * Journey detail: doc 03 calls this "the most important conversion asset" and
 * requires it to be "a complete, crawlable and shareable source of truth".
 *
 * The at-a-glance table therefore renders unconfirmed facts as "to be confirmed"
 * instead of hiding the row. A missing altitude is information; a silently absent
 * row reads as though the question was never asked.
 */

function Fact({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="border-t border-white/12 py-4">
      <dt className="text-xs uppercase tracking-[0.1em] text-ink-inverse/45">{label}</dt>
      <dd className={value ? "mt-1.5 text-[15px]" : "mt-1.5 text-[15px] text-ink-inverse/45"}>
        {value ?? "To be confirmed"}
      </dd>
    </div>
  );
}

/** Comfort truth, spelled out. Doc 03's "Accommodation reality". */
function StayFacts({ stay }: { stay: Stay }) {
  const rows: [string, boolean | null][] = [
    ["Running hot water", stay.has_running_hot_water],
    ["Heating", stay.has_heating],
    ["Mobile network", stay.has_mobile_network],
    ["Shared bathroom", stay.is_shared_bathroom],
  ];
  return (
    <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
      {rows.map(([label, value]) => (
        <div key={label} className="flex items-center justify-between gap-3">
          <dt className="text-ink-inverse/60">{label}</dt>
          <dd className={value === null ? "text-ink-inverse/40" : "text-ink-inverse"}>
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

  return (
    <main id="main" className="flex-1 bg-midnight text-ink-inverse">
      <section className="px-4 pb-12 pt-14 sm:px-6 sm:pb-16 sm:pt-20">
        <div className="mx-auto max-w-6xl">
          <Link href="/journeys" className="text-sm text-ink-inverse/55 hover:text-gold">
            Journeys
          </Link>
          <h1 className="mt-4 max-w-[18ch] font-serif text-4xl leading-[1.1] sm:text-5xl">
            {journey.name}
          </h1>
          {journey.essence && (
            <p className="mt-5 max-w-[56ch] text-lg leading-relaxed text-ink-inverse/70">
              {journey.essence}
            </p>
          )}

          {/* Doc 03: distinguish approved facts from pending ones, visibly. */}
          {!journey.is_fully_translated && locale === "hi" && (
            <p lang="en" className="mt-6 max-w-[56ch] rounded bg-white/5 px-4 py-3 text-sm text-ink-inverse/65">
              Parts of this page are still shown in English. The Hindi translation is
              being written and reviewed.
            </p>
          )}

          <div className="mt-9 flex flex-wrap gap-3">
            {wa ? (
              <a
                href={wa}
                className="rounded-full bg-gold px-6 py-3 text-sm font-medium text-midnight active:scale-[0.98]"
              >
                Ask about this journey
              </a>
            ) : (
              <Link
                href="/enquire"
                className="rounded-full bg-gold px-6 py-3 text-sm font-medium text-midnight active:scale-[0.98]"
              >
                Ask about this journey
              </Link>
            )}
            <Link
              href="/plan"
              className="rounded-full px-6 py-3 text-sm font-medium ring-1 ring-white/25 hover:ring-white/50"
            >
              What to prepare
            </Link>
          </div>
        </div>
      </section>

      <section className="px-4 sm:px-6">
        <div className="mx-auto grid max-w-6xl gap-x-12 gap-y-10 lg:grid-cols-[1.1fr_1fr]">
          <div>
            <h2 className="font-serif text-2xl">At a glance</h2>
            <dl className="mt-5">
              <Fact
                label="Nights"
                value={journey.duration_nights ? String(journey.duration_nights) : null}
              />
              <Fact label="Starting gateway" value={journey.gateway} />
              <Fact
                label="Highest point"
                value={
                  journey.highest_altitude_m
                    ? `${journey.highest_altitude_m} m above sea level`
                    : null
                }
              />
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
          <Scene
            name={journeyScene(journey.slug, "detail").key}
            sizes="(min-width: 1024px) 45vw, 100vw"
            className="self-start"
          />
        </div>
      </section>

      {journey.tiers.length > 0 && (
        <section className="px-4 py-20 sm:px-6 sm:py-24">
          <div className="mx-auto max-w-6xl">
            <h2 className="font-serif text-3xl">How the tiers differ</h2>
            <p className="mt-3 max-w-[56ch] text-[15px] text-ink-inverse/65">
              Concrete differences only. Where a tier still says &ldquo;to be
              confirmed&rdquo;, it has not been signed off yet.
            </p>
            <div className="mt-9 grid gap-8 md:grid-cols-2 lg:grid-cols-3">
              {journey.tiers.map((tier) => (
                <div key={tier.id} className="border-t border-white/15 pt-5">
                  <h3 className="font-serif text-xl">{tier.name}</h3>
                  {tier.is_private && (
                    <p className="mt-1 text-sm text-gold">Private departure</p>
                  )}
                  <p className="mt-3 max-w-[46ch] text-sm leading-relaxed text-ink-inverse/65">
                    {tier.differentiators ?? "Details to be confirmed."}
                  </p>
                  {tier.max_group_size && (
                    <p className="mt-3 text-sm text-ink-inverse/80">
                      Up to {tier.max_group_size} travellers
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {journey.stages.length > 0 ? (
        <section className="border-t border-white/10 px-4 py-20 sm:px-6 sm:py-24">
          <div className="mx-auto max-w-6xl">
            <h2 className="font-serif text-3xl">Day by day</h2>
            <ol className="mt-9 space-y-8">
              {journey.stages.map((stage) => (
                <li key={stage.id} className="grid gap-4 sm:grid-cols-[5rem_1fr]">
                  <p className="text-sm text-gold">Day {stage.day_number}</p>
                  <div>
                    <h3 className="font-serif text-xl">{stage.title}</h3>
                    {stage.travel_note && (
                      <p className="mt-2 max-w-[62ch] text-[15px] leading-relaxed text-ink-inverse/70">
                        {stage.travel_note}
                      </p>
                    )}
                    {stage.altitude_note && (
                      <p className="mt-1.5 text-sm text-ink-inverse/55">
                        {stage.altitude_note}
                      </p>
                    )}
                    {stage.is_route_dependent && (
                      <p className="mt-3 inline-block rounded bg-saffron/15 px-3 py-1.5 text-sm text-ink-inverse/85">
                        This day depends on road and permit conditions and may change.
                      </p>
                    )}
                    {stage.stay && (
                      <div className="mt-4 max-w-[52ch] rounded-lg bg-himalayan/50 p-4 ring-1 ring-inset ring-white/10">
                        <p className="text-sm text-ink-inverse/55">Night</p>
                        <p className="mt-0.5 text-[15px]">{stage.stay.name}</p>
                        <StayFacts stay={stage.stay} />
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>
      ) : (
        <section className="border-t border-white/10 px-4 py-20 sm:px-6 sm:py-24">
          <div className="mx-auto max-w-6xl">
            <h2 className="font-serif text-3xl">Day by day</h2>
            <p className="mt-4 max-w-[60ch] text-[15px] leading-relaxed text-ink-inverse/65">
              The day-by-day itinerary for this journey has not been published yet. We
              publish it only once the route, timings and accommodation have been
              walked and confirmed, rather than adapting someone else&rsquo;s brochure.
            </p>
          </div>
        </section>
      )}

      {homestays.length > 0 && (
        <section className="border-t border-white/10 px-4 py-20 sm:px-6 sm:py-24">
          <div className="mx-auto max-w-6xl">
            <h2 className="font-serif text-3xl">Your hosts</h2>
            <div className="mt-9 grid gap-10 md:grid-cols-2">
              {homestays.map((stay) => (
                <div key={stay.id}>
                  <h3 className="font-serif text-xl">{stay.name}</h3>
                  {stay.village && (
                    <p className="mt-1 text-sm text-gold">{stay.village}</p>
                  )}
                  {stay.household_story && (
                    <p className="mt-3 max-w-[52ch] text-[15px] leading-relaxed text-ink-inverse/70">
                      {stay.household_story}
                    </p>
                  )}
                  <StayFacts stay={stay} />
                  {stay.limitations_note && (
                    <p className="mt-3 text-sm text-ink-inverse/55">
                      {stay.limitations_note}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="border-t border-white/10 px-4 py-16 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <h2 className="font-serif text-2xl">Before you decide</h2>
          <p className="mt-4 max-w-[62ch] text-[15px] leading-relaxed text-ink-inverse/70">
            This is high-altitude travel on mountain roads. We do not assess anyone
            &rsquo;s fitness and cannot tell you whether the journey is safe for you or
            your parents. Please speak to a qualified doctor first. We will tell you
            honestly what the days demand.
          </p>
        </div>
      </section>
    </main>
  );
}
