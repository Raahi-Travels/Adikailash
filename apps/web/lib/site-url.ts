/**
 * The canonical origin of this deployment.
 *
 * Sitemaps, `hreflang` and JSON-LD all need absolute URLs, and there is no honest
 * relative form of any of them, so the origin has to be resolved from what is
 * actually true right now rather than from a guess baked into a config file.
 *
 * **Deciding a domain and being reachable at one are different facts, and this file
 * used to conflate them.** A settled `brand.web.domain` flipped `isProvisional` to
 * false on its own, which turned indexing on and pointed every canonical at that
 * host. On 17 Aug 2026 decision O7 landed and the chosen domain had no DNS records
 * at all. Publishing then would have told search engines the canonical
 * home of every page was a host that does not resolve, and invited them to drop the
 * URL that works. That is expensive to undo and hard to notice.
 *
 * So the two facts are now separate signals:
 *
 *   - **`brand.web.domain`** records the decision. It clears O7 off the launch
 *     blockers and it is the origin we will use, but on its own it publishes
 *     nothing.
 *   - **`NEXT_PUBLIC_SITE_URL`** asserts that this deployment is actually served at
 *     that origin. Somebody sets it after DNS resolves, and that is what turns
 *     indexing on.
 *
 * Order, most to least authoritative:
 *
 *   1. `NEXT_PUBLIC_SITE_URL`. An assertion that the site is live here. Not
 *      provisional.
 *   2. `VERCEL_PROJECT_PRODUCTION_URL`, the stable project origin rather than the
 *      per-deployment one. `VERCEL_URL` changes on every push, and a sitemap full of
 *      deployment-specific URLs is worse than no sitemap. Provisional: nobody chose
 *      it.
 *   3. `brand.web.domain`, when there is no Vercel host to prefer. Provisional,
 *      because a decision is not a deployment.
 *   4. localhost, for development.
 *
 * `isProvisional` is what callers use to decide whether to emit canonical tags and
 * whether robots should allow indexing.
 */

// Imported from the concrete modules rather than the `@/lib/brand` barrel: that
// barrel re-exports `helpers`, which imports this file, and the cycle leaves one of
// them partially initialised at module-evaluation time.
import { brand } from "@/lib/brand/config";
import { valueOf } from "@/lib/brand/types";

export type SiteOrigin = {
  origin: string;
  /** True while the origin is not the settled public domain (decision O7). */
  isProvisional: boolean;
};

export function siteOrigin(): SiteOrigin {
  // The only thing that turns indexing on. Setting it is somebody saying "this
  // deployment answers at this origin", which is a claim about DNS and hosting that
  // no config file can make on its own.
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) {
    return { origin: explicit.replace(/\/$/, ""), isProvisional: false };
  }

  // Preferred over the settled domain while provisional, because any URL we emit
  // should at least be one that loads. A sitemap of unreachable URLs is worse than
  // one of ugly URLs.
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (vercel) return { origin: `https://${vercel}`, isProvisional: true };

  const domain = valueOf(brand.web.domain);
  if (domain) return { origin: `https://${domain}`, isProvisional: true };

  return { origin: "http://localhost:3000", isProvisional: true };
}

/** An absolute URL for a locale-prefixed path, e.g. `/en/journeys`. */
export function absolute(path: string): string {
  const { origin } = siteOrigin();
  return `${origin}${path.startsWith("/") ? path : `/${path}`}`;
}
