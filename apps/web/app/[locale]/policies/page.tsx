import { setRequestLocale } from "next-intl/server";

import { Grain } from "@/components/backgrounds";
import { ArrowRight } from "@/components/icons";
import { Band, Content } from "@/components/ui/band";
import { QuietAction } from "@/components/ui/action";
import { Link } from "@/i18n/navigation";
import { buildMetadata } from "@/lib/brand";
import { POLICIES, POLICY_ORDER } from "@/lib/policies";

/**
 * Index of the policy pages.
 *
 * Each entry leads with `inShort` rather than the title alone, so someone who came
 * here for one specific answer ("what happens if the road closes") can often stop
 * reading at this page.
 *
 * The design decision here is that **the row is the target**. The audit found an
 * arrow at 1.89:1 parked 200px away from the title it belonged to, which meant the
 * only obviously clickable thing on the page was almost invisible and nowhere near
 * the words. Now the title carries the affordance, the chevron sits immediately
 * after the words at body tone, and the whole row lifts on hover.
 *
 * The draft state is the most important fact on this page, so it is a status badge
 * rather than a whisper: colour first as a dot, the word second, both at the
 * fifteen-pixel floor.
 */

/**
 * `generateMetadata` rather than a static export, purely so the canonical can
 * carry the locale. A canonical that guessed the locale would point half the
 * site at the wrong URL.
 */
export async function generateMetadata({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;
  return buildMetadata({
    title: "Policies",
    description:
      "Terms of service, cancellation and refunds, privacy, and the consent we ask for. Written to be read before you book.",
    path: "/policies",
    locale,
  });
}

export default async function PoliciesPage({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;
  setRequestLocale(locale);

  const drafts = POLICY_ORDER.filter((slug) => !POLICIES[slug].reviewed).length;

  return (
    <main
      id="main"
      className="flex-1 register-light"
      data-register-mark="light"
      data-lead-band
    >
      <Band register="light" lead grain>
        <Content>
          <div className="grid gap-[var(--stack-block)] lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)] lg:gap-[var(--space-2xl)]">
            {/* Not sticky: `<Band>` is `overflow-hidden`, which makes it the
                scrollport a sticky child resolves against, and the column then
                sits 112px lower than its own row for no visible reason. */}
            <div className="lg:self-start">
              <h1 className="type-title-1 text-tone-strong">Policies</h1>
              <p className="type-lead mt-[var(--stack-title)] text-tone-body">
                Written to be read before you book rather than quoted back at
                you afterwards.
              </p>
              <p className="type-body mt-[var(--space-md)] text-tone-body">
                Where something is genuinely not decided yet, it says so instead
                of sounding decided. {draftLine(drafts, POLICY_ORDER.length)}
              </p>
            </div>

            <ul className="flex flex-col lg:-mt-8">
              {POLICY_ORDER.map((slug) => {
                const doc = POLICIES[slug];
                return (
                  <li key={slug}>
                    <Link
                      href={`/policies/${slug}`}
                      className="group -mx-[var(--space-md)] block rounded-action px-[var(--space-md)] py-[var(--space-lg)] transition-colors duration-[var(--dur-fast)] ease-standard hover:bg-ink/[0.04]"
                    >
                      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-2">
                        <h2 className="type-title-2 text-tone-strong">
                          {doc.title}
                          {/* Immediately after the words, at body tone. The
                              affordance is the title; this only points. */}
                          <ArrowRight
                            aria-hidden
                            className="ml-3 inline-block size-[0.62em] shrink-0 text-tone-body transition-transform duration-[var(--dur-base)] ease-out-soft group-hover:translate-x-1 motion-reduce:transition-none motion-reduce:group-hover:translate-x-0"
                          />
                        </h2>
                        {!doc.reviewed && <DraftBadge />}
                      </div>
                      <p className="type-body measure-card mt-[var(--space-sm)] text-tone-body">
                        {doc.inShort}
                      </p>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        </Content>
      </Band>

      {/*
        The register change is the divider. There is no rule under the list.

        Hand-rolled rather than `<Band>` for one reason: the footer below is also
        `register-dark`, and two consecutive dark bands at the same value read as
        one navy slab with the closing note lost inside it. The separation is
        himalayan mixed into midnight at 14%, which is the spec's answer, and not
        a hairline.
      */}
      <section
        data-register-mark="dark"
        className="register-dark band--tight relative isolate"
        style={{
          backgroundColor:
            "color-mix(in oklab, var(--color-himalayan) 14%, var(--color-midnight))",
        }}
      >
        <Grain opacity={0.45} />
        <Content>
          <div className="flex flex-col gap-[var(--space-lg)] lg:flex-row lg:items-end lg:justify-between">
            <p className="type-lead text-tone-body">
              If anything here is unclear, ask us before you book rather than
              after. A policy you had to interpret is a policy we wrote badly,
              and we would like to know which sentence did it.
            </p>
            <QuietAction href="/enquire" className="shrink-0 self-start lg:self-auto">
              Ask us about a clause
            </QuietAction>
          </div>
        </Content>
      </section>
    </main>
  );
}

/**
 * The draft state, as colour plus a word.
 *
 * Not colour alone, and not colour as the readable part: `--color-status-unverified`
 * measures 4.34:1 on snow, which is under the floor for a fifteen-pixel label. So
 * the dot carries the status colour (a non-text element, 3:1) and the word carries
 * body tone (well over 4.5:1). Never gold: gold is a fill for the one thing worth
 * pressing, not a status.
 */
function DraftBadge() {
  return (
    <span className="type-meta inline-flex items-center gap-2 rounded-pill bg-status-unverified/12 px-3 py-1 text-tone-body">
      <span
        aria-hidden
        className="size-2 shrink-0 rounded-pill bg-status-unverified"
      />
      Working draft
    </span>
  );
}

/** Reads from the data, so a reviewed policy changes the sentence rather than leaving it lying. */
function draftLine(drafts: number, total: number) {
  if (drafts === 0) return "All of these have been reviewed.";
  if (drafts === total)
    return "All of them are working drafts until a lawyer has read them, and each one says so at the top.";
  return `${drafts} of the ${total} are still working drafts, and each of those says so at the top.`;
}
