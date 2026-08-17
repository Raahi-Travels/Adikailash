import { siteOrigin } from "@/lib/site-url";

/**
 * robots.txt.
 *
 * A route handler rather than Next's `MetadataRoute.Robots`, because that type models
 * only user-agent, allow, disallow, sitemap and host — and the one directive here
 * that states our actual position, `Content-Signal`, is not expressible in it.
 * Writing the file is simpler than generating most of it and patching the rest.
 *
 * Three things are load-bearing.
 *
 * **The private paths.** `/admin`, `/booking`, `/documents`, `/trip`, `/family`,
 * `/feedback` and `/unsubscribe` are reached by a staff session or a private token. Disallowing them is not access control, and nothing
 * here is relied on for that: the API checks every request. This exists so a token in
 * a shared link never becomes an indexed page carrying a family's payment trail.
 *
 * **AI crawlers are allowed, and named.** Doc 07 treats answer engines as a
 * first-class channel, and the premise is that a page carrying verified route status
 * with timestamps and named verifiers is worth citing. Blocking GPTBot or
 * PerplexityBot to protect content nobody has found yet would be the wrong trade for
 * a site with no authority. They are listed explicitly rather than inheriting from
 * `*` so the intent is visible to whoever reads this next.
 *
 * Note `Google-Extended` is allowed deliberately: it governs Gemini training and
 * **blocking it does not affect Google Search rankings**, which is widely
 * misunderstood in the other direction.
 *
 * **`Content-Signal` declares downstream usage separately from access.** An IETF
 * draft (contentsignals.org), so nothing is obliged to honour it yet. We emit it
 * because it states the real trade: crawl us and cite us, do not train on us. A draft
 * standard nobody follows is still better than an implied permission nobody stated.
 */

export const revalidate = 3600;

const AI_CRAWLERS = [
  "GPTBot",
  "OAI-SearchBot",
  "ChatGPT-User",
  "PerplexityBot",
  "ClaudeBot",
  "Google-Extended",
  "CCBot",
];

//: Every path reached by a staff session or a capability token. This is NOT access
//: control — the API checks every request and each page also sends `noindex`. It
//: exists so a token pasted into a WhatsApp group never becomes an indexed page
//: carrying a family's itinerary or a traveller's private feedback.
const DISALLOW = [
  "/admin",
  "/booking",
  "/documents",
  "/trip",
  "/family",
  "/feedback",
  "/unsubscribe",
  "/api/",
  "/lab",
];

export function GET() {
  const { origin, isProvisional } = siteOrigin();

  /*
    While the origin is provisional (decision O7 open) the site is behind Vercel
    Authentication anyway, and nothing should be indexed under a host we intend to
    abandon. Disallowing everything is the honest state, not a placeholder.
  */
  if (isProvisional) {
    return text(
      [
        // O7 settled the domain on 17 Aug 2026. What has not happened is DNS: the
        // deployment is not being served at that origin yet, and until it is, this
        // host is not the public site. Naming the reason accurately matters because
        // the previous wording ("O7 has not settled a domain") became false the
        // moment the decision landed, and a stale explanation in a file nobody reads
        // is how a site stays unindexed for a month after it was ready.
        "# This origin is not the public site. The settled domain does not serve this",
        "# deployment yet; set NEXT_PUBLIC_SITE_URL once it does.",
        "User-agent: *",
        "Disallow: /",
        "",
      ].join("\n"),
    );
  }

  const block = (agent: string) =>
    [`User-agent: ${agent}`, "Allow: /", ...DISALLOW.map((p) => `Disallow: ${p}`), ""].join("\n");

  const body = [
    "Content-Signal: ai-train=no, search=yes, ai-retrieval=yes",
    "",
    block("*"),
    "# Answer engines are welcome. The status page is meant to be cited.",
    ...AI_CRAWLERS.map(block),
    `Sitemap: ${origin}/sitemap.xml`,
    `Host: ${origin}`,
    "",
  ].join("\n");

  return text(body);
}

function text(body: string) {
  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
