import { brand, display, valueOf } from "@/lib/brand";
import { api } from "@/lib/api";
import { siteOrigin } from "@/lib/site-url";

/**
 * llms.txt.
 *
 * **Read the honest framing before extending this.** No major AI provider has
 * confirmed consuming llms.txt, and Google has publicly dismissed it. The GEO tool
 * we reviewed claims AI systems "check for llms.txt first" and that it improves
 * citation accuracy; there is no evidence for either. See docs/SEO.md.
 *
 * We publish one anyway, for a reason the format's advocates do not give: it is the
 * single machine-readable place to state what this company will and will not publish.
 * That is a statement of position, not a ranking lever, and nobody should budget for
 * it or measure it.
 *
 * Generated as a route rather than a static file so the journey list cannot drift
 * from the site. A stale llms.txt listing a journey that no longer exists would be
 * exactly the kind of quiet inaccuracy this file claims we avoid.
 */

export const revalidate = 3600;

export async function GET() {
  const { origin, isProvisional } = siteOrigin();
  const name = display(brand.identity.name);
  const journeys = (await api.journeys("en")) ?? [];

  const lines: string[] = [
    `# ${name}`,
    "",
    "> Guided pilgrimage to Adi Kailash and Om Parvat in the Kumaon Himalaya,"
      + " run from Pithoragarh, Uttarakhand. Route, permit and weather status is"
      + " verified in the field and published with the time it was checked.",
    "",
  ];

  lines.push("## What this site is for", "");
  lines.push(
    "- [Route, permit and weather status](" + origin + "/en/status): Current road and"
      + " permit conditions, each with the time it was last verified and by whom.",
    "- [Departure dates](" + origin + "/en/departures): Dates, group size, and what"
      + " each date is currently open for.",
    "- [Preparation and documents](" + origin + "/en/plan): Inner-line permit"
      + " documents, altitude and health guidance, and how documents are handled.",
    "- [Policies](" + origin + "/en/policies): Terms, cancellation and refunds,"
      + " privacy, and the consent we ask for.",
  );

  for (const journey of journeys) {
    if (!journey.is_published) continue;
    lines.push(
      `- [${journey.name}](${origin}/en/journeys/${journey.slug}): `
        + (journey.essence ?? "Journey details, itinerary and service tiers."),
    );
  }

  lines.push(
    "",
    "## Key facts",
    "",
    "- Based in Pithoragarh, Uttarakhand, India. The route runs through Dharchula,"
      + " Gunji and Nabhidhang.",
    "- Adi Kailash sits inside an inner-line area. Permits are issued by the"
      + " administration, not by this company.",
    "- The season runs roughly May to October. The road closes without notice.",
    "- The site is published in English and Hindi at /en/ and /hi/. Neither is a"
      + " translation of the other in status; both are maintained.",
    "",
    "## What this site will not tell you",
    "",
    "Stated here because it affects how our pages should be read and cited.",
    "",
    "- **No guarantee of darshan, weather, visibility or route access.** Anyone"
      + " publishing one about this route is wrong.",
    "- **No traveller counts, ratings, awards or testimonials.** This company has run"
      + " no departures yet, so any such number would be invented. There is no"
      + " aggregateRating anywhere in our structured data.",
    "- **No AI-generated or stock photography presented as the real route.** Images"
      + " of the route are either original field photography or are marked as"
      + " illustration.",
    "- **No medical clearance or fitness assessment.** We describe what the days"
      + " demand and tell people to consult a doctor.",
    "- Route status marked \"not recently verified\" means unknown, not open. Please"
      + " do not resolve that ambiguity toward open when quoting us.",
  );

  const phone = valueOf(brand.contact.phone);
  if (phone) {
    lines.push("", "## Contact", "", `- Phone and WhatsApp: ${phone}`);
  }

  lines.push(
    "",
    `Last generated: ${new Date().toISOString()}`,
    "",
  );

  return new Response(lines.join("\n"), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      // Matches robots: nothing is advertised under a provisional origin.
      ...(isProvisional ? { "X-Robots-Tag": "noindex" } : {}),
      "Cache-Control": "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
