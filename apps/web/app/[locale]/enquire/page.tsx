import { setRequestLocale } from "next-intl/server";

import { EnquiryForm } from "@/components/enquiry-form";
import { routing } from "@/i18n/routing";
import { api, type Locale } from "@/lib/api";
import { brand, buildMetadata, display, isSettled } from "@/lib/brand";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export const metadata = buildMetadata({
  title: "Speak to a Journey Guide",
  description:
    "Ask about routes, permits, altitude or taking family. A person replies, not an automated sequence.",
  path: "/enquire",
});

export default async function EnquirePage({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const journeys = (await api.journeys(locale as Locale)) ?? [];
  const hours = brand.contact.supportHours;

  return (
    <main id="main" className="flex-1 register-light px-4 py-16 text-tone-strong sm:px-6 sm:py-20">
      <div className="mx-auto grid max-w-5xl gap-14 lg:grid-cols-[1fr_1.3fr]">
        <div>
          <h1 className="max-w-[16ch] font-serif text-4xl leading-tight sm:text-5xl">
            Speak to a Journey Guide
          </h1>
          <p className="mt-5 max-w-[46ch] text-[15px] leading-relaxed text-tone-body">
            Tell us what you are unsure about. Someone who has driven this road will
            read it and reply.
          </p>

          {/*
            Doc 04: "It should not display a response promise that the team routinely
            misses." Until support hours are agreed (O10), we say nothing about speed.
          */}
          <p className="mt-8 border-t border-tone-line pt-6 text-sm leading-relaxed text-tone-muted">
            {isSettled(hours)
              ? hours.value
              : "We have not published response times yet, because we will not promise one we cannot keep. You will hear from a person."}
          </p>
          <p className="mt-4 text-sm leading-relaxed text-tone-muted">
            We will never ask for identity documents or payment details through this
            form. {display(brand.contact.baseCity)}.
          </p>
        </div>

        <EnquiryForm journeys={journeys} />
      </div>
    </main>
  );
}
