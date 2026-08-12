import type { MetadataRoute } from "next";

import { api } from "@/lib/api";
import { POLICY_ORDER } from "@/lib/policies";
import { routing } from "@/i18n/routing";
import { siteOrigin } from "@/lib/site-url";

/**
 * The sitemap.
 *
 * Doc 07 makes organic search the primary acquisition channel, so this is not a
 * formality. Three decisions in it are deliberate:
 *
 * **Every URL carries its `alternates.languages` pair.** Decision D11 gives us
 * symmetrical `/en/` and `/hi/` prefixes, which makes hreflang trivial, and doc 02
 * insists Hindi is "a first-class layout, not a smaller translation". Declaring the
 * pair is the structural form of that: it tells Google the two are the same page for
 * different readers rather than duplicates competing with each other.
 *
 * **`changeFrequency` and `priority` are set from what is actually true.** The live
 * status page genuinely changes daily and is the page doc 03 calls "a signature trust
 * and organic-discovery asset". A policy page does not. Marking everything `daily` at
 * priority 1.0 is the oldest tell of an unserious sitemap and search engines discount
 * it accordingly.
 *
 * **Nothing private is listed.** Admin, the traveller booking pages and the trip pack
 * are all reached by session or by a private token. They are excluded here and
 * disallowed in robots, and neither is access control: the API is.
 *
 * Journeys come from the API, so a journey published in the admin appears here
 * without a deploy. If the API is unreachable the sitemap still renders with the
 * static routes rather than failing the build.
 */

export const revalidate = 3600;

type Entry = MetadataRoute.Sitemap[number];

/** One entry per path, carrying both locales as alternates of each other. */
function localized(
  path: string,
  options: Omit<Entry, "url" | "alternates"> = {},
): MetadataRoute.Sitemap {
  const { origin } = siteOrigin();
  const languages = Object.fromEntries(
    routing.locales.map((locale) => [locale, `${origin}/${locale}${path}`]),
  );

  return routing.locales.map((locale) => ({
    url: `${origin}/${locale}${path}`,
    alternates: { languages },
    ...options,
  }));
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const entries: MetadataRoute.Sitemap = [
    ...localized("", { changeFrequency: "weekly", priority: 1, lastModified: now }),
    // Doc 03: the status page is "a signature trust and organic-discovery asset".
    // It is the only page here that genuinely changes daily.
    ...localized("/status", {
      changeFrequency: "daily",
      priority: 0.9,
      lastModified: now,
    }),
    ...localized("/journeys", { changeFrequency: "weekly", priority: 0.9 }),
    ...localized("/departures", { changeFrequency: "daily", priority: 0.8 }),
    ...localized("/plan", { changeFrequency: "monthly", priority: 0.8 }),
    ...localized("/enquire", { changeFrequency: "monthly", priority: 0.7 }),
    ...localized("/policies", { changeFrequency: "monthly", priority: 0.4 }),
    ...POLICY_ORDER.flatMap((slug) =>
      localized(`/policies/${slug}`, {
        changeFrequency: "monthly",
        priority: 0.4,
      }),
    ),
  ];

  /*
    Journey detail pages are doc 03's "most important conversion asset", so they are
    listed at the highest priority below the home page. Fetched rather than hardcoded
    so publishing one in the admin is enough.
  */
  const journeys = await api.journeys("en");
  for (const journey of journeys ?? []) {
    if (!journey.is_published) continue;
    entries.push(
      ...localized(`/journeys/${journey.slug}`, {
        changeFrequency: "weekly",
        priority: 0.9,
      }),
    );
  }

  return entries;
}
