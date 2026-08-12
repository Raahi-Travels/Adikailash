import type { JourneyDetail, JourneySummary, LiveStatus } from "@/lib/api";
import { brand, display, valueOf } from "@/lib/brand";
import { absolute, siteOrigin } from "@/lib/site-url";

/**
 * JSON-LD, server-rendered.
 *
 * **Server-rendered is the whole point.** GPTBot, ClaudeBot and PerplexityBot all
 * have limited JavaScript execution, so structured data injected on the client is
 * invisible to exactly the crawlers this exists for. Every component here is a server
 * component emitting a plain `<script>` tag into the HTML.
 *
 * **Nothing here asserts anything the page does not show.** Doc 07 requires
 * "structured data that matches visible content", and there is no `aggregateRating`,
 * no `reviewCount` and no award anywhere in this file. The company has run zero
 * departures; every one of those would be a fabrication, and in markup it is the kind
 * of fabrication that is both a Google policy violation and completely invisible to
 * the person publishing it. One of the GEO tool repos we reviewed ships schema
 * templates with `"ratingValue": "4.8"` pre-filled as a real-looking value rather than
 * a placeholder. See docs/SEO.md.
 *
 * `undecided` brand values are omitted rather than guessed. A schema block naming a
 * legal entity that does not exist yet is worse than one that stays quiet about it.
 */

function Ld({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      // The payload is built from our own data, never user input.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

/** Stable `@id`s so blocks on different pages reference the same entity. */
function ids() {
  const { origin } = siteOrigin();
  return {
    organization: `${origin}/#organization`,
    website: `${origin}/#website`,
  };
}

/**
 * The Organization and WebSite pair, emitted once in the root layout.
 *
 * `sameAs` lists only profiles that actually exist. `knowsAbout` is the
 * under-used property that states what this company is genuinely expert in, and every
 * entry is defensible: they live in Pithoragarh and have driven this road.
 */
export function OrganizationLd({ locale }: { locale: string }) {
  const { origin, isProvisional } = siteOrigin();
  if (isProvisional) return null;

  const id = ids();
  const legalName = valueOf(brand.legal.entityName);
  const phone = valueOf(brand.contact.phone);
  const email = valueOf(brand.contact.supportEmail);

  const sameAs = [
    valueOf(brand.social.instagram),
    valueOf(brand.social.youtube),
    valueOf(brand.social.facebook),
  ].filter((url): url is string => Boolean(url));

  return (
    <Ld
      data={{
        "@context": "https://schema.org",
        "@graph": [
          {
            "@type": "TravelAgency",
            "@id": id.organization,
            name: display(brand.identity.name),
            // Omitted entirely until decision O1 registers an entity. A guessed
            // legal name in markup is a claim, not a placeholder.
            ...(legalName ? { legalName } : {}),
            url: origin,
            areaServed: { "@type": "Place", name: "Kumaon Himalaya, Uttarakhand, India" },
            address: {
              "@type": "PostalAddress",
              addressLocality: "Pithoragarh",
              addressRegion: "Uttarakhand",
              addressCountry: "IN",
            },
            knowsAbout: [
              "Adi Kailash yatra",
              "Om Parvat",
              "Kumaon Himalaya",
              "Inner Line Permit",
              "High-altitude acclimatisation",
              "Kumaoni homestays",
              "Pithoragarh",
              "Dharchula",
            ],
            ...(sameAs.length ? { sameAs } : {}),
            ...(phone ? { telephone: phone } : {}),
            ...(email ? { email } : {}),
          },
          {
            "@type": "WebSite",
            "@id": id.website,
            url: origin,
            name: display(brand.identity.name),
            publisher: { "@id": id.organization },
            inLanguage: locale === "hi" ? "hi-IN" : "en-IN",
          },
        ],
      }}
    />
  );
}

/**
 * A journey as `TouristTrip`.
 *
 * None of the three GEO tools we reviewed has any travel schema at all, so this is
 * ours. The honest parts matter more than the complete ones: `offers` is emitted only
 * when a real price exists, because a schema price on a journey whose pricing is still
 * decision O3 would be a number we invented.
 */
export function JourneyLd({
  journey,
  locale,
}: {
  journey: JourneyDetail;
  locale: string;
}) {
  const { isProvisional } = siteOrigin();
  if (isProvisional) return null;

  const id = ids();
  const url = absolute(`/${locale}/journeys/${journey.slug}`);
  const price = journey.tiers.find((t) => t.indicative_price)?.indicative_price;

  return (
    <Ld
      data={{
        "@context": "https://schema.org",
        "@type": "TouristTrip",
        "@id": `${url}#trip`,
        name: journey.name,
        url,
        ...(journey.essence ? { description: journey.essence } : {}),
        inLanguage: locale === "hi" ? "hi-IN" : "en-IN",
        provider: { "@id": id.organization },
        ...(journey.duration_nights
          ? { subjectOf: { "@type": "CreativeWork", name: `${journey.duration_nights} nights` } }
          : {}),
        ...(journey.last_reviewed_at ? { dateModified: journey.last_reviewed_at } : {}),
        // Itinerary from real published stages only. An empty list is emitted as
        // nothing rather than as an itinerary with no days in it.
        ...(journey.stages.length
          ? {
              itinerary: {
                "@type": "ItemList",
                numberOfItems: journey.stages.length,
                itemListElement: journey.stages.map((stage) => ({
                  "@type": "ListItem",
                  position: stage.day_number,
                  item: {
                    "@type": "TouristAttraction",
                    name: stage.title,
                    ...(stage.travel_note ? { description: stage.travel_note } : {}),
                  },
                })),
              },
            }
          : {}),
        /*
          Only when a tier carries a real indicative price. Until decisions O3 and O8
          settle, most will not, and an invented `price` is exactly the sort of claim
          that is invisible on the page and damning in the markup.
        */
        ...(price
          ? {
              offers: {
                "@type": "Offer",
                price: price.replace(/[^0-9.]/g, ""),
                priceCurrency: "INR",
                availability: "https://schema.org/PreOrder",
                url: absolute(`/${locale}/enquire`),
              },
            }
          : {}),
      }}
    />
  );
}

/** The journeys index as an ItemList, so a crawler sees the set as a set. */
export function JourneyListLd({
  journeys,
  locale,
}: {
  journeys: JourneySummary[];
  locale: string;
}) {
  const { isProvisional } = siteOrigin();
  if (isProvisional || journeys.length === 0) return null;

  return (
    <Ld
      data={{
        "@context": "https://schema.org",
        "@type": "ItemList",
        itemListElement: journeys.map((journey, index) => ({
          "@type": "ListItem",
          position: index + 1,
          url: absolute(`/${locale}/journeys/${journey.slug}`),
          name: journey.name,
        })),
      }}
    />
  );
}

/**
 * The live status page as a `Dataset` with a real `dateModified`.
 *
 * `Dataset` rather than `Article` on purpose: this page is a set of verified
 * observations with sources and timestamps, and that is what it should claim to be.
 * `dateModified` is the freshness signal every AI surface reads, and here it is the
 * genuine last verification rather than a build time.
 */
export function StatusLd({
  status,
  locale,
}: {
  status: LiveStatus;
  locale: string;
}) {
  const { isProvisional } = siteOrigin();
  if (isProvisional || !status.has_data) return null;

  const id = ids();
  const url = absolute(`/${locale}/status`);

  return (
    <Ld
      data={{
        "@context": "https://schema.org",
        "@type": "Dataset",
        "@id": `${url}#status`,
        name: "Adi Kailash and Om Parvat route, permit and weather status",
        description:
          "Current road, permit and weather conditions on the route to Adi Kailash "
          + "and Om Parvat, with the time each was last verified and by whom.",
        url,
        inLanguage: locale === "hi" ? "hi-IN" : "en-IN",
        creator: { "@id": id.organization },
        ...(status.as_of ? { dateModified: status.as_of } : {}),
        temporalCoverage: status.as_of ?? undefined,
        // Named because it is true and because it is the whole reason this page is
        // worth citing: a person checked, and the page says when.
        measurementTechnique: "Field verification by named coordinators",
        isAccessibleForFree: true,
      }}
    />
  );
}

/**
 * FAQ markup.
 *
 * Google restricted FAQ *rich results* to government and health sites in 2023, so
 * this earns no snippet. It is emitted anyway because AI answer engines parse it, and
 * the cost is a few hundred bytes.
 *
 * Every question must exist on the page as visible text. Doc 07: "structured data
 * that matches visible content."
 */
export function FaqLd({ items }: { items: { question: string; answer: string }[] }) {
  const { isProvisional } = siteOrigin();
  if (isProvisional || items.length === 0) return null;

  return (
    <Ld
      data={{
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: items.map((item) => ({
          "@type": "Question",
          name: item.question,
          acceptedAnswer: { "@type": "Answer", text: item.answer },
        })),
      }}
    />
  );
}

/** Breadcrumbs, so a crawler can see where a page sits without guessing from the URL. */
export function BreadcrumbLd({
  trail,
  locale,
}: {
  trail: { name: string; path: string }[];
  locale: string;
}) {
  const { isProvisional } = siteOrigin();
  if (isProvisional) return null;

  return (
    <Ld
      data={{
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: trail.map((crumb, index) => ({
          "@type": "ListItem",
          position: index + 1,
          name: crumb.name,
          item: absolute(`/${locale}${crumb.path}`),
        })),
      }}
    />
  );
}
