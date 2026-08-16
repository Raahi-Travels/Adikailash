import type { Metadata } from "next";

import { brand } from "./config";
import { siteOrigin } from "@/lib/site-url";
import { display, isSettled, valueOf } from "./types";

/**
 * Context carried into a WhatsApp conversation.
 *
 * Doc 04: "Every digital entry point should carry available context such as journey,
 * departure, campaign, page, language and intent. The customer should not have to
 * repeat which package they were viewing."
 */
export type EnquiryContext = {
  journey?: string;
  departure?: string;
  page?: string;
  campaign?: string;
  intent?: "journey" | "status" | "private" | "international" | "booking-support";
  language?: "en" | "hi";
};

/**
 * A wa.me link with the enquiry context pre-filled, or `null` when the support
 * number is still undecided (O9).
 *
 * Returning `null` rather than a broken `wa.me/` is deliberate: callers must render
 * a working alternative (callback request, enquiry form) instead of a dead CTA.
 */
export function whatsappLink(context: EnquiryContext = {}): string | null {
  const number = valueOf(brand.contact.whatsappNumber);
  if (!number) return null;

  const lines: string[] = [];
  if (context.journey) lines.push(`Journey: ${context.journey}`);
  if (context.departure) lines.push(`Departure: ${context.departure}`);
  if (lines.length === 0) lines.push("I would like to know more about your journeys.");

  const digits = number.replace(/\D/g, "");
  return `https://wa.me/${digits}?text=${encodeURIComponent(lines.join("\n"))}`;
}

/**
 * Page metadata with the brand's title suffix applied.
 *
 * `metadataBase` is only set once a domain exists (O7); Next will warn rather than
 * silently resolve OG images against a guessed origin.
 *
 * **hreflang is emitted whenever `path` is known.** Decision D11 gives symmetrical
 * `/en/` and `/hi/` prefixes, so the pair is derivable rather than configured. Doc 02
 * calls Hindi "a first-class layout, not a smaller translation"; declaring the two as
 * alternates is the structural form of that, and it stops them competing with each
 * other in the index. No SEO tool we reviewed checks hreflang, so nothing will catch
 * this if it breaks.
 *
 * `x-default` points at English because it is the default locale, not because it
 * matters more: it is the fallback when a crawler cannot infer a preference.
 *
 * **`canonical` needs the current locale**, so it is emitted only when `locale` is
 * passed. Guessing would be worse than omitting: a wrong canonical tells search
 * engines a page lives somewhere it does not, and that is expensive to undo.
 */
export function buildMetadata(input: {
  title: string;
  description: string;
  /** Locale-agnostic path, e.g. `/status`. Drives hreflang and canonical. */
  path?: string;
  /** The locale being rendered. Required before a canonical is emitted. */
  locale?: string;
  /** Overrides the default share card. Path under `public/`, e.g. `/og/status.jpg`. */
  image?: string;
}): Metadata {
  const domain = valueOf(brand.web.domain);
  const suffix = display(brand.web.seoTitleSuffix);

  const { origin, isProvisional } = siteOrigin();
  /*
    Only advertise alternates against an asserted origin. Under a preview host these
    would teach search engines URLs we intend to abandon, and robots disallows
    everything there anyway.
  */
  const alternates =
    input.path && !isProvisional
      ? {
          ...(input.locale
            ? { canonical: `${origin}/${input.locale}${input.path}` }
            : {}),
          languages: {
            en: `${origin}/en${input.path}`,
            hi: `${origin}/hi${input.path}`,
            "x-default": `${origin}/en${input.path}`,
          },
        }
      : undefined;

  /*
    The share card is gated on the domain (decision O7), not on the file existing.
    An Open Graph image has to be an absolute URL, so without a domain there is no
    correct value to emit and Next would resolve it against a guessed origin. The
    moment O7 settles, every page gets a card with no further change here.

    Drop the artwork at `apps/web/public/og/default.jpg`, 1200x630. See
    docs/IMAGE-FOLLOWUP.md.
  */
  const image = domain ? `https://${domain}${input.image ?? "/og/default.jpg"}` : null;
  const cardTitle = `${input.title}: ${suffix}`;

  return {
    title: cardTitle,
    description: input.description,
    ...(domain ? { metadataBase: new URL(`https://${domain}`) } : {}),
    ...(alternates ? { alternates } : {}),
    openGraph: {
      title: cardTitle,
      description: input.description,
      siteName: display(brand.identity.name),
      locale: isSettled(brand.locale.defaultLanguage) ? "en_IN" : undefined,
      type: "website",
      ...(domain && input.path ? { url: `https://${domain}${input.path}` } : {}),
      ...(image
        ? { images: [{ url: image, width: 1200, height: 630, alt: cardTitle }] }
        : {}),
    },
    /*
      A large card, because most of what gets shared here is a journey or a route
      status and both are worth a picture. `summary` would render a thumbnail.
    */
    ...(image
      ? {
          twitter: {
            card: "summary_large_image" as const,
            title: cardTitle,
            description: input.description,
            images: [image],
          },
        }
      : {}),
  };
}
