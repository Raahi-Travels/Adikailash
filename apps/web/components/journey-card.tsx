import { Scene } from "@/components/scene";
import { Link } from "@/i18n/navigation";
import type { JourneySummary } from "@/lib/api";
import { journeyScene } from "@/lib/imagery";

/**
 * Journey card.
 *
 * Doc 02 caps what a card may reveal: "Journey name and spiritual or cultural
 * essence, duration and starting gateway, service tiers, next relevant departure, a
 * truthful difficulty or comfort cue, one primary action. Avoid cramming full
 * itineraries and every badge into cards."
 *
 * Facts that are not yet approved render as "to be confirmed" rather than being
 * quietly dropped, so an unfinished journey looks unfinished instead of looking like
 * it has no altitude.
 */

const FAMILY_LABEL: Record<string, string> = {
  sacred_flagship: "Flagship pilgrimage",
  kumaon_circuit: "Kumaon circuit",
  homestay_immersion: "Homestay immersion",
  paths_of_mahadev: "Temple hike",
  private_sacred: "Private journey",
  cultural_experience: "Cultural experience",
  ground_services: "Ground services",
};

/**
 * Sentence case rather than the small uppercase tracked label this used to use.
 * Three facts on each of three cards made nine wide-tracked micro-labels on one
 * screen, which is the templated rhythm doc 02 warns against and which reads as
 * scaffolding rather than information.
 */
function Fact({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <dt className="text-sm text-tone-muted">{label}</dt>
      <dd
        className={
          value
            ? "type-reading mt-0.5 text-[15px] text-tone-strong"
            : "mt-0.5 text-[15px] text-tone-muted"
        }
      >
        {value ?? "To be confirmed"}
      </dd>
    </div>
  );
}

export function JourneyCard({ journey }: { journey: JourneySummary }) {
  return (
    // `relative` is load-bearing: the title link below spreads an ::after over the
    // whole card to make it clickable, and that overlay resolves against the nearest
    // positioned ancestor.
    <article className="group relative flex flex-col">
      <Scene
        name={journeyScene(journey.slug).key}
        className="mb-6 transition-transform duration-500 group-hover:scale-[1.01]"
      />

      {/* Was gold. Gold sits at roughly 2.3:1 on the light register, so as text it
          fails the body minimum; it stays on this card as the link underline, where
          it points without having to be read. */}
      <p className="text-sm text-tone-muted">
        {FAMILY_LABEL[journey.family] ?? journey.family}
      </p>

      <h3 className="mt-2 font-serif text-2xl leading-snug text-tone-strong">
        <Link
          href={`/journeys/${journey.slug}`}
          className="after:absolute after:inset-0 focus-visible:outline-none"
        >
          {journey.name}
        </Link>
      </h3>

      {journey.essence && (
        <p className="mt-3 max-w-[52ch] text-[15px] leading-relaxed text-tone-body">
          {journey.essence}
        </p>
      )}

      <dl className="mt-6 grid grid-cols-3 gap-4">
        <Fact
          label="Nights"
          value={journey.duration_nights ? String(journey.duration_nights) : null}
        />
        <Fact label="From" value={journey.gateway} />
        <Fact
          label="Highest point"
          value={
            journey.highest_altitude_m ? `${journey.highest_altitude_m} m` : null
          }
        />
      </dl>

      <Link
        href={`/journeys/${journey.slug}`}
        className="mt-6 inline-flex w-fit items-center gap-2 text-sm font-medium text-tone-strong underline decoration-gold decoration-2 underline-offset-4 transition-transform group-hover:translate-x-0.5"
      >
        Explore this journey
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
    </article>
  );
}
