import { siteOrigin } from "@/lib/site-url";

/**
 * A thin strip saying this is not the real site yet.
 *
 * The deployment is going public so the team can test the interface in the field —
 * on a phone, on mobile data, in Pithoragarh. That is a good reason and this does not
 * get in its way: one line, no dialog, nothing to dismiss, no layout shift.
 *
 * It exists because of what is currently on the pages. Route statuses are seeded with
 * `verified_by = "DEMO DATA - not a real verification"`, and every scene photograph is
 * an AI placeholder. On any other site that is a cosmetic backlog. On this one the
 * whole proposition is that we tell the truth about a road people drive at altitude,
 * and a stranger who finds the status page has no way to know which parts are real.
 *
 * **It disappears by itself.** The condition is `isProvisional`, the same signal that
 * governs `robots.txt` — so the day decision O7 lands a domain, or somebody sets
 * `NEXT_PUBLIC_SITE_URL`, this stops rendering with no code change. There is no flag
 * to remember to unset before launch, which is the usual way a staging banner ends up
 * on a production site for a fortnight.
 *
 * If it interferes with what you are testing, set `NEXT_PUBLIC_HIDE_STAGING_NOTICE=1`
 * in Vercel. That is a deliberate act, which is the point.
 */
export function StagingNotice() {
  const { isProvisional } = siteOrigin();
  if (!isProvisional) return null;
  if (process.env.NEXT_PUBLIC_HIDE_STAGING_NOTICE === "1") return null;

  return (
    <p
      // Not marked `data-site-chrome`: the trip companion and family share pages hide
      // that, and those are the two pages where a reader is most likely to act on
      // what they see. `print:hidden` keeps it off the trip pack.
      className="bg-status-limited/15 px-4 py-1.5 text-center text-xs leading-relaxed text-ink-inverse/75 print:hidden"
    >
      Test site. Route status and photographs here are placeholders, not verified
      information — please do not plan travel from anything on this page.
    </p>
  );
}
