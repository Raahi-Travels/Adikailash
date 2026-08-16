import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";

import { Caution } from "@/components/icons";
import { Link } from "@/i18n/navigation";
import { buildMetadata } from "@/lib/brand";
import { POLICIES, POLICY_ORDER, type PolicySlug } from "@/lib/policies";

/**
 * A single policy.
 *
 * Rendered light-on-dark like the rest of the site but at a narrower measure, because
 * these are the only pages here anyone reads top to bottom.
 *
 * Two things are deliberately loud rather than tucked away: the draft banner while a
 * policy is unreviewed, and any clause that depends on a decision we have not made.
 * Doc 06's failure mode is "a website that implies guarantees the business cannot
 * control", and a confident-looking policy with a quietly missing clause is exactly
 * that.
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

export default async function PolicyPage({
  params,
}: PageProps<"/[locale]/policies/[policy]">) {
  const { locale, policy } = await params;
  setRequestLocale(locale);

  const doc = POLICIES[policy as PolicySlug];
  if (!doc) notFound();

  return (
    <main
      id="main"
      className="flex-1 register-light px-4 py-16 text-tone-strong sm:px-6 sm:py-20"
    >
      <div className="mx-auto max-w-2xl">
        <Link
          href="/policies"
          className="text-sm text-tone-muted underline-offset-4 hover:text-tone-strong hover:underline"
        >
          Policies
        </Link>

        <h1 className="mt-5 font-serif text-4xl leading-tight sm:text-[2.75rem]">
          {doc.title}
        </h1>
        <p className="mt-5 text-[15px] leading-relaxed text-tone-body">
          {doc.summary}
        </p>

        <p className="mt-8 rounded-lg bg-ink/[0.03] px-5 py-4 text-[15px] leading-relaxed ring-1 ring-tone-line">
          <span className="text-tone-muted">In short. </span>
          {doc.inShort}
        </p>

        {!doc.reviewed && (
          <div className="mt-6 flex gap-3 rounded-lg bg-saffron/12 px-5 py-4 ring-1 ring-saffron/25">
            <Caution className="mt-0.5 size-5 shrink-0 text-saffron" />
            <p className="text-sm leading-relaxed text-tone-body">
              This is a working draft. It has not yet been reviewed by a lawyer, and we
              are not taking payments on this website until it has been. We are
              publishing it early because you should be able to read our terms before
              you talk to us, not after.
            </p>
          </div>
        )}

        {/*
          Hindi legal text is a real translation job, not a switch. Doc 05: Hindi must
          not be "a machine-translated afterthought". Until it is done properly, say so.
        */}
        {locale === "hi" && (
          <p className="mt-6 rounded-lg bg-ink/[0.03] px-5 py-4 text-sm leading-relaxed ring-1 ring-tone-line">
            यह नीति अभी केवल अंग्रेज़ी में उपलब्ध है। हिंदी अनुवाद तैयार किया जा रहा है। किसी भी
            बिंदु पर संदेह हो तो हमें फ़ोन करें, हम हिंदी में समझा देंगे।
          </p>
        )}

        <div className="mt-14 space-y-12">
          {doc.sections.map((section) => (
            <section key={section.heading}>
              <h2 className="font-serif text-2xl leading-snug">{section.heading}</h2>

              {section.body.map((para) => (
                <p
                  key={para.slice(0, 40)}
                  className="mt-4 text-[15px] leading-relaxed text-tone-body"
                >
                  {para}
                </p>
              ))}

              {section.points && (
                <ul className="mt-5 space-y-3">
                  {section.points.map((point) => (
                    <li
                      key={point.slice(0, 40)}
                      className="flex gap-3 text-[15px] leading-relaxed text-tone-body"
                    >
                      <span aria-hidden className="mt-2 size-1 shrink-0 rounded-full bg-gold" />
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              )}

              {section.pending && (
                <p className="mt-5 border-l-2 border-saffron/40 py-1 pl-4 text-sm leading-relaxed text-tone-body">
                  <span className="text-saffron/90">Not settled yet. </span>
                  {section.pending}
                </p>
              )}
            </section>
          ))}
        </div>

        <nav
          className="mt-16 border-t border-tone-line pt-8"
          aria-label="Other policies"
        >
          <h2 className="text-sm uppercase tracking-[0.14em] text-tone-muted">
            Also worth reading
          </h2>
          <ul className="mt-4 space-y-3">
            {POLICY_ORDER.filter((s) => s !== doc.slug).map((slug) => (
              <li key={slug}>
                <Link
                  href={`/policies/${slug}`}
                  className="text-[15px] text-tone-body underline-offset-4 hover:text-tone-strong underline decoration-gold decoration-2 hover:underline"
                >
                  {POLICIES[slug].title}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </main>
  );
}
