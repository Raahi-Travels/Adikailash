import { setRequestLocale } from "next-intl/server";

import { EnquiryForm } from "@/components/enquiry-form";
import { Grain } from "@/components/backgrounds";
import { QuietAction } from "@/components/ui/action";
import { Content } from "@/components/ui/band";
import { PhotoNote } from "@/components/ui/figure";
import { routing } from "@/i18n/routing";
import { api, type Locale } from "@/lib/api";
import { brand, buildMetadata, display, isSettled } from "@/lib/brand";

/**
 * The general enquiry page.
 *
 * Spec 10.10: one flat ground, no outer card around the form and no panel inside
 * it, the dead 680x370 rectangle in the left column filled rather than left as a
 * hole, and exactly one gold object on the page (the submit).
 *
 * The picture is a `photo-note` circle and not a `photo-figure`, and that is the
 * ramp-length rule rather than a preference: the left column is about 460px wide
 * at 1440, a 16/10 figure in it is 287px tall, and a bottom feather on a 287px
 * box is a 158px ramp. Under the 200px floor a feather reads as a smudge rather
 * than as mist. A circle has no edge to feather, so it is the one image primitive
 * that works in a narrow column.
 *
 * Three grid children rather than two, so the picture can follow the intro on a
 * desktop and follow the *form* on a phone. Somebody on mobile data should reach
 * the first field without scrolling past a photograph to get there.
 */

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
              <h1 className="type-title-1 text-tone-strong">Speak to a Journey Guide</h1>
              <p className="type-lead mt-[var(--stack-title)] text-tone-body">
                Tell us what you are unsure about. Someone who has driven this road
                will read it and reply.
              </p>

              {/*
                Doc 04: "It should not display a response promise that the team
                routinely misses." Until support hours are agreed (O10), this says
                nothing at all about speed.
              */}
              <dl className="mt-[var(--stack-block)] grid gap-6">
                <div>
                  <dt className="type-meta font-semibold text-tone-strong">
                    When somebody is reading
                  </dt>
                  <dd className="type-meta measure-meta mt-1 text-tone-body">
                    {isSettled(hours)
                      ? hours.value
                      : "We have not published response times yet, because we will not promise one we cannot keep. You will hear from a person."}
                  </dd>
                </div>
                <div>
                  <dt className="type-meta font-semibold text-tone-strong">
                    What we will never ask for here
                  </dt>
                  <dd className="type-meta measure-meta mt-1 text-tone-body">
                    Identity documents or payment details. Not on this form, and not
                    over WhatsApp either. {display(brand.contact.baseCity)}.
                  </dd>
                </div>
              </dl>
            </div>

            <div className="lg:col-span-7 lg:col-start-6 lg:row-span-2 lg:row-start-1">
              <EnquiryForm journeys={journeys} />
            </div>

            {/* Offset off the column start on purpose: a circle centred in its
                column reads as another box with the corners taken off. */}
            <div className="lg:sticky lg:top-[calc(var(--chrome-top)+var(--nav-h)+var(--nav-inset)*2+1.5rem)] lg:col-span-5 lg:col-start-1 lg:row-start-2">
              {/* Offset off the column start on purpose: a circle centred in its
                  column reads as another box with the corners taken off. */}
              <PhotoNote
                name="permits"
                className="lg:ml-10"
                sizes="(min-width: 1024px) 340px, 60vw"
                label="A checkpost on the inner line road. Permits are the part of this journey we will not guess at."
              />

              <div className="mt-[var(--space-2xl)]">
                <p className="type-body font-semibold text-tone-strong">
                  Not ready to write yet?
                </p>
                <p className="type-meta measure-meta mt-2 text-tone-body">
                  Both of these are free to read, and neither of them asks you for
                  anything.
                </p>
                <div className="mt-5 flex flex-wrap gap-3">
                  <QuietAction href="/plan">Plan your journey</QuietAction>
                  <QuietAction href="/status">Live route status</QuietAction>
                </div>
              </div>
            </div>
          </div>
        </Content>
      </section>
    </main>
  );
}
