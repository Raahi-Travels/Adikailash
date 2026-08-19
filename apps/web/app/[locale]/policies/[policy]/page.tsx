import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";

import { Grain } from "@/components/backgrounds";
import { ArrowRight, Caution } from "@/components/icons";
import { Content } from "@/components/ui/band";
import { ContentsRail } from "@/components/ui/contents-rail";
import { Surface } from "@/components/ui/surface";
import { Link } from "@/i18n/navigation";
import { buildMetadata } from "@/lib/brand";
import { POLICIES, POLICY_ORDER, type PolicySlug } from "@/lib/policies";

/**
 * A single policy.
 *
 * **This is the site's one deliberately plain surface, and the plainness is the
 * design rather than an omission.** No photograph, no glass, no bloom, no card
 * around the prose. One reading column at 72ch, a contents rail filling the dead
 * right-hand column, and type doing all of the work. Anyone who reaches this page
 * is reading top to bottom, and every ornament between them and the sentence is a
 * cost.
 *
 * Two things are deliberately loud rather than tucked away: the draft banner while
 * a policy is unreviewed, and any clause that depends on a decision we have not
 * made. Doc 06's failure mode is "a website that implies guarantees the business
 * cannot control", and a confident-looking policy with a quietly missing clause is
 * exactly that. So `pending` gets a filled block in the unverified status tone, not
 * the side stripe it used to have.
 *
 * The section wrapper is a hand-rolled `.band` rather than `<Band>` on purpose:
 * `<Band>` is `overflow-hidden` for its bloom layer, and an `overflow-hidden`
 * ancestor becomes the scrollport a `position: sticky` child resolves against, so
 * the contents rail silently stops sticking. This page has no bloom, so it does not
 * need the clip.
 */

export function generateStaticParams() {
  return POLICY_ORDER.map((policy) => ({ policy }));
}

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/policies/[policy]">) {
  const { policy } = await params;
  const found = POLICIES[policy as PolicySlug];
  if (!found) return {};
  return buildMetadata({
    title: found.title,
    description: found.summary,
    path: `/policies/${found.slug}`,
  });
}

/** Reads the count from the data rather than hardcoding "the other three". */
function othersHeading(count: number) {
  if (count === 2) return "The other two";
  if (count === 3) return "The other three";
  return "The other policies";
}

/** Stable, ASCII, and derived from the heading, so the rail and the anchors cannot drift apart. */
function anchorId(heading: string) {
  return heading
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export default async function PolicyPage({
  params,
}: PageProps<"/[locale]/policies/[policy]">) {
  const { locale, policy } = await params;
  setRequestLocale(locale);

  const doc = POLICIES[policy as PolicySlug];
  if (!doc) notFound();

  const others = POLICY_ORDER.filter((s) => s !== doc.slug);

  return (
    <main
      id="main"
      className="flex-1 register-light"
      data-register-mark="light"
    >
      <section
        data-register-mark="light"
        className="register-light relative isolate pb-[var(--band-y)] pt-[var(--band-y-tight)]"
      >
        <Grain opacity={0.34} />

        <Content>
          <div className="grid gap-[var(--space-2xl)] lg:grid-cols-[minmax(0,1fr)_15rem]">
            <div className="min-w-0">
              <Link
                href="/policies"
                className="type-meta group inline-flex items-center gap-2 text-tone-body transition-colors duration-[var(--dur-fast)] hover:text-tone-strong"
              >
                <ArrowRight
                  aria-hidden
                  className="size-4 shrink-0 rotate-180 transition-transform duration-[var(--dur-base)] ease-out-soft group-hover:-translate-x-1 motion-reduce:transition-none motion-reduce:group-hover:translate-x-0"
                />
                All policies
              </Link>

              <h1 className="type-title-1 mt-[var(--space-md)] text-tone-strong">
                {doc.title}
              </h1>
              <p className="type-lead mt-[var(--stack-title)] text-tone-body">
                {doc.summary}
              </p>

              {/* The standfirst. No panel: a box around one sentence at the top of
                  a legal document reads as a disclaimer, and this is the opposite,
                  it is the answer most people came for. */}
              <div className="mt-[var(--space-xl)]">
                <p className="type-meta text-tone-muted">In short</p>
                <p className="type-lead measure-body mt-[var(--space-2xs)] text-tone-strong">
                  {doc.inShort}
                </p>
              </div>

              {!doc.reviewed && (
                <Surface className="mt-[var(--space-xl)] flex gap-4 p-[var(--space-md)] sm:p-[var(--space-lg)]">
                  <Caution
                    aria-hidden
                    className="mt-[0.2em] size-5 shrink-0 text-status-limited"
                  />
                  <div className="min-w-0">
                    <p className="type-lead font-semibold text-tone-strong">
                      This is a working draft
                    </p>
                    <p className="type-body mt-[var(--space-xs)] text-tone-body">
                      It has not yet been reviewed by a lawyer, and we are not
                      taking payments on this website until it has been. We are
                      publishing it early because you should be able to read our
                      terms before you talk to us, not after.
                    </p>
                  </div>
                </Surface>
              )}

              {/*
                Hindi legal text is a real translation job, not a switch. Doc 05: Hindi
                must not be "a machine-translated afterthought". Until it is done
                properly, say so.
              */}
              {locale === "hi" && (
                <p className="type-body mt-[var(--space-md)] rounded-action bg-ink/[0.04] px-5 py-4 text-tone-body">
                  यह नीति अभी केवल अंग्रेज़ी में उपलब्ध है। हिंदी अनुवाद तैयार
                  किया जा रहा है। किसी भी बिंदु पर संदेह हो तो हमें फ़ोन करें,
                  हम हिंदी में समझा देंगे।
                </p>
              )}

              <div className="mt-[var(--space-2xl)] flex flex-col gap-[var(--space-2xl)]">
                {doc.sections.map((section) => (
                  <section key={section.heading} id={anchorId(section.heading)}>
                    <h2 className="type-title-2 text-tone-strong">
                      {section.heading}
                    </h2>

                    <div className="mt-[var(--space-sm)] flex flex-col gap-[var(--space-md)]">
                      {section.body.map((para) => (
                        <p
                          key={para.slice(0, 40)}
                          className="type-body text-tone-body"
                        >
                          {para}
                        </p>
                      ))}
                    </div>

                    {section.points && (
                      <ul className="mt-[var(--space-md)] flex flex-col gap-[var(--space-sm)]">
                        {section.points.map((point) => (
                          <li
                            key={point.slice(0, 40)}
                            className="type-body flex gap-4 text-tone-body"
                          >
                            {/* A short rule rather than a gold dot: gold is a fill for
                                the one thing worth pressing, and a bullet repeated
                                forty times down a legal page is gold as paint. */}
                            <span
                              aria-hidden
                              className="mt-[0.85em] h-px w-4 shrink-0 bg-tone-muted"
                            />
                            <span className="min-w-0">{point}</span>
                          </li>
                        ))}
                      </ul>
                    )}

                    {section.pending && (
                      <div className="mt-[var(--space-md)] rounded-action bg-status-unverified/12 px-5 py-4">
                        <p className="type-meta flex items-center gap-2 text-tone-strong">
                          <span
                            aria-hidden
                            className="size-2 shrink-0 rounded-pill bg-status-unverified"
                          />
                          Not settled yet
                        </p>
                        <p className="type-body mt-[var(--space-2xs)] text-tone-body">
                          {section.pending}
                        </p>
                      </div>
                    )}
                  </section>
                ))}
              </div>

              <nav
                className="mt-[var(--space-2xl)]"
                aria-label="Other policies"
              >
                <h2 className="type-title-2 text-tone-strong">
                  {othersHeading(others.length)}
                </h2>
                <ul className="mt-[var(--space-md)] flex flex-col">
                  {others.map((slug) => (
                    <li key={slug}>
                      <Link
                        href={`/policies/${slug}`}
                        className="group -mx-[var(--space-sm)] flex flex-wrap items-baseline gap-x-3 gap-y-1 rounded-action px-[var(--space-sm)] py-[var(--space-sm)] transition-colors duration-[var(--dur-fast)] hover:bg-ink/[0.04]"
                      >
                        <span className="type-lead text-tone-strong">
                          {POLICIES[slug].title}
                          <ArrowRight
                            aria-hidden
                            className="ml-2 inline-block size-[0.7em] shrink-0 text-tone-body transition-transform duration-[var(--dur-base)] ease-out-soft group-hover:translate-x-1 motion-reduce:transition-none motion-reduce:group-hover:translate-x-0"
                          />
                        </span>
                        <span className="type-meta text-tone-muted">
                          {POLICIES[slug].reviewed
                            ? "Reviewed"
                            : "Working draft"}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            </div>

            <ContentsRail
              label="In this policy"
              items={doc.sections.map((s) => ({
                id: anchorId(s.heading),
                label: s.heading,
              }))}
            />
          </div>
        </Content>
      </section>
    </main>
  );
}
