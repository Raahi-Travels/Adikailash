import type { Metadata } from "next";

import { brand } from "./config";
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
 */
export function buildMetadata(input: {
  title: string;
  description: string;
  path?: string;
  /** Overrides the default share card. Path under `public/`, e.g. `/og/status.jpg`. */
  image?: string;
}): Metadata {
  const domain = valueOf(brand.web.domain);
  const suffix = display(brand.web.seoTitleSuffix);

  /*
    The share card is gated on the domain (decision O7), not on the file existing.
    An Open Graph image has to be an absolute URL, so without a domain there is no
    correct value to emit and Next would resolve it against a guessed origin. The
    moment O7 settles, every page gets a card with no further change here.

    Drop the artwork at `apps/web/public/og/default.jpg`, 1200x630. See
    docs/IMAGE-FOLLOWUP.md.
  */
  const image = domain ? `https://${domain}${input.image ?? "/og/default.jpg"}` : null;
  const cardTitle = `${input.title} — ${suffix}`;

  return {
    title: cardTitle,
    description: input.description,
    ...(domain ? { metadataBase: new URL(`https://${domain}`) } : {}),
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
