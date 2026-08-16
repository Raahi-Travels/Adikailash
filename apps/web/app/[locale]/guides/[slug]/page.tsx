import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";

import { Caution, Stale, Verified } from "@/components/icons";
import { BreadcrumbLd, FaqLd } from "@/components/structured-data";
import { Link } from "@/i18n/navigation";
import { guides, type Locale } from "@/lib/api";
import { buildMetadata } from "@/lib/brand";

/**
 * One guide.
 *
 * The page is laid out to doc 07's AEO content pattern, in its order: direct answer
 * near the top, headings matching real questions, a last-reviewed time where
 * freshness matters, a named reviewer, and FAQ from actual conversations.
 *
 * The answer block is first and visually distinct because it is the passage an answer
 * engine extracts and the paragraph a hurried reader needs. Burying it below a
 * scene-setting introduction is the single most common way a guide fails at both
 * jobs at once.
 *
 * The freshness banner is the honest counterpart. A guide past its re-check
 * commitment says so, above the content rather than in a footer, because a stale
 * road-conditions page is not merely old — it can put somebody on a closed road.
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

function when(iso: string | null, locale: string) {
  if (!iso) return null;
  return new Intl.DateTimeFormat(locale === "hi" ? "hi-IN" : "en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  }).format(new Date(iso));
}

export default async function GuidePage({
  params,
}: PageProps<"/[locale]/guides/[slug]">) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  const article = await guides.detail(slug, locale as Locale);
  if (!article) notFound();

  const stale = article.freshness === "stale";

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

      <main
        id="main"
        className="flex-1 register-light px-4 py-16 text-tone-strong sm:px-6 sm:py-20"
      >
        <article className="mx-auto max-w-2xl">
          <p className="text-sm uppercase tracking-[0.14em] text-tone-muted">
            {CLUSTER_LABEL[article.cluster] ?? article.cluster}
          </p>
          <h1 className="mt-4 font-serif text-4xl leading-tight sm:text-[2.75rem]">
            {article.title}
          </h1>

          {/*
            Doc 07's content pattern opens with "direct answer near the top". This is
            that, and it is the passage an answer engine lifts, so it is first and
            visually distinct rather than woven into an introduction.
          */}
          <p className="mt-7 border-l-2 border-gold/60 pl-5 text-[17px] leading-relaxed text-tone-body">
            {article.answer}
          </p>

          {/* Freshness above the content, not in a footer. */}
          <div
            className={`mt-8 flex items-start gap-3 rounded-lg px-5 py-4 text-sm leading-relaxed ring-1 ${
              stale
                ? "bg-saffron/12 text-tone-body ring-saffron/25"
                : "bg-ink/[0.03] text-tone-body ring-tone-line"
            }`}
          >
            {stale ? (
              <Stale className="mt-0.5 size-5 shrink-0 text-saffron" />
            ) : (
              <Verified className="mt-0.5 size-5 shrink-0 text-status-open" />
            )}
            <div>
              <p>
                {article.freshness_label}
                {article.last_reviewed_at && (
                  <>
                    {" "}
                    <time dateTime={article.last_reviewed_at}>
                      {when(article.last_reviewed_at, locale)}
                    </time>
                  </>
                )}
                {article.reviewed_by && <> by {article.reviewed_by}</>}
                {article.author && article.author !== article.reviewed_by && (
                  <>. Written by {article.author}</>
                )}
              </p>
              {stale && article.is_time_sensitive && (
                <p className="mt-2">
                  Conditions on this route change faster than a page can. Nobody has
                  re-checked this recently, so treat it as background rather than as
                  current, and{" "}
                  <Link
                    href="/status"
                    className="text-tone-strong underline decoration-gold decoration-2 underline-offset-4 hover:underline"
                  >
                    read the live status
                  </Link>{" "}
                  before you travel.
                </p>
              )}
            </div>
          </div>

          {article.body && (
            <div className="mt-10 space-y-5 text-[15px] leading-relaxed text-tone-body">
              {article.body.split("\n\n").map((paragraph) => (
                <p key={paragraph.slice(0, 40)}>{paragraph}</p>
              ))}
            </div>
          )}

          {/*
            Visible FAQ and FAQPage markup are generated from the same rows, so the
            two cannot drift. Doc 07: "structured data that matches visible content."
          */}
          {article.faqs.length > 0 && (
            <section className="mt-14">
              <h2 className="font-serif text-2xl">Questions people actually ask</h2>
              <div className="mt-6 space-y-7">
                {article.faqs.map((faq) => (
                  <div key={faq.question}>
                    <h3 className="text-[17px] leading-snug">{faq.question}</h3>
                    <p className="mt-2 text-[15px] leading-relaxed text-tone-body">
                      {faq.answer}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {article.journey_slug && (
            <div className="mt-12 border-t border-tone-line pt-8">
              <Link
                href={`/journeys/${article.journey_slug}`}
                className="inline-block rounded-full bg-gold px-5 py-2.5 text-sm font-medium text-midnight"
              >
                See the journey this is about
              </Link>
            </div>
          )}

          {article.related.length > 0 && (
            <nav className="mt-12 border-t border-tone-line pt-8" aria-label="Related guides">
              <h2 className="text-sm uppercase tracking-[0.14em] text-tone-muted">
                Also worth reading
              </h2>
              <ul className="mt-4 space-y-4">
                {article.related.map((related) => (
                  <li key={related.slug}>
                    <Link
                      href={`/guides/${related.slug}`}
                      className="text-[15px] text-tone-body underline-offset-4 hover:text-tone-strong underline decoration-gold decoration-2 hover:underline"
                    >
                      {related.title}
                    </Link>
                    <p className="mt-1 max-w-[62ch] text-sm leading-relaxed text-tone-muted">
                      {related.answer.slice(0, 140)}
                      {related.answer.length > 140 ? "…" : ""}
                    </p>
                  </li>
                ))}
              </ul>
            </nav>
          )}

          <p className="mt-12 flex items-start gap-2.5 text-sm leading-relaxed text-tone-muted">
            <Caution className="mt-0.5 size-4 shrink-0" />
            We publish what we can verify and mark what we cannot. Nothing here is a
            guarantee of access, weather or darshan.
          </p>
        </article>
      </main>
    </>
  );
}
