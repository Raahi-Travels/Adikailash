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
 * **The photograph is the card, rather than sitting in it.** There is no container
 * edge, no ring and no chrome: the picture runs the full width of the card, its
 * foot dissolves through a mask into the card's own midnight ground, and the words
 * continue on that ground as if the photograph had simply faded into them.
 *
 * **The words do not sit on the picture, and that is a legibility decision rather
 * than a taste one.** An earlier version put the whole text block over a
 * full-bleed photograph. Measured on the Kumaon circuit card, whose picture is a
 * sunlit temple, the family label at the top of that block was landing on a
 * backdrop still 64% opaque and came out at roughly 1.6:1. A mask that reaches
 * zero at the very bottom of a box cannot make the middle of that box dark. So the
 * picture gets its own height, the mask spends its whole ramp inside it, and the
 * text starts below where the ramp ends.
 *
 * **Nothing truncates.** The previous version carried `line-clamp-2` on the essence
 * and `truncate` on every fact, which turned the site's most important phrase into
 * "To be confirm..." and a gateway into "Kathgodam / ...". On a site whose whole
 * proposition is that it says when a detail is not yet settled, clipping the words
 * that say so is the one thing this card must not do. The meta row is a wrapping
 * two-line stack instead of three fixed columns, so a long value takes the room it
 * needs and the card grows rather than losing its ending.
 *
 * Two shapes, so a list of these never reads as one template repeated:
 *
 * - `emphasis="lead"` is the tall one with the title at `.type-title-1`.
 * - `emphasis="quiet"` is shorter, at `.type-title-2`.
 *
 * **It is a plate, not a transparency.** `register-dark` carries its own midnight
 * fill, `ground-none` strips the luminosity wash off that fill so it is flat, and
 * the picture's mask dissolves straight into it. That is why there is no scrim
 * here and why that does not break the mask-and-scrim pair: the pair exists so a
 * photograph fading to alpha zero never passes through mid-grey on its way to the
 * page, and the ground this one fades into is already the exact colour a scrim
 * would have painted. Adding one as well would only bury the lower half of the
 * photograph under a gradient nobody asked for.
 *
 * The card is built to stand on the **light** register, where it reads as a dark
 * island with `lift-2` under it. On a dark band, put the photograph in the band
 * itself rather than reaching for this.
 */

/**
 * Family names, from the database enum.
 *
 * A journey whose family is not listed here renders the raw value rather than
 * nothing: an unlabelled card hides that somebody added a family and forgot the
 * front end, which is exactly the sort of silence this site is built against.
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

export function familyLabel(family: string): string {
  return FAMILY_LABEL[family] ?? family;
}

/**
 * One label over one value.
 *
 * `min-w-0` rather than a fixed column: the pair is a flex item in a wrapping row,
 * so "Kathgodam / Pithoragarh" wraps inside its own pair instead of squeezing its
 * neighbours or losing its tail.
 */
function Fact({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="min-w-0">
      <dt className="type-meta text-tone-muted">{label}</dt>
      <dd
        className={
          value
            ? "type-meta type-reading mt-1 font-normal text-tone-strong"
            : "type-meta mt-1 font-normal text-tone-muted"
        }
      >
        {value ?? "To be confirmed"}
      </dd>
    </div>
  );
}

export function JourneyCard({
  journey,
  emphasis = "quiet",
}: {
  journey: JourneySummary;
  /** The tall shape for the one journey that leads a list. */
  emphasis?: "lead" | "quiet";
}) {
  const scene = journeyScene(journey.slug);
  const lead = emphasis === "lead";

  return (
    <article
      className={[
        "group relative isolate flex flex-col overflow-hidden",
        // `register-dark` carries the midnight fill and flips every tone token, so
        // the words read exactly as they would on any dark band. `ground-none`
        // takes the luminosity wash back off that fill: the picture's mask has to
        // dissolve into one flat colour, and a gradient underneath it turns the
        // foot of every photograph into a visible rectangle.
        "register-dark ground-none",
        // Every edge of this card is solid fill rather than a feather, so all four
        // corners take the radius. A radius only notches an edge a mask has
        // already made transparent.
        "rounded-frame lift-2 transition-shadow duration-[var(--dur-base)] ease-out-soft hover:lift-3",
        // The focus ring for the stretched link below.
        //
        // The link's `::after` spreads the hit area over the whole card, so the
        // thing a keyboard user is actually targeting is the card, not the four
        // words of the title. An outline on the link alone would ring the title
        // and leave the real target unmarked, which is why the link opts out and
        // this carries the indicator instead.
        //
        // It has to sit on the `<article>` rather than inside it: this element is
        // `overflow-hidden`, so any ring drawn on a child is clipped away at the
        // card edge. An element's own outline is not clipped by its own overflow,
        // so drawn from here it survives. Same 2px at 2px offset as the global
        // `:focus-visible`, so a card focuses like everything else.
        //
        // The colour is overridden because this card is the one place where the
        // register lies about the ground. `outline-offset` draws the ring outside
        // the element, and this element is `register-dark` sitting on a cream
        // page, so the ring lands on snow rather than on the card's own midnight.
        // Inheriting the dark register's gold measured 2.15:1 there. This is the
        // light register's value, 4.39:1 on snow, chosen by where the ring lands.
        "[--color-focus:oklch(0.56_0.1_76)]",
        "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-focus",
      ].join(" ")}
    >
      {/*
        The picture, and nothing else in here, so the slow hover scale moves the
        photograph without moving a single word.

        No feather on a card, and that is a reversal.

        The picture used to dissolve into the card's own midnight ground so the
        words could start inside the fade. It worked as a diagram of an idea and
        it looked like a printing fault: the bottom third of every photograph
        went to fog, and on a card the fog has nowhere to go, because the card is
        a hard-edged object sitting on a page rather than a picture bleeding into
        one. Feathering suits a figure that has to leave its frame. A card IS the
        frame.

        What makes it lift instead is the edge itself: a crisp photograph, a
        solid caption block under it, both clipped by the card radius, and the
        elevation doing the separating. That is the editorial move, and it is
        also the honest one, because nothing about the picture is hidden.
      */}
      <div
        className={`relative w-full overflow-hidden ${
          lead ? "h-[26rem] sm:h-[32rem]" : "h-[23rem] sm:h-[26rem]"
        }`}
      >
        <div className="absolute inset-0 transition-transform duration-[var(--dur-image)] ease-out-soft group-hover:scale-[1.04] motion-reduce:transition-none motion-reduce:group-hover:scale-100">
          <Scene
            name={scene.key}
            fill
            grade
            feather="none"
            scrim={false}
            radius="none"
            sizes={
              lead
                ? "(min-width: 1024px) 58vw, (min-width: 768px) 92vw, calc(100vw * 1.35)"
                : "(min-width: 1024px) 40vw, (min-width: 768px) 92vw, calc(100vw * 1.35)"
            }
          />
        </div>
      </div>

      {/*
        Deliberately not `relative`. The link's `::after` spreads the hit area over
        the whole card, and `inset-0` resolves against the nearest positioned
        ancestor: put `relative` here and the tap target silently shrinks to the
        text block while nothing looks any different.

        Real top padding now. `pt-1` existed because the words were meant to begin
        inside a fade; with a hard edge above them they need the same breathing
        room as any caption under any photograph, or they read as having fallen
        out of the picture.
      */}
      <div className="flex flex-1 flex-col px-6 pb-6 pt-6 sm:px-8 sm:pb-8 sm:pt-7">
        <p className="type-meta text-tone-muted">{familyLabel(journey.family)}</p>

        <h3
          className={`${lead ? "type-title-1" : "type-title-2"} mt-2 text-tone-strong`}
        >
          <Link
            href={`/journeys/${journey.slug}`}
            /* `outline-none` only because the `<article>` above draws the ring for
               the whole card. Never remove it there without putting one back here. */
            className="underline-offset-[0.3em] after:absolute after:inset-0 group-hover:underline group-hover:decoration-gold/70 group-hover:decoration-1 focus-visible:outline-none"
          >
            {journey.name}
          </Link>
        </h3>

        {journey.essence && (
          <p className="type-body measure-card mt-4 text-tone-body">
            {journey.essence}
          </p>
        )}

        {/*
          Three fixed columns, not a wrapping flex row.

          Wrapping means each card breaks wherever its own values happen to run
          out of room: the flagship's gateway is "Kathgodam / Pithoragarh" and it
          pushed the third fact onto a second line, so one card's facts sat on a
          different baseline from its neighbours'. Three columns put Nights, From
          and Highest point in the same place on every card no matter how long a
          gateway is, which is the point of showing them side by side. Long values
          wrap inside their own column instead of moving anybody else.

          `mt-auto` pins the block to the foot of the card. Summaries are written
          by a person and will never be the same length, so without it the facts
          floated to wherever each summary happened to stop and the three rows of
          labels sat at three different heights. The tiles are the same height
          already; the things a reader compares across them have to be too.
        */}
        <dl className="mt-auto grid grid-cols-3 gap-x-4 gap-y-4 pt-7">
          <Fact
            label="Nights"
            value={journey.duration_nights ? String(journey.duration_nights) : null}
          />
          <Fact label="From" value={journey.gateway} />
          <Fact
            label="Highest point"
            value={
              journey.highest_altitude_m
                ? `${journey.highest_altitude_m.toLocaleString("en-IN")} m`
                : null
            }
          />
        </dl>
      </div>
    </article>
  );
}
