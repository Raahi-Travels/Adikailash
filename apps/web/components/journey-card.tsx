import Image from "next/image";

import { PhotoSlot } from "@/components/photo-slot";
import { Link } from "@/i18n/navigation";
import type { JourneySummary } from "@/lib/api";
import { journeyScene } from "@/lib/imagery";
import { SCENES, sceneSrc } from "@/lib/imagery";

/**
 * Journey card.
 *
 * Doc 02 caps what a card may reveal: "Journey name and spiritual or cultural
 * essence, duration and starting gateway, service tiers, next relevant departure, a
 * truthful difficulty or comfort cue, one primary action. Avoid cramming full
 * itineraries and every badge into cards."
 *
 * **The photograph is the card, rather than sitting in it.** The previous version put
 * a small rounded image above a block of text, which is the shape of a search result:
 * the picture reads as an illustration attached to an article, and on a page selling
 * a mountain that is the wrong way round. Now the image fills the frame, the text
 * sits on it over a gradient that starts from the image's own darkness, and there is
 * no container edge anywhere. Nothing is placed on top of the photograph; the
 * photograph becomes the surface.
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
    <div className="min-w-0">
      <dt className="text-[13px] text-ink-inverse/55">{label}</dt>
      <dd
        className={
          value
            ? "type-reading mt-0.5 truncate text-sm text-ink-inverse"
            : "mt-0.5 truncate text-sm text-ink-inverse/50"
        }
      >
        {value ?? "To be confirmed"}
      </dd>
    </div>
  );
}

export function JourneyCard({ journey }: { journey: JourneySummary }) {
  const scene = journeyScene(journey.slug);
  const src = sceneSrc(scene.key);
  const meta = SCENES[scene.key];

  return (
    <article className="group relative isolate flex min-h-[30rem] flex-col justify-end overflow-hidden rounded-2xl">
      {src ? (
        <>
          <Image
            src={src}
            alt={meta.alt}
            fill
            sizes="(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw"
            // Slow, small, and only on hover. The picture should feel like it is
            // being looked at rather than like it is animating.
            className="-z-10 object-cover transition-transform duration-[1200ms] ease-out group-hover:scale-[1.04]"
          />
          {/*
            The gradient is deliberately tall and starts from fully transparent at
            45%. A short, hard scrim reads as a bar laid across a picture; a long one
            reads as the picture getting darker towards the bottom, which is what
            photographs do anyway.
          */}
          <div
            aria-hidden
            className="absolute inset-0 -z-10 bg-gradient-to-t from-midnight via-midnight/80 via-30% to-transparent to-70%"
          />
        </>
      ) : (
        <PhotoSlot brief={meta.brief} ratio={meta.ratio} className="absolute inset-0 -z-10" />
      )}

      <div className="p-6 sm:p-7">
        <p className="text-sm text-gold">
          {FAMILY_LABEL[journey.family] ?? journey.family}
        </p>

        <h3 className="mt-1.5 font-serif text-[1.75rem] leading-tight text-ink-inverse">
          <Link
            href={`/journeys/${journey.slug}`}
            // Spreads the hit area over the whole card, so the image is the link
            // rather than the small underlined phrase that used to sit beneath it.
            className="after:absolute after:inset-0 focus-visible:outline-none"
          >
            {journey.name}
          </Link>
        </h3>

        {journey.essence && (
          <p className="mt-2.5 line-clamp-2 max-w-[46ch] text-[15px] leading-relaxed text-ink-inverse/75">
            {journey.essence}
          </p>
        )}

        <dl className="mt-5 grid grid-cols-3 gap-4 border-t border-white/15 pt-4">
          <Fact
            label="Nights"
            value={journey.duration_nights ? String(journey.duration_nights) : null}
          />
          <Fact label="From" value={journey.gateway} />
          <Fact
            label="Highest point"
            value={journey.highest_altitude_m ? `${journey.highest_altitude_m} m` : null}
          />
        </dl>
      </div>
    </article>
  );
}
