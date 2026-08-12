import { setRequestLocale } from "next-intl/server";

import { FeedbackForm } from "@/components/feedback-form";
import { buildMetadata } from "@/lib/brand";
import type { Locale } from "@/lib/api";

/**
 * The private post-trip form (doc 07 step 1).
 *
 * `noindex` because the URL carries a capability token. Also because a feedback form
 * has no business in search results.
 */

export const metadata = {
  ...buildMetadata({
    title: "How was your journey?",
    description: "Private feedback after your journey.",
    path: "/feedback",
  }),
  robots: { index: false, follow: false },
};

export default async function FeedbackPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { token } = await searchParams;

  return (
    <main id="main" className="flex-1 bg-midnight px-4 py-16 text-ink-inverse sm:px-6 sm:py-20">
      <div className="mx-auto grid max-w-5xl gap-14 lg:grid-cols-[1fr_1.4fr]">
        <div>
          <h1 className="max-w-[16ch] font-serif text-4xl leading-tight sm:text-5xl">
            How was it, honestly?
          </h1>
          <p className="mt-5 max-w-[44ch] text-[15px] leading-relaxed text-ink-inverse/70">
            This goes to the three of us and nowhere else. It is not a review, it will
            not be published, and nothing you write here appears on the website.
          </p>
          <p className="mt-6 max-w-[44ch] text-sm leading-relaxed text-ink-inverse/55">
            If something went wrong we would much rather hear it from you now. We will
            call you about it before we ask you for anything else.
          </p>
        </div>

        {token ? (
          <FeedbackForm token={token} />
        ) : (
          <div className="rounded-lg bg-white/[0.04] px-6 py-7 ring-1 ring-white/10">
            <p className="max-w-[52ch] text-[15px] leading-relaxed text-ink-inverse/70">
              This link is missing its token, so we cannot tell which journey it is
              about. Please use the link we sent you, or write to us directly.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
