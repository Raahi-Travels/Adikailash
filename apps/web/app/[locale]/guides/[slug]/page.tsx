import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";

import { ArrowRight, Caution, Stale } from "@/components/icons";
import { BreadcrumbLd, FaqLd } from "@/components/structured-data";
import { PrimaryAction } from "@/components/ui/action";
import { Band, BleedGrid, Content } from "@/components/ui/band";
import { Scene } from "@/components/scene";
import { Surface } from "@/components/ui/surface";
import { Link } from "@/i18n/navigation";
import { guides, type ArticleSummary, type Locale } from "@/lib/api";
import { buildMetadata } from "@/lib/brand";
import type { SceneKey } from "@/lib/imagery";

/**
 * One guide.
 *
 * The page follows doc 07's AEO content pattern in its order: direct answer near the
 * top, a last-reviewed time where freshness matters, a named reviewer, and FAQ from
 * actual conversations.
 *
 * The answer block is first and set at lead size because it is the passage an answer
 * engine extracts and the paragraph a hurried reader needs. Burying it below a
 * scene-setting introduction is the single most common way a guide fails at both
 * jobs at once. It no longer wears a gold rule down its left edge: a side-stripe
 * blockquote is banned site-wide, and the answer earns its prominence from size and
 * position rather than from a bar.
 *
 * **The record rail is the honesty mechanism made visible.** Who wrote it, who
 * checked it, when, and when it is next due, in the column beside the prose and
 * pinned there while you read. It also stands in for the contents rail the spec asks
 * for on this page: the body arrives from the API as plain paragraphs with no
 * headings, so a table of contents would have exactly one entry to list.
 *
 * The stale banner is the loud counterpart, and it only appears when it is true. A
 * guide past its re-check commitment says so above the content rather than in a
 * footer, because a stale road-conditions page is not merely old: it can put
 * somebody on a closed road.
 */

export const revalidate = 300;

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/guides/[slug]">) {
  const { locale, slug } = await params;
  const article = await guides.detail(slug, locale as Locale);
  if (!article) return {};

  return buildMetadata({
    title: article.title,
    // The standalone answer doubles as the meta description: it is already written
    // to stand alone, which is exactly what a description has to do.
    description: article.answer.slice(0, 300),
    path: `/guides/${slug}`,
    locale,
  });
}

const CLUSTER_LABEL: Record<string, string> = {
  route_and_status: "Route and status",
  preparation: "Preparation",
  cost_and_tiers: "Cost and tiers",
  accommodation: "Accommodation",
  gateway_and_transport: "Getting there",
  health_and_altitude: "Health and altitude",
  culture_and_tradition: "Culture and tradition",
  field_report: "Field report",
};

/**
 * The one figure a guide may carry, and only where the subject is a real one.
 *
 * A cluster with no natural illustration gets none rather than a decorative
 * mountain: a photograph that illustrates nothing is worse than white space, and on
 * this site it is also a claim nobody made. `permits` is never graded, because the
 * checkpost is evidence.
 */
const CLUSTER_FIGURE: Record<string, SceneKey> = {
  route_and_status: "journeys/adi-kailash-om-parvat",
  preparation: "permits",
  accommodation: "homestay-kitchen",
  gateway_and_transport: "departures",
  health_and_altitude: "journeys/adi-kailash-om-parvat-detail",
  culture_and_tradition: "journeys/kumaon-spiritual-circuit",
};

function when(iso: string | null, locale: string) {
  if (!iso) return null;
  return new Intl.DateTimeFormat(locale === "hi" ? "hi-IN" : "en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  }).format(new Date(iso));
}

/** One line of the record rail. Absent values are not rendered as "unknown". */
function Record({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mt-6 first:mt-0">
      <dt className="type-meta text-tone-body">{label}</dt>
      <dd className="type-meta mt-1 text-tone-strong">{children}</dd>
    </div>
  );
}

/** A related guide: the same full-row link shape the index uses. */
function RelatedRow({
  article,
  locale,
}: {
  article: ArticleSummary;
  locale: string;
}) {
  const checked = when(article.last_reviewed_at, locale);
  return (
    <li>
      <Link
        href={`/guides/${article.slug}`}
        className="group block rounded-action outline-offset-8"
      >
        <div className="flex flex-col gap-x-8 gap-y-2 lg:flex-row">
          <p className="type-meta text-tone-body lg:w-34 lg:shrink-0 lg:pt-2">
            {checked}
          </p>
          <div className="min-w-0 flex-1">
            <h3 className="type-title-2 text-tone-strong decoration-1 underline-offset-8 group-hover:underline">
              {article.title}
            </h3>
            <p className="type-body mt-3 text-tone-body">{article.answer}</p>
          </div>
        </div>
      </Link>
    </li>
  );
}

export default async function GuidePage({
  params,
}: PageProps<"/[locale]/guides/[slug]">) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  const article = await guides.detail(slug, locale as Locale);
  if (!article) notFound();

  const stale = article.freshness === "stale";
  const checked = when(article.last_reviewed_at, locale);
  const due = when(article.next_review_due, locale);
  const figure = CLUSTER_FIGURE[article.cluster];

  const paragraphs = article.body ? article.body.split("\n\n").filter(Boolean) : [];
  // The figure lands between two groups of paragraphs rather than at the top or the
  // foot, so it breaks the reading column instead of decorating one end of it. Only
  // worth doing when there is enough prose on both sides of it to be a break.
  const splitAt = figure && paragraphs.length >= 4 ? Math.ceil(paragraphs.length / 2) : 0;
  const opening = splitAt ? paragraphs.slice(0, splitAt) : paragraphs;
  const closing = splitAt ? paragraphs.slice(splitAt) : [];

  return (
    <>
      <FaqLd items={article.faqs} />
      <BreadcrumbLd
        locale={locale}
        trail={[
          { name: "Guides", path: "/guides" },
          { name: article.title, path: `/guides/${slug}` },
        ]}
      />

      <main id="main" data-hero-page className="flex-1">
        {/* ---------------------------------------------------------------- */}
        <Band register="dark" glow grain>
          <div
            style={{
              paddingBlockStart:
                "calc(var(--chrome-top) + var(--nav-h) + var(--nav-inset))",
            }}
          >
            <Content>
              <article>
                {/* Where you are on the left, what state the page is in on the
                    right. Both at meta size, and they hold the top edge of the
                    masthead together so the title has something to hang from. */}
                <div className="flex flex-wrap items-baseline justify-between gap-x-8 gap-y-2">
                  <p className="type-meta flex flex-wrap items-center gap-x-3 gap-y-1 text-tone-body">
                    <Link
                      href="/guides"
                      className="underline decoration-tone-line decoration-1 underline-offset-4 transition-colors duration-[var(--dur-fast)] hover:text-tone-strong hover:decoration-current"
                    >
                      Guides
                    </Link>
                    <span aria-hidden>/</span>
                    <Link
                      href={`/guides#${article.cluster}`}
                      className="underline decoration-tone-line decoration-1 underline-offset-4 transition-colors duration-[var(--dur-fast)] hover:text-tone-strong hover:decoration-current"
                    >
                      {CLUSTER_LABEL[article.cluster] ?? article.cluster}
                    </Link>
                  </p>

                  <p className="type-meta text-tone-body">
                    {stale ? (
                      <span className="inline-flex items-center gap-2 text-tone-strong">
                        <Stale className="size-4 shrink-0 text-status-limited" />
                        {article.freshness_label}
                      </span>
                    ) : (
                      article.freshness_label
                    )}
                    {checked && (
                      <>
                        {" "}
                        <time dateTime={article.last_reviewed_at ?? undefined}>
                          {checked}
                        </time>
                      </>
                    )}
                  </p>
                </div>

                <h1 className="type-title-1 mt-8 max-w-[24ch] text-tone-strong">
                  {article.title}
                </h1>

                {/*
                  The standalone answer. First, and at lead size, because it is what
                  an answer engine lifts and what a hurried reader came for.
                */}
                <p className="type-lead measure-body mt-8 text-tone-strong">
                  {article.answer}
                </p>

                {stale && article.is_time_sensitive && (
                  <Surface className="mt-8 max-w-[46rem] p-6 sm:p-8">
                    <h2 className="type-title-2 text-tone-strong">
                      Treat this as background, not as current
                    </h2>
                    <p className="type-body mt-4 text-tone-body">
                      Conditions on this route change faster than a page can, and
                      nobody has re-checked this one recently. Read the live status
                      before you travel.
                    </p>
                    <p className="mt-6">
                      <Link
                        href="/status"
                        className="type-meta inline-flex items-center gap-2 text-tone-strong underline decoration-tone-line decoration-1 underline-offset-4 hover:decoration-current"
                      >
                        The live route status
                        <ArrowRight className="size-4" />
                      </Link>
                    </p>
                  </Surface>
                )}
              </article>
            </Content>
          </div>
        </Band>

        {/* ---------------------------------------------------------------- */}
        {paragraphs.length > 0 && (
          <Band register="light" grain>
            <BleedGrid>
              <div className="lg:grid lg:grid-cols-12 lg:gap-x-16">
                <div className="prose-sn lg:col-span-8">
                  {opening.map((paragraph) => (
                    <p key={paragraph.slice(0, 48)}>{paragraph}</p>
                  ))}
                </div>

                {/*
                  The record, pinned beside the prose. Everything here is read from
                  the row rather than written into the page, so a guide that has no
                  reviewer simply does not claim one.
                */}
                <aside className="mt-12 lg:sticky lg:top-28 lg:col-span-4 lg:mt-0 lg:self-start">
                  <h2 className="type-title-2 text-tone-strong">About this guide</h2>
                  <dl className="mt-6">
                    {article.author && <Record label="Written by">{article.author}</Record>}
                    {article.reviewed_by && article.reviewed_by !== article.author && (
                      <Record label="Checked by">{article.reviewed_by}</Record>
                    )}
                    {checked && (
                      <Record label="Last checked">
                        <time dateTime={article.last_reviewed_at ?? undefined}>
                          {checked}
                        </time>
                      </Record>
                    )}
                    {due && (
                      <Record label="Next check due">
                        <time dateTime={article.next_review_due ?? undefined}>{due}</time>
                      </Record>
                    )}
                  </dl>
                  {article.is_time_sensitive && (
                    <p className="type-meta mt-8 text-tone-body">
                      This one goes out of date with the road, so check the live
                      status before you travel on it.
                    </p>
                  )}
                  <p className="mt-4">
                    <Link
                      href="/status"
                      className="type-meta inline-flex items-center gap-2 text-tone-strong underline decoration-tone-line decoration-1 underline-offset-4 hover:decoration-current"
                    >
                      The live route status
                      <ArrowRight className="size-4" />
                    </Link>
                  </p>
                </aside>
              </div>

              {/*
                The figure breaks the reading column and runs to the left edge of the
                viewport, so its left edge is never on screen. The other three are
                handled deliberately, because `PhotoFigure` on the light register
                feathers the foot and nothing else, which would leave this cut square
                across the top and down the right in the middle of a cream page.

                Top: `.scrim-top`, which is snow here and reaches full opacity at the
                first pixel, so the upper edge is never drawn.
                Right: a horizontal wash in the same ground colour. Paint rather than
                a mask on purpose. A mask changes alpha, and a dark rock edge fading
                to alpha zero over cream passes through mid grey and looks like a
                thumbprint, which is why side feathering is a dark-ground technique.
                A scrim carries the picture to cream directly and never through grey.
                Foot: `feather="bottom"` gives the mask and the scrim together.
              */}
              {splitAt > 0 && figure && (
                <figure className="pop-left mt-16">
                  <div className="relative aspect-4/5 sm:aspect-4/3 md:aspect-2/1">
                    <Scene
                      name={figure}
                      fill
                      feather="bottom"
                      radius="none"
                      grade={figure !== "permits"}
                      sizes="(min-width: 1024px) 62vw, calc(100vw * 1.35)"
                    />
                    <div
                      aria-hidden
                      className="scrim-top pointer-events-none absolute inset-x-0 top-0 h-1/5 md:h-1/4"
                    />
                    <div
                      aria-hidden
                      className="pointer-events-none absolute inset-y-0 right-0 w-1/4 bg-gradient-to-l from-scrim to-transparent"
                    />
                  </div>
                </figure>
              )}

              {closing.length > 0 && (
                <div className="prose-sn mt-16">
                  {closing.map((paragraph) => (
                    <p key={paragraph.slice(0, 48)}>{paragraph}</p>
                  ))}
                </div>
              )}
            </BleedGrid>
          </Band>
        )}

        {/* ---------------------------------------------------------------- */}
        {/*
          Visible FAQ and FAQPage markup are generated from the same rows, so the two
          cannot drift. Doc 07: "structured data that matches visible content."
        */}
        {article.faqs.length > 0 && (
          <Band register="dark" glow grain id="questions">
            <Content>
              <h2 className="type-title-1 text-tone-strong">
                Questions people actually ask
              </h2>
              <dl className="mt-12 flex flex-col gap-12 lg:gap-16">
                {article.faqs.map((faq) => (
                  <div key={faq.question} className="lg:grid lg:grid-cols-12 lg:gap-x-16">
                    <dt className="type-title-2 text-tone-strong lg:col-span-5">
                      {faq.question}
                    </dt>
                    <dd className="type-body mt-4 text-tone-body lg:col-span-7 lg:mt-0">
                      {faq.answer}
                    </dd>
                  </div>
                ))}
              </dl>
            </Content>
          </Band>
        )}

        {/* ---------------------------------------------------------------- */}
        <Band register="light" grain>
          <Content>
            {article.related.length > 0 && (
              <section aria-labelledby="related">
                <h2 id="related" className="type-title-1 text-tone-strong">
                  Also worth reading
                </h2>
                <ul className="mt-12 flex flex-col gap-12 lg:gap-16">
                  {article.related.map((related) => (
                    <RelatedRow key={related.slug} article={related} locale={locale} />
                  ))}
                </ul>
              </section>
            )}

            {article.journey_slug && (
              <div className="mt-16">
                <PrimaryAction href={`/journeys/${article.journey_slug}`}>
                  See the journey this is about
                </PrimaryAction>
              </div>
            )}

            <p className="type-meta measure-meta mt-16 flex items-start gap-3 text-tone-body">
              <Caution className="mt-0.5 size-4 shrink-0" />
              <span>
                We publish what we can verify and mark what we cannot. Nothing here is
                a guarantee of access, weather or darshan.
              </span>
            </p>
          </Content>
        </Band>
      </main>
    </>
  );
}
