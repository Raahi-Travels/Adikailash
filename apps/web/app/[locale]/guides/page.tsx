import { setRequestLocale } from "next-intl/server";

import { ArrowRight, Stale } from "@/components/icons";
import { Link } from "@/i18n/navigation";
import { guides, type ArticleSummary, type Locale } from "@/lib/api";
import { buildMetadata } from "@/lib/brand";

/**
 * The guides index.
 *
 * Grouped by doc 07's search-intent clusters rather than by date, because a person
 * arrives here with a question and not with a curiosity about what we published last.
 * A blog reverse-chronology would bury the permit guide under a field note.
 *
 * Each entry leads with its standalone answer, so somebody who came for one fact can
 * often leave without clicking. That costs a pageview and is obviously right.
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

/** Doc 07's clusters, in the order a person meets them while planning. */
const CLUSTER_ORDER: { key: string; label: string; blurb: string }[] = [
  {
    key: "route_and_status",
    label: "The road",
    blurb: "What the route is actually like, and what changes it.",
  },
  {
    key: "preparation",
    label: "Preparation",
    blurb: "Permits, documents and what to carry.",
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
  },
  {
    key: "culture_and_tradition",
    label: "Culture and tradition",
    blurb: "The living place, not the postcard.",
  },
  { key: "field_report", label: "From the field", blurb: "Notes from recent departures." },
];

function Entry({ article }: { article: ArticleSummary }) {
  const stale = article.freshness === "stale";
  return (
    <li className="border-t border-white/12 py-6">
      <div className="flex flex-wrap items-baseline gap-x-3">
        <h3 className="font-serif text-xl leading-snug">
          <Link
            href={`/guides/${article.slug}`}
            className="transition-colors hover:text-gold"
          >
            {article.title}
          </Link>
        </h3>
        {article.is_pillar && (
          <span className="text-xs uppercase tracking-[0.12em] text-gold/80">
            Full guide
          </span>
        )}
        {/*
          Shown in the listing, not just on the page. Somebody deciding what to read
          deserves to know which of these nobody has checked lately.
        */}
        {stale && (
          <span className="flex items-center gap-1.5 text-sm text-saffron/90">
            <Stale className="size-3.5" />
            {article.freshness_label}
          </span>
        )}
      </div>
      <p className="mt-2 max-w-[68ch] text-[15px] leading-relaxed text-ink-inverse/75">
        {article.answer}
      </p>
      {article.author && (
        <p className="mt-2 text-sm text-ink-inverse/45">{article.author}</p>
      )}
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

  return (
    <main
      id="main"
      className="flex-1 bg-midnight px-4 py-16 text-ink-inverse sm:px-6 sm:py-20"
    >
      <div className="mx-auto max-w-3xl">
        <h1 className="font-serif text-4xl leading-tight sm:text-5xl">Guides</h1>
        <p className="mt-5 max-w-[62ch] text-[15px] leading-relaxed text-ink-inverse/70">
          What we know about this road. Every guide carries the name of the person who
          wrote it, the person who checked it, and the date they did. Anything past its
          re-check date says so, because a confident page about a mountain road that
          nobody has looked at since last season is worse than no page.
        </p>

        {all.length === 0 ? (
          <div className="mt-12 rounded-lg bg-himalayan px-5 py-6 ring-1 ring-white/10">
            <p className="text-[15px] leading-relaxed">
              Nothing published yet. These are written after the September field trip,
              from what the coordinators actually find, rather than assembled from
              other people&apos;s articles beforehand.
            </p>
            <Link
              href="/status"
              className="mt-4 inline-block text-sm text-gold underline-offset-4 hover:underline"
            >
              Meanwhile, the live route status is here
            </Link>
          </div>
        ) : (
          CLUSTER_ORDER.map(({ key, label, blurb }) => {
            const articles = byCluster.get(key);
            if (!articles?.length) return null;
            return (
              <section key={key} className="mt-14">
                <h2 className="font-serif text-2xl">{label}</h2>
                <p className="mt-1.5 text-sm text-ink-inverse/50">{blurb}</p>
                <ul className="mt-4">
                  {articles.map((article) => (
                    <Entry key={article.slug} article={article} />
                  ))}
                </ul>
              </section>
            );
          })
        )}

        <div className="mt-16 border-t border-white/12 pt-8">
          <Link
            href="/enquire"
            className="inline-flex items-center gap-2 text-sm text-gold"
          >
            A question none of these answers? Ask us
            <ArrowRight className="size-4" />
          </Link>
        </div>
      </div>
    </main>
  );
}
