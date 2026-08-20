import { GlassPanel } from "@/components/ui/surface";
import { Link } from "@/i18n/navigation";
import { api, type Locale, type LiveSources } from "@/lib/api";
import { whatsappLink } from "@/lib/brand";
import {
  legLabel,
  legStatus,
  STATE_COLOUR,
  STATIONS,
  type LegState,
} from "@/lib/route-profile";

/**
 * Live route status, in the hero. The instrument this site is built around.
 *
 * Doc 07 calls this the device that earns citations and repeat visits, which is why
 * it lands in the fold rather than below it, and why it lists the road leg by leg
 * rather than collapsing six answers into one badge. "Is the road open" has six
 * different answers on this route, and a traveller flying into Kathgodam next week
 * needs the one about their leg.
 *
 * **The empty state is the design, not a placeholder for it.** Every leg currently
 * reads "Never checked" because no coordinator has driven and confirmed one, and
 * that is the single most load-bearing fact on the page: an operator willing to
 * print "we have not checked" in 48px type is making a claim about itself that no
 * amount of "Safe & Trusted" badges can imitate. So the honest reading is set at
 * `.type-figure`, at the top, where a competitor would put a green tick.
 *
 * ---------------------------------------------------------------------------
 * Contrast, because this panel is the one place on the home page where it is not
 * obvious.
 * ---------------------------------------------------------------------------
 * `.glass` over the hero photograph composites to roughly 5.3:1 for snow-white
 * text. That is fine for `--color-tone-on-glass`, and it is *not* fine for
 * anything dimmer: `--color-tone-on-glass-muted` lands near 3.1:1 and the status
 * tokens, which were solved against flat midnight, land near 1.9:1. So nothing in
 * here is dimmed and no status label is coloured. Hierarchy is carried by size and
 * weight, and the status colour lives in the dot beside a label that already says
 * the same thing in words. Doc 02's rule holds either way: colour is never the
 * only carrier of a state.
 *
 * This is one of only three sanctioned glass surfaces on the site (the nav pill,
 * this, and a chip on a photograph). It earns one because it genuinely floats over
 * the picture and has to stay legible across every crop of it.
 */

const COPY = {
  en: {
    title: "Live route status",
    everySegment: "Every segment",
    neverChecked: "Never checked",
    neverCheckedNote:
      "No leg has been driven and confirmed by us yet.",
    confirmedNote: "legs confirmed by a coordinator who drove them.",
    of: "of",
    railLabel: "North from Pithoragarh, leg by leg",
    railNever: "Never checked",
    coverage:
      "Above Tawaghat no official source reports road status at all, so an unchecked leg is genuinely unknown to us.",
    unreachable:
      "We cannot reach our status service from here, so we are not going to guess at the road. Please speak to the team before making travel plans.",
    permitTitle: "Permits are not being issued.",
    permitShort: "The district portal has suspended Inner Line Permits.",
    legsLabel: "legs confirmed",
    permitBody:
      "The district portal has suspended Inner Line Permits, so nobody is travelling above Chiyalekh at the moment, us included.",
    ask: "Ask about your dates on WhatsApp",
  },
  hi: {
    title: "मार्ग की ताज़ा स्थिति",
    everySegment: "हर हिस्सा",
    neverChecked: "अब तक जाँच नहीं",
    neverCheckedNote:
      "हमने अभी तक कोई हिस्सा चलकर पुष्ट नहीं किया है।",
    confirmedNote: "हिस्से, जिन्हें समन्वयक ने खुद चलकर पुष्ट किया।",
    of: "में से",
    railLabel: "पिथौरागढ़ से उत्तर की ओर, हिस्सा दर हिस्सा",
    railNever: "अब तक जाँच नहीं",
    coverage:
      "तवाघाट से ऊपर कोई सरकारी स्रोत सड़क की स्थिति नहीं बताता, इसलिए बिना जाँचा हिस्सा हमारे लिए सचमुच अज्ञात है।",
    unreachable:
      "यहाँ से हमारी स्थिति सेवा तक नहीं पहुँच पा रहे, इसलिए हम सड़क के बारे में अनुमान नहीं लगाएँगे। यात्रा की योजना बनाने से पहले टीम से बात करें।",
    permitTitle: "परमिट जारी नहीं हो रहे।",
    permitShort: "ज़िला पोर्टल ने इनर लाइन परमिट रोक दिए हैं।",
    legsLabel: "हिस्से पुष्ट",
    permitBody:
      "ज़िला पोर्टल ने इनर लाइन परमिट रोक दिए हैं, इसलिए इस समय च्यालेख से ऊपर कोई नहीं जा रहा, हम भी नहीं।",
    ask: "अपनी तारीख़ों के बारे में व्हाट्सएप पर पूछें",
  },
} as const;

function Ask({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      className="type-meta mt-5 flex min-h-12 items-center justify-between gap-3 rounded-pill px-5 font-medium text-tone-on-glass shadow-[inset_0_0_0_1px_var(--glass-ring)] transition-transform duration-[var(--dur-press)] ease-standard hover:shadow-[inset_0_0_0_1px_var(--color-tone-line)] active:scale-[0.97] motion-reduce:transition-none motion-reduce:active:scale-100"
    >
      {label}
      <svg viewBox="0 0 16 16" className="size-4 shrink-0 text-gold" fill="none" aria-hidden>
        <path
          d="M3 8h9m0 0-3.2-3.2M12 8l-3.2 3.2"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </a>
  );
}

export function HeroStatus({
  data,
  live,
  locale,
}: {
  // Passed in rather than fetched here: the fact strip below the hero reports on the
  // same readings, and two components independently calling the status endpoint can
  // disagree by a verification if one lands either side of a coordinator's update.
  data: Awaited<ReturnType<typeof api.status>>;
  live: LiveSources | null;
  locale: Locale;
}) {
  const wa = whatsappLink({ intent: "status" });
  const t = COPY[locale] ?? COPY.en;

  /*
    Doc 08: "No false 'open' status on stale data." An unreachable service is a
    different thing from an unverified road, and the panel must not blur them: we
    can say "never checked" only when we have actually looked at our own records.
    So this branch says nothing about the road at all.
  */
  if (data === null) {
    return (
      <GlassPanel rim label={t.title} className="px-5 py-4 sm:px-6">
        <p className="type-meta measure-meta text-tone-on-glass">{t.unreachable}</p>
        {wa && <Ask href={wa} label={t.ask} />}
      </GlassPanel>
    );
  }

  const legs = STATIONS.filter((s) => s.from).map((station) => {
    const status = legStatus(data.routes, station);
    return { station, status, state: (status?.state ?? "unknown") as LegState };
  });

  const confirmed = legs.filter((l) => l.state !== "unknown").length;

  // Only from a reading we could actually refresh. A stale suspension notice would
  // keep turning away enquiries after the portal reopened, and the production host
  // is in a country this portal refuses to talk to, so "stale" is the normal case
  // rather than the rare one.
  const permit = live?.permit_portal;
  const notIssuing =
    permit != null &&
    !permit.is_stale &&
    (permit.payload as { is_issuing?: boolean | null }).is_issuing === false;

  return (
    /*
      A bar, not a panel, and the difference is the argument.

      This was a 550px ledger whose six rows all read "Never checked". Every word of
      it was true and it was in the wrong place: it occupied the right five columns
      of the hero, which is exactly where the sunlit massif sits, so the one
      photograph that could make somebody want to come was hidden behind a list of
      things we have not done. "Never checked" appeared thirteen times on this page
      before a reader met a single reason to go.

      Honesty is what earns trust once somebody wants to travel. It is not what
      makes them want to travel, and spending the desire slot on it bought neither.
      The live reading stays in the fold, because a competitor cannot fake it, and it
      stays to one line: the condition, the count, and a way through. The full ledger
      already exists twice further down this page and in full on /status.
    */
    <GlassPanel rim label={t.title} className="px-5 py-4 sm:px-6">
      <div className="flex flex-col gap-x-8 gap-y-3.5 lg:flex-row lg:items-center">
        {notIssuing ? (
          <p className="type-meta flex flex-1 items-start gap-3 text-tone-on-glass">
            {/* The same dot the road nodes carry. On glass the suspended token
                measures about 1.9:1, so colour marks the line and the words carry
                the meaning, never the other way round. */}
            <span
              aria-hidden
              className="mt-[0.4rem] size-2 shrink-0 rounded-pill"
              style={{
                background: "var(--color-status-suspended)",
                boxShadow: "0 0 0 3px oklch(1 0 0 / 0.08)",
              }}
            />
            <span>
              <span className="font-semibold">{t.permitTitle}</span> {t.permitShort}
            </span>
          </p>
        ) : (
          <p className="type-meta measure-meta flex-1 text-tone-on-glass">
            {t.coverage}
          </p>
        )}

        <p className="type-meta shrink-0 text-tone-on-glass">
          <span className="font-semibold">
            {confirmed} {t.of} {legs.length}
          </span>{" "}
          {t.legsLabel}
        </p>

        <Link
          href="/status"
          className="type-meta shrink-0 text-tone-on-glass underline decoration-gold decoration-2 underline-offset-4 transition-colors hover:decoration-saffron"
        >
          {t.everySegment}
        </Link>
      </div>
    </GlassPanel>
  );
}
