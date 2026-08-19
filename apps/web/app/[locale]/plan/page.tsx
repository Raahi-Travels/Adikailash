import { setRequestLocale } from "next-intl/server";

import { Grain } from "@/components/backgrounds";
import { Scene } from "@/components/scene";
import { PrimaryAction, QuietAction } from "@/components/ui/action";
import { Band, BleedGrid, Content } from "@/components/ui/band";
import { ContentsRail } from "@/components/ui/contents-rail";
import { EmptyState } from "@/components/ui/empty-state";
import { Surface } from "@/components/ui/surface";
import { routing } from "@/i18n/routing";
import { api, type DocumentRequirement, type Locale } from "@/lib/api";
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
    title: "Plan your journey",
    description:
      "Documents, permits, altitude and preparation for the journey to Adi Kailash and Om Parvat.",
    path: "/plan",
    locale,
  });
}

/**
 * The section anchors, in one place because two things read them: the sticky
 * rail and the `id` on each band. A rail entry pointing at an id that does not
 * exist is a dead link that nothing catches, so they are declared together.
 */
const SECTIONS = [
  { id: "documents", label: "Documents you will need" },
  { id: "handling", label: "How your documents are handled" },
  { id: "altitude", label: "Altitude and your health" },
  { id: "talk", label: "Talk to someone first" },
] as const;

/**
 * One requirement, as a manifest row rather than a card.
 *
 * There are no rules between rows and no box around them. A 22 to 34px serif
 * label against 17 to 19px body is a large enough step to separate items on its
 * own, and it survives a phone: the audit's hairline-per-item treatment turned a
 * five item list into ten horizontal lines on a 390px screen and made the list
 * harder to scan, not easier.
 *
 * The qualifier sits on the same baseline as the label at desktop widths and
 * wraps beneath it on a phone. It is never truncated: "Recommended, not
 * required" is a meaningful distinction and half of it is worse than none.
 */
function Requirement({ req }: { req: DocumentRequirement }) {
  const note = req.is_mandatory
    ? req.is_permit_bearing
      ? "Used for your permit"
      : null
    : "Recommended, not required";

  return (
    <li>
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-2">
        <h3 className="type-title-2 text-tone-strong">{req.label}</h3>
        {note && (
          <span className="type-meta inline-flex items-center rounded-pill px-3 py-1 text-tone-body shadow-[0_0_0_1px_var(--glass-ring)]">
            {note}
          </span>
        )}
      </div>
      {req.description && (
        <p className="type-body measure-card mt-3 text-tone-body">{req.description}</p>
      )}
    </li>
  );
}

export default async function PlanPage({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const checklist = await api.permitChecklist(locale as Locale);

  const mandatory = checklist?.requirements.filter((r) => r.is_mandatory) ?? [];
  const recommended = checklist?.requirements.filter((r) => !r.is_mandatory) ?? [];
  /*
    Doc 03: the recommended item is not a second list with its own heading. It is
    the same kind of thing, carried for a different reason, so it is the same row
    with a different qualifier. One item under its own `h3` read as an oversight.
  */
  const requirements = [...mandatory, ...recommended];

  return (
    // `register-dark` on the element that also carries the fixed-nav clearance,
    // so the strip above the first band is midnight rather than a bar of body
    // colour above a navy section.
    <main id="main" data-lead-band className="register-dark flex-1">
      {/* ------------------------------------------------------------------ */}
      {/* The opening. Type led, because the first thing this page owes an     */}
      {/* anxious reader is the size of the task, not a photograph.           */}
      {/* ------------------------------------------------------------------ */}
      <Band register="dark" lead glow grain>
        <Content>
          <h1 className="type-display glow-display max-w-[16ch] text-tone-strong">
            Plan your journey
          </h1>

          <div className="mt-[var(--stack-title)] flex flex-col gap-[var(--stack-block)] lg:flex-row lg:items-end lg:justify-between lg:gap-16">
            <p className="type-lead text-tone-body">
              Adi Kailash sits inside an inner-line area. The paperwork is real, and a
              missing document at Dharchula ends the journey there. Here is what to
              bring, and what we do with it.
            </p>

            {/*
              The one measured number on the page, and it is read from the
              checklist rather than written down here: an empty list renders no
              figure at all instead of a confident count of nothing.
            */}
            {requirements.length > 0 && (
              <p className="flex shrink-0 items-baseline gap-4 lg:gap-5">
                <span className="type-figure text-tone-strong">
                  {requirements.length}
                </span>
                <span className="type-meta block max-w-[19ch] text-tone-muted">
                  {requirements.length === 1 ? "item" : "items"} on the permit
                  checklist our operations team holds today
                </span>
              </p>
            )}
          </div>
        </Content>
      </Band>

      {/* ------------------------------------------------------------------ */}
      {/* Documents. The reference material, and the longest band, which is    */}
      {/* why the rail lives here.                                            */}
      {/* ------------------------------------------------------------------ */}
      {/*
        Hand written rather than `<Band>` for one reason: `Band` sets
        `overflow: hidden` so the bloom's negative inset cannot leak a horizontal
        scrollbar, and an `overflow: hidden` ancestor makes itself the scrollport
        for any `position: sticky` descendant. Inside a `Band`, the contents rail
        simply never sticks. Everything else here is the same contract: the
        register class, the mark the nav pill reads, and `.band` for the rhythm.
      */}
      <section
        id="documents"
        data-register-mark="light"
        className="register-light band relative isolate"
      >
        <Grain opacity={0.34} />
        <Content>
          <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_13rem] lg:gap-[clamp(2.5rem,6vw,5rem)]">
            <div className="min-w-0">
              <h2 className="type-title-1 text-tone-strong">Documents you will need</h2>

              {/*
                Doc 03: "Do not imply that completing the website checklist
                guarantees permit approval." It used to sit in a tinted box with a
                16px radius, which is the shape every generated interface uses for
                the thing nobody reads. It is now the section's own standfirst, at
                lead size, because it is the most important sentence here.
              */}
              {checklist && (
                <>
                  <p className="type-lead mt-[var(--stack-title)] text-tone-strong">
                    Carrying every item below does not guarantee a permit.
                  </p>
                  <p className="type-body mt-4 text-tone-body">
                    Permits are issued by the authorities, not by us, and they can pause
                    issuance at any time. We submit your paperwork and tell you the
                    outcome as soon as we have it.
                  </p>
                </>
              )}

              {checklist === null ? (
                <EmptyState
                  className="mt-[var(--stack-block)]"
                  seed="permit-checklist"
                  title="The document list is not loading"
                  body="This list is held by our operations system and we cannot reach it right now. Nothing about your paperwork has changed. Ask the team and a coordinator will read you the current list."
                  action={<QuietAction href="/enquire">Ask a coordinator</QuietAction>}
                />
              ) : (
                <ul className="mt-[var(--stack-block)] flex flex-col gap-[var(--space-xl)]">
                  {requirements.map((req) => (
                    <Requirement key={req.id} req={req} />
                  ))}
                </ul>
              )}
            </div>

            {/*
              `ContentsRail` sticks at `top-28`, which is the 7rem the floating
              pill needs but not the staging notice above it: `--chrome-top` is
              measured at runtime and the rail does not read it, so on this build
              the list parks underneath the pill. Overridden here to match
              `scroll-padding-block-start` in `globals.css`, which is
              `--chrome-top + 7rem`. This belongs in the component.
            */}
            <ContentsRail
              items={[...SECTIONS]}
              className="top-[calc(var(--chrome-top)_+_7rem)]"
            />
          </div>
        </Content>

        {/*
          The checkpost, closing the documents section by running the full width
          of the viewport and dissolving into the snow ground beneath it.

          It is **not graded**. Every other photograph on the site can have its
          hue pulled toward navy; this one shows what the barrier actually looks
          like, and stylising the evidence is the one thing a site whose argument
          is "we tell you the truth about this road" cannot do.

          It runs the full width of the viewport rather than popping out of one
          side. A picture that escapes the column by the 32px gutter reads as a
          misalignment; a picture with no side edges at all reads as ground.

          Height is set here rather than by aspect ratio so the mask ramp clears
          the floor at both ends: `mask-b-from-45%` is a 55% ramp, which is 202px
          at the 368px minimum and 238px at the 432px maximum. Under about 120px
          a feather stops reading as mist and starts reading as a smudge.
        */}
        <BleedGrid className="mt-[var(--stack-block)]">
          <figure className="full">
            <div className="relative h-[clamp(23rem,32vw,27rem)]">
              <Scene
                name="permits"
                fill
                feather="bottom"
                radius="none"
                /* `sizes` describes the box, and `object-cover` renders wider
                   than its box: at 390 the 3:2 source has to overflow a 1.06:1
                   box by 1.4x before it can cover it. Desktop needs no factor,
                   because the box is already wider than the picture. */
                sizes="(min-width: 1024px) 100vw, calc(100vw * 1.4)"
                /* The largest thing above the fold on this page, so it is the LCP. */
                priority
              />
              {/*
                The top edge, handled the same way /guides handles its own
                full-bleed checkpost rather than a second way. `feather="bottom"`
                only ramps the foot, so the head of a full-width picture was a hard
                horizontal rule drawn straight across a cream page: the picture read
                as a strip pasted on rather than as ground. `.scrim-top` reaches the
                section's own colour at the first pixel and is gone by three
                quarters of its height, so the upper edge is not softened, it is
                never drawn.
              */}
              <div
                aria-hidden
                className="scrim-top pointer-events-none absolute inset-x-0 top-0 h-2/5"
              />
            </div>
            {/* The picture is full bleed, so the caption needs the content column
                put back around it or it sets against the viewport edge. */}
            <figcaption className="mx-auto mt-5 w-full max-w-[75rem] px-[var(--gutter)]">
              <span className="type-meta measure-meta block text-tone-muted">
                An inner line check is a barrier, a hut and someone reading your papers.
                Everything above is what they read.
              </span>
            </figcaption>
          </figure>
        </BleedGrid>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Handling. Dark, because this is what we verify about ourselves.      */}
      {/* ------------------------------------------------------------------ */}
      <Band register="dark" id="handling" grain>
        <Content>
          <h2 className="type-title-1 text-tone-strong">
            How your documents are handled
          </h2>

          <div className="mt-[var(--stack-block)] lg:grid lg:grid-cols-12 lg:gap-[clamp(2.5rem,5vw,4rem)]">
            <div className="flex flex-col gap-[var(--space-md)] lg:col-span-7">
              <p className="type-body text-tone-body">
                Once you have reserved, we send you a private link to upload each
                document. Files go straight into encrypted storage. They are never
                posted to a public address, and the link expires.
              </p>
              <p className="type-body text-tone-body">
                Uploading is not approval. A named member of our team reviews every file
                and either accepts it or tells you exactly what needs correcting. You
                will always see which state each document is in rather than wondering.
              </p>
              <p className="type-body text-tone-body">
                Only staff who need to review documents can open them, and every time
                one is opened we record who did it. We keep them no longer than the
                permit process and our records require.
              </p>
            </div>

            {/*
              The one panel on the page, and it earns it: this is the sentence that
              protects someone from being defrauded by a person imitating us, and it
              was previously the fourth paragraph in a run of four.
            */}
            <Surface className="mt-[var(--space-xl)] p-6 sm:p-8 lg:col-span-5 lg:mt-0">
              <h3 className="type-title-2 text-tone-strong">
                We will never ask for these over chat
              </h3>
              <p className="type-body mt-4 text-tone-body">
                Please do not send identity documents over ordinary chat or email. The
                upload link we send you is the only place we ask for them. If anyone
                asks you for them anywhere else, it is not us.
              </p>
            </Surface>
          </div>
        </Content>
      </Band>

      {/* ------------------------------------------------------------------ */}
      {/* Altitude. Light, and the standfirst sits in the margin.              */}
      {/* ------------------------------------------------------------------ */}
      <Band register="light" id="altitude" grain>
        <Content>
          <h2 className="type-title-1 text-tone-strong">Altitude and your health</h2>

          <div className="mt-[var(--stack-block)] lg:grid lg:grid-cols-12 lg:gap-[clamp(2.5rem,5vw,4rem)]">
            {/*
              A standfirst in the margin rather than a pull quote with a rule down
              its side. The rule is banned and it was doing nothing here anyway:
              the sentence is already the hardest thing on the page to say.
            */}
            <p className="type-lead text-tone-strong lg:col-span-4 lg:pt-1">
              We are not medically qualified, and we will not pretend otherwise.
            </p>

            {/*
              The margin column stays empty below the standfirst, and that is the
              decision rather than the omission. Every photograph available to this
              page is a mountain at dawn, and a beautiful mountain next to the
              sentence "we cannot tell you whether this is safe for you" argues
              against the sentence. The one photograph on the page is the checkpost,
              which is evidence, and it is above.
            */}

            <div className="mt-[var(--space-lg)] flex flex-col gap-[var(--space-md)] lg:col-span-7 lg:col-start-6 lg:mt-0">
              <p className="type-body text-tone-body">
                This journey crosses ground high enough for altitude sickness to be a
                genuine risk, on roads that are long and rough. That is true regardless
                of how fit you are.
              </p>
              <p className="type-body text-tone-body">
                We cannot tell you whether this journey is safe for you, for your
                parents, or for anyone travelling with you. Please talk to a doctor who
                knows your history before you commit.
              </p>
              <p className="type-body text-tone-body">
                What we can do is tell you honestly what each day demands, build in time
                to acclimatise, and slow a journey down when a group needs it. Ask us
                and we will describe the hardest day plainly.
              </p>
            </div>
          </div>
        </Content>
      </Band>

      {/* ------------------------------------------------------------------ */}
      {/* The one gold action on the page.                                     */}
      {/* ------------------------------------------------------------------ */}
      <Band register="dark" id="talk" tight glow grain>
        <Content>
          <h2 className="type-title-1 max-w-[18ch] text-tone-strong">
            Talk to someone who has driven this road
          </h2>
          <p className="type-body mt-[var(--stack-title)] text-tone-body">
            Before you book anything, ask us the question you are actually worried
            about. We will answer it plainly, including when the answer is that we do
            not know yet.
          </p>
          <div className="mt-[var(--space-lg)] flex flex-wrap gap-[var(--space-sm)]">
            <PrimaryAction href="/enquire">Speak to a Journey Guide</PrimaryAction>
            <QuietAction href="/guides">Read the guides first</QuietAction>
          </div>
        </Content>
      </Band>
    </main>
  );
}
