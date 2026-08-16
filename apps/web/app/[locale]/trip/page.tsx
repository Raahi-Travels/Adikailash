import { setRequestLocale } from "next-intl/server";

import { TripCompanion } from "@/components/trip-companion";
import { buildMetadata } from "@/lib/brand";
import type { Locale } from "@/lib/api";

/**
 * The during-trip companion (doc 05).
 *
 * A thin server shell around a client component, which is deliberate: the payload
 * has to come from the traveller's own phone when there is no network, so the work
 * happens client-side against a cached copy. See `components/trip-companion.tsx`.
 *
 * `noindex` — capability token in the URL, and a trip page has no business in search.
 */

export const metadata = {
  ...buildMetadata({
    title: "Your journey",
    description: "Today, tomorrow, and who to call.",
    path: "/trip",
  }),
  robots: { index: false, follow: false },
};

export default async function TripPage({
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
    <main id="main" data-quiet-page className="flex-1 register-dark px-4 py-10 text-ink-inverse sm:px-6 sm:py-14">
      <div className="mx-auto max-w-xl">
        {token ? (
          <TripCompanion token={token} />
        ) : (
          <p className="max-w-[52ch] text-[15px] leading-relaxed text-ink-inverse/70">
            This link is missing its token. Use the link the team sent you, and open
            it once before you leave Dharchula, so it works when the signal goes.
          </p>
        )}
      </div>
    </main>
  );
}
