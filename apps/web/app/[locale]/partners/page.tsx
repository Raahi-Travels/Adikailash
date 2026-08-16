import { setRequestLocale } from "next-intl/server";

import { SpecialistEnquiryForm } from "@/components/specialist-enquiry-form";
import { routing } from "@/i18n/routing";
import { buildMetadata } from "@/lib/brand";

/**
 * Ground handling for other operators.
 *
 * Doc 01 lists "Local execution for external agencies and communities" as a P1
 * revenue line. Doc 03 puts partnerships behind the main navigation ("Press,
 * partnerships or B2B ground handling later"), so this page exists and is linked
 * from the footer rather than competing with the traveller journey in the header.
 *
 * Deliberately unglamorous. An agency operations head is not reading for atmosphere;
 * they want to know what we cover, where, and whether we will be honest about
 * capacity. So the page leads with the limits.
 */

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export const metadata = buildMetadata({
  title: "Ground handling in Kumaon",
  description:
    "Transfers, inner line permits, accommodation and local coordination in Kumaon and the Adi Kailash route, for agencies operating their own groups.",
  path: "/partners",
});

export default async function PartnersPage({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <main id="main" className="flex-1 register-light px-4 py-16 text-tone-strong sm:px-6 sm:py-20">
      <div className="mx-auto grid max-w-5xl gap-14 lg:grid-cols-[1fr_1.3fr]">
        <div>
          <h1 className="max-w-[16ch] font-serif text-4xl leading-tight sm:text-5xl">
            Ground handling in Kumaon
          </h1>
          <p className="mt-5 max-w-[46ch] text-[15px] leading-relaxed text-tone-body">
            If you run your own groups and need somebody on this side of the
            mountain: transfers, inner line permits, accommodation, vehicles and a
            coordinator who lives here.
          </p>

          <div className="mt-10 space-y-6 border-t border-tone-line pt-8">
            <div>
              <h2 className="text-sm text-tone-body">Where we actually work</h2>
              <p className="mt-2 max-w-[44ch] text-sm leading-relaxed text-tone-muted">
                Kathgodam, Haldwani, Pithoragarh, Dharchula, and the route up to Gunji,
                Nabhidhang and Adi Kailash. We are based in Pithoragarh. Outside that,
                we would be a middleman and you should book direct.
              </p>
            </div>
            <div>
              <h2 className="text-sm text-tone-body">On capacity</h2>
              <p className="mt-2 max-w-[44ch] text-sm leading-relaxed text-tone-muted">
                We are a small operation. If your dates or volume are beyond what we
                can staff properly, we will tell you when you ask rather than after
                you have sold the trip.
              </p>
            </div>
            <div>
              <h2 className="text-sm text-tone-body">On the route</h2>
              <p className="mt-2 max-w-[44ch] text-sm leading-relaxed text-tone-muted">
                Nobody can guarantee this road. What we can do is tell you what it is
                doing, early and in writing, so you can talk to your own travellers
                before they set out.
              </p>
            </div>
          </div>
        </div>

        <SpecialistEnquiryForm kind="b2b_ground_handling" />
      </div>
    </main>
  );
}
