import { setRequestLocale } from "next-intl/server";

import { SpecialistEnquiryForm } from "@/components/specialist-enquiry-form";
import { Band, BleedGrid, Content } from "@/components/ui/band";
import { PhotoFigure, PhotoNote } from "@/components/ui/figure";
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
 *
 * The composition follows from that. The fold is light and short: what this is, who
 * it is for, and the checkpost photograph running past the reading column to the
 * viewport edge, because the inner line barrier is the single thing an operator is
 * buying help with. Then the register turns to navy for the three limits, which is
 * where this site puts what it is certain about. The form comes last, on the light
 * ground again, once the reader knows whether it is worth filling in.
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

/**
 * The limits, as data, so the navy band renders from one list rather than three
 * hand-placed blocks that will drift apart the first time somebody edits one.
 */
const LIMITS = [
  {
    heading: "Where we actually work",
    body: "Kathgodam, Haldwani, Pithoragarh, Dharchula, and the route up to Gunji, Nabhidhang and Adi Kailash. We are based in Pithoragarh. Outside that, we would be a middleman and you should book direct.",
  },
  {
    heading: "On capacity",
    body: "We are a small operation. If your dates or volume are beyond what we can staff properly, we will tell you when you ask rather than after you have sold the trip.",
  },
  {
    heading: "On the route",
    body: "Nobody can guarantee this road. What we can do is tell you what it is doing, early and in writing, so you can talk to your own travellers before they set out.",
  },
];

export default async function PartnersPage({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <main
      id="main"
      className="flex-1 register-light"
      data-register-mark="light"
      data-lead-band
    >
      <Band register="light" lead grain>
        <BleedGrid>
          {/*
            The one sanctioned grid break on this page. The reading column keeps its
            left inset; the photograph runs past it to the viewport edge. Below `lg`
            it collapses to a plain stack, and the text takes its right gutter back.
          */}
          <div className="pop-right grid items-center gap-[var(--stack-block)] lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] lg:gap-[var(--space-xl)]">
            <div className="pr-[var(--gutter)] lg:pr-0">
              <h1 className="type-title-1 max-w-[16ch] text-tone-strong">
                Ground handling in Kumaon
              </h1>
              <p className="type-lead mt-[var(--stack-title)] text-tone-body">
                If you run your own groups and need somebody on this side of the
                mountain.
              </p>
              <p className="type-body mt-[var(--space-md)] text-tone-body">
                Transfers from the gateway towns, inner line permit paperwork,
                accommodation, vehicles and drivers, and a coordinator who lives
                here and answers the phone from here. You keep your travellers,
                your itinerary and your pricing. We do the part that only works
                if somebody is standing on the road.
              </p>
            </div>

            {/* Not graded: the checkpost is evidence, and grading evidence is the one
              place this site cannot stylise. */}
            <PhotoFigure
              name="permits"
              register="light"
              sizes="(min-width: 1024px) 58vw, calc(100vw * 1.35)"
              caption="The inner line checkpost is where a permit becomes a yes or a no."
            />
          </div>
        </BleedGrid>
      </Band>

      {/* Navy carries what we are certain about, and what we are certain about here
          is the shape of our own limits. */}
      <Band register="dark" grain>
        <Content>
          <div className="grid gap-[var(--stack-block)] lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] lg:gap-[var(--space-2xl)]">
            <div className="lg:self-start">
              <h2 className="type-title-1 text-tone-strong">
                The limits, first
              </h2>
              <p className="type-body mt-[var(--stack-title)] text-tone-body">
                We would rather lose an enquiry at this paragraph than take it
                and work it out afterwards, on your travellers.
              </p>

              {/* Off the grid, deliberately. A kitchen is one of the few subjects
                  here that survives a square crop, and accommodation is half of
                  what an operator is actually asking us to hold up. */}
              <PhotoNote
                name="homestay-kitchen"
                className="mt-[var(--space-xl)] ml-auto lg:ml-[8%]"
                sizes="(min-width: 1024px) 300px, 55vw"
                label="Village accommodation is arranged household by household, not through a booking system."
              />
            </div>

            <div>
              <dl className="flex flex-col gap-[var(--space-xl)]">
                {LIMITS.map((limit) => (
                  <div key={limit.heading}>
                    <dt className="type-title-2 text-tone-strong">
                      {limit.heading}
                    </dt>
                    <dd className="type-body mt-[var(--space-sm)] text-tone-body">
                      {limit.body}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </Content>
      </Band>

      <Band register="light" grain id="enquiry">
        <Content>
          <div className="grid gap-[var(--stack-block)] lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] lg:gap-[var(--space-2xl)]">
            <div className="lg:self-start">
              <h2 className="type-title-1 text-tone-strong">
                Tell us what you need
              </h2>
              <p className="type-body mt-[var(--stack-title)] text-tone-body">
                Nothing here is a commitment on either side. A real person reads
                it, and if the dates or the volume are beyond us we will say so
                in the reply rather than open a negotiation.
              </p>
              <p className="type-meta measure-meta mt-[var(--space-md)] text-tone-muted">
                Only a name and an email are required. Everything else is there
                because it saves a round of questions, not because we need it to
                answer you.
              </p>
            </div>

            <SpecialistEnquiryForm kind="b2b_ground_handling" />
          </div>
        </Content>
      </Band>
    </main>
  );
}
