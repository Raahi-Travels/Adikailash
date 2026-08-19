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
    permitBody:
      "ज़िला पोर्टल ने इनर लाइन परमिट रोक दिए हैं, इसलिए इस समय च्यालेख से ऊपर कोई नहीं जा रहा, हम भी नहीं।",
    ask: "अपनी तारीख़ों के बारे में व्हाट्सएप पर पूछें",
  },
} as const;

/**
 * Lives outside the component because `Date.now()` in a component body is a read of
 * mutable global state, which the React compiler rejects: the same render would
 * produce a different result on a re-run, and that is exactly what memoisation
 * assumes cannot happen.
 */
function age(iso: string, locale: Locale) {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  const rtf = new Intl.RelativeTimeFormat(locale === "hi" ? "hi-IN" : "en-IN", {
    numeric: "auto",
  });
  if (mins < 60) return rtf.format(-Math.max(mins, 1), "minute");
  if (mins < 1440) return rtf.format(-Math.round(mins / 60), "hour");
  return rtf.format(-Math.round(mins / 1440), "day");
}

function Header({ title, everySegment }: { title: string; everySegment: string }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-5 gap-y-1">
      <h2 className="type-title-2 text-tone-on-glass">{title}</h2>
      <Link
        href="/status"
        className="type-meta text-tone-on-glass underline decoration-gold decoration-2 underline-offset-4 transition-colors hover:decoration-saffron"
      >
        {everySegment}
      </Link>
    </div>
  );
}

/**
 * One node on the road.
 *
 * A dot on a vertical rail rather than a row in a table, because the thing being
 * listed is a road and a road is a line. The rail is drawn by each node except the
 * last, which is why the connector is a child rather than a border on the list.
 */
function Node({
  name,
  detail,
  state,
  isLast,
  quiet = false,
}: {
  name: string;
  detail: string;
  state: LegState | null;
  isLast: boolean;
  quiet?: boolean;
}) {
  return (
    <li className="relative flex gap-3.5 pb-3 last:pb-0">
      {!isLast && (
        <span
          aria-hidden
          className="absolute bottom-0 left-[3.5px] top-3 w-px bg-tone-on-glass/25"
        />
      )}
      <span
        aria-hidden
        className="relative mt-[0.45rem] size-2 shrink-0 rounded-pill"
        style={{
          background: state ? STATE_COLOUR[state] : "var(--color-tone-on-glass)",
          boxShadow: quiet ? undefined : "0 0 0 3px oklch(1 0 0 / 0.08)",
        }}
      />
      <div className="flex min-w-0 flex-1 flex-wrap items-baseline justify-between gap-x-3">
        <span className="type-meta text-tone-on-glass">{name}</span>
        <span
          className={`type-meta text-tone-on-glass ${quiet ? "font-normal opacity-90" : "font-normal"}`}
        >
          {detail}
        </span>
      </div>
    </li>
  );
}

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
      <GlassPanel rim label={t.title} className="p-6 sm:p-7">
        <Header title={t.title} everySegment={t.everySegment} />
        <p className="type-body mt-4 text-tone-on-glass">{t.unreachable}</p>
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
    <GlassPanel rim label={t.title} className="p-6">
      <Header title={t.title} everySegment={t.everySegment} />

      {/*
        The headline reading, at the size a competitor would give a green tick.

        `.type-figure` is the site's one "measured number given weight" class, and
        the honest answer here is not a number, it is the absence of one. Setting it
        anyway is the whole argument of the page in one line.
      */}
      <p className="type-figure mt-4 text-tone-on-glass">
        {confirmed === 0 ? t.neverChecked : `${confirmed} ${t.of} ${legs.length}`}
      </p>
      <p className="type-body mt-2.5 text-tone-on-glass">
        {confirmed === 0 ? t.neverCheckedNote : t.confirmedNote}
      </p>

      {/*
        Not a ringed red box: that is a panel inside a panel, which the surface rules
        ban, and not a side stripe either, which the brief bans by name. On glass the
        suspended token measures about 1.9:1, so neither would have been legible as a
        signal. It gets the same dot the road nodes get, in front of a sentence that
        says the thing in words.
      */}
      {notIssuing && (
        <p className="type-meta measure-meta mt-4 flex gap-3.5 text-tone-on-glass">
          <span
            aria-hidden
            className="mt-[0.45rem] size-2 shrink-0 rounded-pill"
            style={{
              background: "var(--color-status-suspended)",
              boxShadow: "0 0 0 3px oklch(1 0 0 / 0.08)",
            }}
          />
          <span>
            <span className="font-semibold">{t.permitTitle}</span> {t.permitBody}
          </span>
        </p>
      )}

      <ul aria-label={t.railLabel} className="mt-6">
        {legs.map(({ station, status, state }, i) => (
          <Node
            key={station.slug}
            name={station.name}
            /*
              `legLabel` lives in `lib/route-profile.ts` and returns English for
              every state, so on /hi the one row a reader most needs would arrive in
              the wrong language. The unchecked case, which is every row today, is
              localised here; the four checked labels still need to move into the
              shared lib behind a locale, which is flagged rather than duplicated.
            */
            detail={
              status
                ? `${legLabel(status)}, ${age(status.verified_at, locale)}`
                : t.railNever
            }
            state={state}
            isLast={i === legs.length - 1}
          />
        ))}
      </ul>

      {/*
        The reason the list above is honest rather than lazy, in one line. It stays
        in the panel: a reader who does not know that nobody publishes road status
        above Tawaghat will read six "never checked" rows as neglect.
      */}
      {/* `measure-meta` caps this at 72ch. Without it the line ran to 76ch at
          768px, where the panel is full width and nothing else holds it in. */}
      <p className="type-meta measure-meta mt-5 text-tone-on-glass">{t.coverage}</p>
    </GlassPanel>
  );
}
