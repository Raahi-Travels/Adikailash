import { setRequestLocale } from "next-intl/server";

import { SpecialistEnquiryForm } from "@/components/specialist-enquiry-form";
import { Grain } from "@/components/backgrounds";
import { QuietAction } from "@/components/ui/action";
import { Content } from "@/components/ui/band";
import { PhotoNote } from "@/components/ui/figure";
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
 *
 * The same composition as `/enquire` with a different figure and a different lead,
 * which is what spec 10.10 asks for: these are one surface with two subjects, not
 * two layouts.
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
    <main id="main" data-lead-band data-register-mark="light" className="register-light flex-1">
      {/*
        Not `<Band>`, and this is the only deviation on this page. `Band` is
        `relative isolate overflow-hidden`, which it has to be because it clips
        the bloom's `-inset-[20%]`. An `overflow: hidden` ancestor is a scroll
        container, and `position: sticky` resolves against the nearest scroll
        container: inside a Band, sticky silently never moves. The left rail
        here is sticky, so the section is written out with the same register
        mark, the same `band` rhythm and the same grain, minus the clip. Nothing
        on this page bleeds, so there is nothing to clip.
      */}
      <section
        data-register-mark="light"
        className="band band--lead register-light relative isolate"
      >
        <Grain opacity={0.34} />
        <Content>
          <div className="grid items-start gap-x-12 gap-y-14 lg:grid-cols-12 lg:grid-rows-[auto_1fr] lg:gap-x-16">
            <div className="lg:col-span-5 lg:col-start-1 lg:row-start-1">
              <h1 className="type-title-1 text-tone-strong">
                Private groups and travellers from abroad
              </h1>
              <p className="type-lead mt-[var(--stack-title)] text-tone-body">
                A shared departure suits many people and not everybody. If you are
                travelling with elders, coming from another country, or want the pace
                to be yours, this is the door.
              </p>

              <dl className="mt-[var(--stack-block)] grid gap-6">
                <div>
                  <dt className="type-meta font-semibold text-tone-strong">
                    What happens next
                  </dt>
                  <dd className="type-meta measure-meta mt-1 text-tone-body">
                    You send this. One of us reads it and writes back to arrange a
                    call at a time that is reasonable where you are, not where we
                    are. The call produces a proposal.
                  </dd>
                </div>
                <div>
                  <dt className="type-meta font-semibold text-tone-strong">
                    What it is not
                  </dt>
                  <dd className="type-meta measure-meta mt-1 text-tone-body">
                    Not a booking, and not a confirmation that your dates will work.
                    The route depends on permits, weather and the road, and we would
                    rather tell you that now than after you have bought a flight.
                  </dd>
                </div>
              </dl>
            </div>

            <div className="lg:col-span-7 lg:col-start-6 lg:row-span-2 lg:row-start-1">
              <SpecialistEnquiryForm kind="private_or_international" />
            </div>

            <div className="lg:sticky lg:top-[calc(var(--chrome-top)+var(--nav-h)+var(--nav-inset)*2+1.5rem)] lg:col-span-5 lg:col-start-1 lg:row-start-2">
              <PhotoNote
                name="homestay-kitchen"
                className="lg:ml-10"
                sizes="(min-width: 1024px) 340px, 60vw"
                label="A village kitchen in Kumaon. On a private journey the pace is set around the people in the room, not around a coach timetable."
              />

              <div className="mt-[var(--space-2xl)]">
                <p className="type-body font-semibold text-tone-strong">
                  Would a shared departure do?
                </p>
                <p className="type-meta measure-meta mt-2 text-tone-body">
                  It costs less and it fills the vehicle, which is often the better
                  answer. Look at the journeys first if you are not sure.
                </p>
                <div className="mt-5 flex flex-wrap gap-3">
                  <QuietAction href="/journeys">See the journeys</QuietAction>
                  <QuietAction href="/enquire">Ask a general question</QuietAction>
                </div>
              </div>
            </div>
          </div>
        </Content>
      </section>
    </main>
  );
}
