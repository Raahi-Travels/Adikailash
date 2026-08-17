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
      //
      // Carries `register-dark` rather than inheriting. It sits above the header, so
      // its background came from `<body>` and it would have rendered near-white text
      // on a pale tint the moment a light-register page changed what was underneath
      // it. A warning nobody can read is worse than no warning, so it states its own
      // register instead of trusting whatever it lands on.
      // Explicit colours, deriving nothing from the register or from whatever it lands
      // on. This strip spent a week as light text on cream, unreadable, because the
      // body's background was being set by an unlayered rule that outranked the
      // utility meant to control it. A warning is the last thing on a page that
      // should depend on the cascade going the way you expected.
      className="bg-[#2a1c10] px-4 py-2 text-center text-xs leading-relaxed text-[#e8dcc8] print:hidden"
    >
      Test site. No route status has been verified yet and the photographs are
      placeholders. Please do not plan travel from anything on this page.
    </p>
  );
}
