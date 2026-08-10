import { setRequestLocale } from "next-intl/server";

import { ArrowRight } from "@/components/icons";
import { Link } from "@/i18n/navigation";
import { buildMetadata } from "@/lib/brand";
import { POLICIES, POLICY_ORDER } from "@/lib/policies";

/**
 * Index of the policy pages.
 *
 * Each entry leads with `inShort` rather than the title alone, so someone who came
 * here for one specific answer ("what happens if the road closes") can often stop
 * reading at this page.
 */

export const metadata = buildMetadata({
  title: "Policies",
  description:
    "Terms of service, cancellation and refunds, privacy, and the consent we ask for. Written to be read before you book.",
  path: "/policies",
});

export default async function PoliciesPage({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <main
      id="main"
      className="flex-1 bg-midnight px-4 py-16 text-ink-inverse sm:px-6 sm:py-20"
    >
      <div className="mx-auto max-w-3xl">
        <h1 className="font-serif text-4xl leading-tight sm:text-5xl">Policies</h1>
        <p className="mt-5 max-w-[62ch] text-[15px] leading-relaxed text-ink-inverse/70">
          Written to be read before you book rather than quoted back at you afterwards.
          Where something is genuinely not decided yet, it says so instead of sounding
          decided.
        </p>

        <div className="mt-14">
          {POLICY_ORDER.map((slug) => {
            const doc = POLICIES[slug];
            return (
              <Link
                key={slug}
                href={`/policies/${slug}`}
                className="group block border-t border-white/12 py-7 transition-colors hover:bg-white/[0.03]"
              >
                <div className="flex items-baseline gap-4">
                  <h2 className="font-serif text-2xl transition-colors group-hover:text-gold">
                    {doc.title}
                  </h2>
                  {!doc.reviewed && (
                    <span className="text-xs uppercase tracking-[0.12em] text-saffron/80">
                      Draft
                    </span>
                  )}
                  <ArrowRight className="ml-auto size-5 shrink-0 self-center text-ink-inverse/30 transition-all group-hover:translate-x-1 group-hover:text-gold" />
                </div>
                <p className="mt-3 max-w-[64ch] text-[15px] leading-relaxed text-ink-inverse/70">
                  {doc.inShort}
                </p>
              </Link>
            );
          })}
        </div>

        <p className="mt-14 border-t border-white/12 pt-8 text-sm leading-relaxed text-ink-inverse/55">
          If anything here is unclear, ask us before you book rather than after. A
          policy you had to interpret is a policy we wrote badly, and we would like to
          know.
        </p>
      </div>
    </main>
  );
}
