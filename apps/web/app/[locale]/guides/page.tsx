import { setRequestLocale } from "next-intl/server";

import { ArrowRight, Stale } from "@/components/icons";
import { PrimaryAction, QuietAction } from "@/components/ui/action";
import { Band, BleedGrid, Content } from "@/components/ui/band";
import { EmptyState } from "@/components/ui/empty-state";
import { PhotoNote } from "@/components/ui/figure";
import { Scene } from "@/components/scene";
import { Link } from "@/i18n/navigation";
import { guides, type ArticleSummary, type Locale } from "@/lib/api";
import { buildMetadata } from "@/lib/brand";
import type { SceneKey } from "@/lib/imagery";

/**
 * The guides index.
 *
 * Grouped by doc 07's search-intent clusters rather than by date, because a person
 * arrives here with a question and not with a curiosity about what we published last.
 * A blog reverse-chronology would bury the permit guide under a field note.
 *
 * Each entry leads with its standalone answer, so somebody who came for one fact can
 * often leave without clicking. That costs a pageview and is obviously right.
 *
 * Two shape decisions, both from the redesign spec.
 *
 * **Clusters alternate register.** Eleven identically shaped entries under eleven
 * identical headings is a wall, and a hairline rule between them only draws the wall
 * in. The ground changing from midnight to snow is the chapter break, which is why
 * there is not a single rule on this page.
 *
 * **The provenance line is set-level, not per-entry.** Every guide currently carries
 * the same author string, and repeating "Compiled from government sources, pending
 * founder review" seven times reads as boilerplate rather than as the disclosure it
 * is. It is stated once, at the top, and each entry then carries only the thing that
 * actually varies: the date somebody last checked it. If the authors ever stop being
 * identical the page notices and puts them back on the entries.
 */

export const revalidate = 300;

export async function generateMetadata({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;
  return buildMetadata({
    title: "Guides",
    description:
      "What we know about the road to Adi Kailash and Om Parvat: permits, altitude,"
      + " accommodation and cost, each written by someone who has been and dated with"
      + " the last time it was checked.",
    path: "/guides",
    locale,
  });
}

/**
 * Doc 07's clusters, in the order a person meets them while planning.
 *
 * `note` is the one circular photograph a cluster may carry. Only subjects that
 * survive a square crop are eligible, which rules out every skyline in the set: a
 * circle beheads a mountain. They are unlabelled on purpose, because a caption on a
 * provisional photograph is where a claim about a place would be least visible and
 * most damaging.
 */
const CLUSTER_ORDER: {
  key: string;
  label: string;
  blurb: string;
  note?: SceneKey;
}[] = [
  {
    key: "route_and_status",
    label: "The road",
    blurb: "What the route is actually like, and what changes it.",
  },
  {
    key: "preparation",
    label: "Preparation",
    blurb: "Permits, documents and what to carry.",
    // The checkpost. Never graded: it is evidence of what a barrier looks like.
    note: "permits",
  },
  {
    key: "health_and_altitude",
    label: "Health and altitude",
    blurb: "What the days demand, said plainly.",
  },
  {
    key: "accommodation",
    label: "Where you sleep",
    blurb: "The rooms as they are, not as a brochure would have them.",
    note: "journeys/homestay-immersion-detail",
  },
  {
    key: "gateway_and_transport",
    label: "Getting there",
    blurb: "Kathgodam, Pithoragarh, Dharchula, and the drive between them.",
  },
  {
    key: "cost_and_tiers",
    label: "Cost",
    blurb: "What is included, what is not, and why tiers differ.",
    // Firelight on copper: the one scene in the set that carries its own light,
    // which is what a circle on a midnight ground needs.
    note: "homestay-kitchen",
  },
  {
    key: "culture_and_tradition",
    label: "Culture and tradition",
    blurb: "The living place, not the postcard.",
  },
  { key: "field_report", label: "From the field", blurb: "Notes from recent departures." },
];

function when(iso: string | null, locale: string) {
  if (!iso) return null;
  return new Intl.DateTimeFormat(locale === "hi" ? "hi-IN" : "en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  }).format(new Date(iso));
}

/**
 * One entry: a full-row link, with the date it was checked hanging in its own
 * column to the left of the reading measure.
 *
 * The hanging column is what stops a list of seven from reading as seven identical
 * blocks without needing a rule between them. A pillar guide takes the larger title
 * and the lead-size answer, so the set has a hierarchy that comes from the content
 * rather than from a badge.
 */
function Entry({
  article,
  locale,
  showAuthor,
}: {
  article: ArticleSummary;
  locale: string;
  /** Only when the set does not share one provenance line. */
  showAuthor: boolean;
}) {
  const stale = article.freshness === "stale";
  const checked = when(article.last_reviewed_at, locale);
  const lead = article.is_pillar;

  return (
    <li className="reveal">
      <Link
        href={`/guides/${article.slug}`}
        className="group block rounded-action outline-offset-8"
      >
        <div className="flex flex-col gap-x-8 gap-y-3 lg:flex-row">
          {/*
            Contrast note: the stale label is `tone-strong` and the icon carries the
            status colour. Saffron on snow measures 4.21:1, which is under the floor
            for 15px text, so the colour is on the mark and the meaning is in the
            words. Colour is never the only channel here anyway.
          */}
          <div className="type-meta flex flex-wrap items-baseline gap-x-3 gap-y-1 text-tone-body lg:w-34 lg:shrink-0 lg:flex-col lg:items-start lg:pt-3">
            <span
              className={
                stale
                  ? "inline-flex items-center gap-1.5 text-tone-strong"
                  : undefined
              }
            >
              {stale && <Stale className="size-4 shrink-0 text-status-limited" />}
              {article.freshness_label}
            </span>
            {checked && <time dateTime={article.last_reviewed_at ?? undefined}>{checked}</time>}
            {lead && <span className="text-tone-strong">Full guide</span>}
          </div>

          <div className="min-w-0 flex-1">
            <h3
              className={`${lead ? "type-title-1" : "type-title-2"} text-tone-strong decoration-1 underline-offset-8 group-hover:underline`}
            >
              {article.title}
            </h3>
            <p
              className={`${lead ? "type-lead measure-card" : "type-body"} mt-4 text-tone-body`}
            >
              {article.answer}
            </p>
            {showAuthor && article.author && (
              <p className="type-meta mt-3 text-tone-body">{article.author}</p>
            )}
            <span className="type-meta mt-5 inline-flex items-center gap-2 text-tone-strong">
              Read the guide
              <ArrowRight className="size-4 transition-transform duration-[var(--dur-base)] ease-standard group-hover:translate-x-1 motion-reduce:transition-none motion-reduce:group-hover:translate-x-0" />
            </span>
          </div>
        </div>
      </Link>
    </li>
  );
}

export default async function GuidesPage({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;
  setRequestLocale(locale);

  const all = (await guides.list(locale as Locale)) ?? [];

  const byCluster = new Map<string, ArticleSummary[]>();
  for (const article of all) {
    const bucket = byCluster.get(article.cluster);
    if (bucket) bucket.push(article);
    else byCluster.set(article.cluster, [article]);
  }

  const present = CLUSTER_ORDER.filter((c) => byCluster.get(c.key)?.length);

  // One provenance line for the set, but only when the set actually has one.
  const authors = new Set(all.map((a) => a.author).filter(Boolean));
  const sharedProvenance = authors.size === 1 ? [...authors][0] : null;

  return (
    <main id="main" data-hero-page className="flex-1">
      {/* ------------------------------------------------------------------ */}
      {/* Masthead. Runs under the floating pill, so it carries the clearance. */}
      {/* ------------------------------------------------------------------ */}
      {/* `lead`, rather than the hand-rolled clearance this used to carry: the
          masthead's ground has to start at the top of the viewport and run under
          the pill, and doing it in one place keeps this page's first heading on
          the same line as /status and /plan. */}
      <Band register="dark" lead glow grain>
        <div>
          <BleedGrid>
            <div className="lg:flex lg:items-start lg:gap-16">
              <div className="min-w-0 flex-1">
                <h1 className="type-display glow-display text-tone-strong">Guides</h1>
                <p className="type-lead mt-5 text-tone-body">
                  What we know about this road, and how we came to know it.
                </p>
                <p className="type-body mt-8 text-tone-body">
                  Every guide names the person who wrote it, the person who checked
                  it, and the date they did. Anything past its re-check date says so,
                  because a confident page about a mountain road that nobody has
                  looked at since last season is worse than no page.
                </p>
                {sharedProvenance && (
                  <p className="type-meta measure-meta mt-8 text-tone-body">
                    {sharedProvenance}. The date on each entry is the last time
                    somebody checked it.
                  </p>
                )}
              </div>

              {all.length > 0 && (
                <div className="mt-12 lg:mt-0 lg:w-56 lg:shrink-0 lg:pt-4">
                  <dl>
                    <dd className="type-figure text-tone-strong">{all.length}</dd>
                    <dt className="type-meta mt-4 max-w-[26ch] text-tone-body">
                      guides, each carrying the date somebody last checked it
                    </dt>
                  </dl>

                  {/*
                    A jump list rather than the sticky `ContentsRail`: the clusters
                    below each own a section with its own ground, so nothing can be
                    sticky across all of them. It is shown at every width, because on
                    a phone this page is long and a reader arrives with one question.
                  */}
                  <nav aria-label="Sections on this page" className="mt-10">
                    <p className="type-meta text-tone-muted">On this page</p>
                    <ul className="mt-3 flex flex-wrap gap-x-6 gap-y-2 lg:flex-col lg:gap-3">
                      {present.map((cluster) => (
                        <li key={cluster.key}>
                          <a
                            href={`#${cluster.key}`}
                            className="type-meta text-tone-body underline decoration-tone-line decoration-1 underline-offset-[0.3em] transition-colors duration-[var(--dur-fast)] hover:text-tone-strong hover:decoration-current"
                          >
                            {cluster.label}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </nav>
                </div>
              )}
            </div>

            {/*
              The one photograph on this page, running the full width of the
              viewport so that neither side edge is ever on screen.

              Bottom: `feather="bottom"` gives the mask and the scrim together,
              which is the sanctioned pair. Top: `.scrim-top` reaches full midnight
              at the first pixel and is gone by three quarters of its height, so the
              upper edge is not softened, it is simply never drawn. A radial
              vignette was tried first and cannot work on a box this wide: the
              default farthest-corner radius puts the top edge at about 35% of the
              radius, inside the opaque stop, and it left a hard line straight
              across the page.

              Not graded. This is the checkpost, which is evidence of what the
              barrier looks like, and stylising evidence is the one thing this site
              cannot do.
            */}
            <div className="full relative mt-14 h-80 w-full sm:h-[26rem] lg:mt-16 lg:h-[40rem]">
              <Scene
                name="permits"
                fill
                feather="bottom"
                sizes="calc(100vw * 1.35)"
                priority
              />
              <div
                aria-hidden
                className="scrim-top pointer-events-none absolute inset-x-0 top-0 h-2/5"
              />
            </div>
          </BleedGrid>
        </div>
      </Band>

      {all.length === 0 ? (
        <Band register="light" grain>
          <Content>
            <EmptyState
              seed="guides-index"
              title="Nothing published here yet"
              body="These are written after the September field trip, from what the coordinators actually find on the road, rather than assembled from other people's articles beforehand. There is no publication date to give you, because the trip has to happen first."
              action={
                <QuietAction href="/status">
                  Meanwhile, the live route status
                </QuietAction>
              }
              className="max-w-[46rem]"
            />
          </Content>
        </Band>
      ) : (
        present.map((cluster, index) => {
          const articles = byCluster.get(cluster.key) ?? [];
          const register = index % 2 === 0 ? "light" : "dark";
          const noteRight = index % 2 === 0;

          return (
            <Band
              key={cluster.key}
              id={cluster.key}
              register={register}
              grain
              glow={register === "dark"}
            >
              <Content>
                {/*
                  A hanging section header rather than a full-width one: the label
                  and its one line of scope keep their own column, the entries keep
                  theirs, and the page reads as a reference rather than as a stack.
                  The circle, where a cluster has one, sits under the label and is
                  the only thing that moves between sections.
                */}
                <div className="lg:grid lg:grid-cols-12 lg:gap-x-16">
                  {/*
                    Sticky within its own band, which is the whole reason the header
                    has a column of its own: the label and its scope stay beside the
                    entries you are reading and leave with the section. A rail that
                    tried to span the page could not exist here, because each cluster
                    is its own section with its own ground.
                  */}
                  <header className="lg:sticky lg:top-28 lg:col-span-4 lg:self-start">
                    <h2 className="type-title-1 text-tone-strong">{cluster.label}</h2>
                    <p className="type-lead mt-5 text-tone-body">{cluster.blurb}</p>

                    {cluster.note && (
                      <div
                        className={`mt-12 flex lg:mt-16 ${
                          noteRight ? "lg:ml-8" : "lg:ml-0"
                        }`}
                      >
                        {/*
                          Graded on snow, never on midnight: the grade pulls the hue
                          toward navy, which on a navy ground turns the circle into a
                          hole. And never on the checkpost, which is evidence.
                        */}
                        <PhotoNote
                          name={cluster.note}
                          grade={register === "light" && cluster.note !== "permits"}
                          sizes="(min-width: 1024px) 340px, 60vw"
                        />
                      </div>
                    )}
                  </header>

                  <ul className="mt-12 flex flex-col gap-12 lg:col-span-8 lg:mt-0 lg:gap-18">
                    {articles.map((article) => (
                      <Entry
                        key={article.slug}
                        article={article}
                        locale={locale}
                        showAuthor={!sharedProvenance}
                      />
                    ))}
                  </ul>
                </div>
              </Content>
            </Band>
          );
        })
      )}

      {/* ------------------------------------------------------------------ */}
      <Band register="light" grain tight>
        <Content>
          <div className="max-w-[46rem]">
            <h2 className="type-title-1 text-tone-strong">
              A question none of these answers?
            </h2>
            <p className="type-body mt-5 text-tone-body">
              Ask it and a coordinator will answer it, and if the answer turns out to
              be useful to other people it becomes one of these.
            </p>
            {/* The page's one gold fill, at the bottom, where the decision is. */}
            <PrimaryAction href="/enquire" className="mt-10">
              Ask us
            </PrimaryAction>
          </div>
        </Content>
      </Band>
    </main>
  );
}
