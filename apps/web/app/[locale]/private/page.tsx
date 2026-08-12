import { setRequestLocale } from "next-intl/server";

import { SpecialistEnquiryForm } from "@/components/specialist-enquiry-form";
import { routing } from "@/i18n/routing";
import { buildMetadata } from "@/lib/brand";

/**
 * Private groups and international travellers.
 *
 * Doc 03: "International and complex private groups should not be forced through a
 * standard package checkout... The outcome is a consultation and tailored proposal,
 * not an instant guarantee." Both halves of that sentence are load-bearing, and the
 * page says the second half out loud rather than implying availability it cannot
 * confirm.
 */

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export const metadata = buildMetadata({
  title: "Private groups and international travellers",
  description:
    "A consultation and a tailored proposal for private groups, families travelling with elders, and travellers coming from outside India.",
  path: "/private",
});

export default async function PrivatePage({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <main id="main" className="flex-1 bg-midnight px-4 py-16 text-ink-inverse sm:px-6 sm:py-20">
      <div className="mx-auto grid max-w-5xl gap-14 lg:grid-cols-[1fr_1.3fr]">
        <div>
          <h1 className="max-w-[18ch] font-serif text-4xl leading-tight sm:text-5xl">
            Private groups and travellers from abroad
          </h1>
          <p className="mt-5 max-w-[46ch] text-[15px] leading-relaxed text-ink-inverse/70">
            A shared departure suits many people and not everybody. If you are
            travelling with elders, coming from another country, or want the pace to
            be yours, this is the door.
          </p>

          <div className="mt-10 space-y-6 border-t border-white/12 pt-8">
            <div>
              <h2 className="text-sm text-ink-inverse/80">What happens next</h2>
              <p className="mt-2 max-w-[44ch] text-sm leading-relaxed text-ink-inverse/55">
                You send this. One of us reads it and writes back to arrange a call at
                a time that is reasonable where you are, not where we are. The call
                produces a proposal.
              </p>
            </div>
            <div>
              <h2 className="text-sm text-ink-inverse/80">What it is not</h2>
              <p className="mt-2 max-w-[44ch] text-sm leading-relaxed text-ink-inverse/55">
                Not a booking, and not a confirmation that your dates will work. The
                route depends on permits, weather and the road, and we would rather
                tell you that now than after you have bought a flight.
              </p>
            </div>
          </div>
        </div>

        <SpecialistEnquiryForm kind="private_or_international" />
      </div>
    </main>
  );
}
