/**
 * The canonical origin of this deployment.
 *
 * Sitemaps, `hreflang` and JSON-LD all need absolute URLs, and there is no honest
 * relative form of any of them. But decision O7 has not settled a domain, so the
 * origin has to be resolved from what is actually true right now rather than from a
 * guess baked into a config file.
 *
 * Order, most to least authoritative:
 *
 *   1. `brand.web.domain` once O7 lands. That is the answer.
 *   2. `NEXT_PUBLIC_SITE_URL`, so a preview or a staging host can be explicit.
 *   3. `VERCEL_PROJECT_PRODUCTION_URL`, the stable project origin rather than the
 *      per-deployment one. `VERCEL_URL` changes on every push, and a sitemap full of
 *      deployment-specific URLs is worse than no sitemap.
 *   4. localhost, for development.
 *
 * `isProvisional` is what callers use to decide whether to emit canonical tags and
 * whether robots should allow indexing. Publishing a canonical that points at a
 * preview host teaches search engines the wrong home for every page, and that is
 * expensive to undo.
 *
 * The line between provisional and not is **whether a human asserted this origin**.
 * A settled domain or an explicitly set `NEXT_PUBLIC_SITE_URL` is somebody saying
 * "this is the public home". An auto-detected Vercel host and localhost are not: no
 * one chose them, so nothing should be indexed under them.
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
  const domain = valueOf(brand.web.domain);
  if (domain) return { origin: `https://${domain}`, isProvisional: false };

  // Deliberately NOT provisional: setting this is an assertion, not a fallback.
  // Without that distinction the variable would set the origin while silently
  // leaving the site unindexable, which is the kind of half-working that costs a
  // launch week.
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) {
    return { origin: explicit.replace(/\/$/, ""), isProvisional: false };
  }

  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (vercel) return { origin: `https://${vercel}`, isProvisional: true };

  return { origin: "http://localhost:3000", isProvisional: true };
}

/** An absolute URL for a locale-prefixed path, e.g. `/en/journeys`. */
export function absolute(path: string): string {
  const { origin } = siteOrigin();
  return `${origin}${path.startsWith("/") ? path : `/${path}`}`;
}
