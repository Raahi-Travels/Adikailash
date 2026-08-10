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

function Fact({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-[0.1em] text-ink-inverse/45">{label}</dt>
      <dd className={value ? "mt-1 text-sm" : "mt-1 text-sm text-ink-inverse/45"}>
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

      <p className="text-sm text-gold">{FAMILY_LABEL[journey.family] ?? journey.family}</p>

      <h3 className="mt-2 font-serif text-2xl leading-snug text-ink-inverse">
        <Link
          href={`/journeys/${journey.slug}`}
          className="after:absolute after:inset-0 focus-visible:outline-none"
        >
          {journey.name}
        </Link>
      </h3>

      {journey.essence && (
        <p className="mt-3 max-w-[52ch] text-[15px] leading-relaxed text-ink-inverse/70">
          {journey.essence}
        </p>
      )}

      <dl className="mt-6 grid grid-cols-3 gap-4 text-ink-inverse/85">
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
        className="mt-6 inline-flex w-fit items-center gap-2 text-sm text-gold transition-transform group-hover:translate-x-0.5"
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
