import { setRequestLocale } from "next-intl/server";

import { HeroStatus } from "@/components/hero-status";
import { JourneyCard } from "@/components/journey-card";
import { RouteProfile } from "@/components/route-profile";
import { SceneBackdrop } from "@/components/scene";
import { TerrainField } from "@/components/terrain-field";
import { PrimaryAction, QuietAction } from "@/components/ui/action";
import { Band, BleedGrid, Constellation, Content } from "@/components/ui/band";
import { PhotoFigure } from "@/components/ui/figure";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { api, type Locale } from "@/lib/api";
import { brand, displayLocalized, whatsappLink } from "@/lib/brand";
import { HIGHEST, legStatus, STATIONS } from "@/lib/route-profile";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

/**
 * The landing page.
 *
 * It has one job: say that this is a real place, reached by a real road, reported
 * honestly, in a single scroll. The structure follows from that rather than from a
 * template.
 *
 * **The register alternation is the argument.** Navy carries what we have verified
 * (the road, the altitudes, the readings); snow carries what we are offering (the
 * journeys, the rooms). A visitor who never reads a word of this still learns that
 * the site distinguishes between the two, because the ground under their feet
 * changes when the claim changes. That is also why there is not a single hairline
 * rule between sections: the register change *is* the divider.
 *
 * **Nothing here is a card grid.** Three equal boxes in a row is the fastest way to
 * make a page read as generated, so the journeys sit in the constellation, the
 * homestay photograph escapes the reading column to the right edge, and the four
 * hero readings are one figure plus three meta pairs rather than four matching
 * cells. Only one of those four is a measured number worth 48px; pretending
 * otherwise is what made the old strip look like a stats bar on a SaaS page.
 *
 * **Every heading reads from the data.** "Three ways into the sacred Kumaon" was
 * hardcoded above a list fetched at request time, so an empty catalogue would have
 * rendered a page contradicting its own title. The count comes from the array now.
 *
 * Page copy lives in this file rather than in `messages/*.json`, which is where the
 * spec wants it. That move touches a shared file and a shared check, so it is
 * flagged rather than done here; the shape below is a straight lift once the keys
 * exist.
 */

const COUNT_WORD: Record<Locale, readonly string[]> = {
  en: ["No", "One", "Two", "Three", "Four", "Five", "Six", "Seven"],
  hi: ["कोई", "एक", "दो", "तीन", "चार", "पाँच", "छह", "सात"],
};

function counted(n: number, locale: Locale) {
  return COUNT_WORD[locale][n] ?? String(n);
}

const COPY = {
  en: {
    journeysHeading: (n: number, locale: Locale) =>
      n === 0
        ? "The ways into the sacred Kumaon"
        : n === 1
          ? "One way into the sacred Kumaon"
          : `${counted(n, locale)} ways into the sacred Kumaon`,
    journeysLead:
      "Each of these is published only once its itinerary, its altitudes and every night of accommodation have been confirmed by our operations team.",
    journeysEmpty:
      "Journeys are still being prepared. Nothing is published here until the itinerary, altitudes and accommodation have been confirmed by our operations team.",
    homestayHeading: "The room is the point, not the compromise",
    homestayLead:
      "Most operators apologise for the accommodation above Dharchula. There are no luxury hotels on this road, and anyone who tells you otherwise has not been.",
    homestayCaption:
      "A host family's kitchen in a Kumaon village. Photograph pending the field trip.",
    homestayBody: [
      "We built a journey around that instead. Nights with host families, food from their kitchen, conversation with people whose grandparents walked these passes. The money stays in the household rather than reaching a chain.",
      "We will tell you exactly what each stay has and does not have: hot water, heating, network, whether the bathroom is shared. No surprises at 3,500 metres.",
    ],
    homestayLink: "See the homestay journey",
    routeHeading: "From 910 metres to four and a half thousand",
    routeLead:
      "The drive drops into the Kali gorge before it climbs, and above Gunji it forks: one arm to Jyolingkong below Adi Kailash, the other to Nabhidhang for Om Parvat. This is what your body is being asked to do.",
    routeLink: "Every segment, with who checked it",
    closeLead: "Talk to someone who lives in Pithoragarh and has driven this road.",
    factHighest: "Highest ground",
    factHighestNote: "Jyolingkong, the base below Adi Kailash",
    factDocs: "Documents required",
    factDocsNote: "Inner-line permit area",
    factDocsPending: "Being confirmed",
    factLegs: "Legs confirmed",
    factLegsNote: "Anything else is unknown to us",
    factChecked: "Last checked",
    factCheckedNote: "By a coordinator, on the ground",
    notYet: "not yet",
    about: "about",
    metres: "m",
    of: "of",
  },
  hi: {
    journeysHeading: (n: number, locale: Locale) =>
      n === 0
        ? "पवित्र कुमाऊँ में प्रवेश के रास्ते"
        : `पवित्र कुमाऊँ में प्रवेश के ${counted(n, locale)} रास्ते`,
    journeysLead:
      "इनमें से हर यात्रा तभी प्रकाशित होती है जब उसका कार्यक्रम, ऊँचाइयाँ और हर रात की ठहरने की व्यवस्था हमारी संचालन टीम पुष्ट कर दे।",
    journeysEmpty:
      "यात्राएँ अभी तैयार की जा रही हैं। कार्यक्रम, ऊँचाइयाँ और ठहरने की व्यवस्था पुष्ट होने तक यहाँ कुछ प्रकाशित नहीं होता।",
    homestayHeading: "कमरा ही असली बात है, कोई समझौता नहीं",
    homestayLead:
      "धारचूला से ऊपर ठहरने की व्यवस्था के लिए ज़्यादातर संचालक माफ़ी माँगते हैं। इस सड़क पर कोई विलासिता वाला होटल नहीं है, और जो कहे कि है, वह वहाँ गया ही नहीं।",
    homestayCaption:
      "कुमाऊँ के एक गाँव में मेज़बान परिवार की रसोई। असली तस्वीर क्षेत्र यात्रा के बाद।",
    homestayBody: [
      "हमने इसी के इर्द-गिर्द यात्रा बनाई। रातें मेज़बान परिवारों के साथ, खाना उनकी रसोई का, बातचीत उन लोगों से जिनके दादा-परदादा इन दर्रों पर चले। पैसा किसी शृंखला तक पहुँचने के बजाय घर में ही रहता है।",
      "हम आपको ठीक-ठीक बताएँगे कि हर ठहराव में क्या है और क्या नहीं: गरम पानी, हीटिंग, नेटवर्क, बाथरूम साझा है या नहीं। 3,500 मीटर पर कोई आश्चर्य नहीं।",
    ],
    homestayLink: "होमस्टे यात्रा देखें",
    routeHeading: "910 मीटर से साढ़े चार हज़ार तक",
    routeLead:
      "सड़क चढ़ाई से पहले काली नदी की खाई में उतरती है, और गुंजी से ऊपर दो हिस्सों में बँट जाती है: एक आदि कैलाश के नीचे ज्योलिंगकोंग तक, दूसरा ओम पर्वत के लिए नाभीढांग तक। आपके शरीर से यही माँगा जा रहा है।",
    routeLink: "हर हिस्सा, और किसने जाँचा",
    closeLead:
      "उस व्यक्ति से बात करें जो पिथौरागढ़ में रहता है और इस सड़क पर गाड़ी चला चुका है।",
    factHighest: "सबसे ऊँचा स्थान",
    factHighestNote: "ज्योलिंगकोंग, आदि कैलाश के नीचे का पड़ाव",
    factDocs: "ज़रूरी दस्तावेज़",
    factDocsNote: "इनर लाइन परमिट क्षेत्र",
    factDocsPending: "पुष्ट किया जा रहा है",
    factLegs: "पुष्ट हिस्से",
    factLegsNote: "बाकी सब हमारे लिए अज्ञात है",
    factChecked: "पिछली जाँच",
    factCheckedNote: "समन्वयक द्वारा, मौके पर",
    notYet: "अभी नहीं",
    about: "लगभग",
    metres: "मी",
    of: "में से",
  },
} as const;

/**
 * Hours since the newest verification, in words.
 *
 * Lives outside the component because `Date.now()` in a component body is a read of
 * mutable global state, which the React compiler rejects: the same render would
 * produce a different result on a re-run, and that is exactly what memoisation
 * assumes cannot happen.
 */
function since(iso: string | null | undefined, locale: Locale) {
  if (!iso) return COPY[locale].notYet;
  const hours = Math.max(
    1,
    Math.round((Date.now() - new Date(iso).getTime()) / 3_600_000),
  );
  const rtf = new Intl.RelativeTimeFormat(locale === "hi" ? "hi-IN" : "en-IN", {
    numeric: "auto",
  });
  return hours < 48
    ? rtf.format(-hours, "hour")
    : rtf.format(-Math.round(hours / 24), "day");
}

/**
 * One of the three supporting readings under the hero.
 *
 * Deliberately *not* the same shape as the figure beside them. The mockups all put
 * four matching icon-and-heading trust pillars here ("Safe & Trusted", "Family
 * Friendly"), and every one of those is a claim any operator can make for free,
 * which is why they persuade nobody. These are readings instead: they change, they
 * carry a time, and a competitor cannot copy them by editing their homepage.
 */
function Reading({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div>
      <dt className="type-meta text-tone-muted">{label}</dt>
      <dd className="type-reading type-title-2 mt-1 text-tone-strong">{value}</dd>
      <dd className="type-meta mt-1.5 max-w-[28ch] text-tone-body">{note}</dd>
    </div>
  );
}

function Arrow() {
  return (
    <svg viewBox="0 0 16 16" className="size-4 shrink-0" aria-hidden="true" fill="none">
      <path
        d="M3 8h9m0 0-3.2-3.2M12 8l-3.2 3.2"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * The one inline link shape on this page.
 *
 * Gold is unreadable as text on the light register: #c89a4e against snow is about
 * 2.4:1, well under the 4.5:1 body minimum. Rather than introducing a second accent
 * or flipping colour per register, the link keeps full-contrast ink and carries
 * gold as the underline, so the accent still does the pointing and the words stay
 * legible on both grounds.
 */
function InlineLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      /* `min-h-11` is the tap target, not the type. This measured 20.3px tall on
         a phone, and it is a standalone call to action rather than a link inside
         a sentence, so the 44px floor applies to it. The underline sits where it
         always did: the extra height is padding around the words. */
      className="type-meta inline-flex min-h-11 items-center gap-2 font-medium text-tone-strong underline decoration-gold decoration-2 underline-offset-[6px] transition-colors hover:decoration-saffron"
    >
      {children}
      <Arrow />
    </Link>
  );
}

export default async function Home({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const typed = locale as Locale;
  const t = COPY[typed] ?? COPY.en;

  const [journeys, checklist, status, live] = await Promise.all([
    api.journeys(typed),
    api.permitChecklist(typed),
    api.status(typed),
    api.live(typed),
  ]);
  const wa = whatsappLink({ intent: "journey" });
  const campaign = brand.campaign.flagship;

  const legs = STATIONS.filter((s) => s.from);
  const confirmed = status
    ? legs.filter((s) => {
        const leg = legStatus(status.routes, s);
        return leg && leg.state !== "unknown";
      }).length
    : 0;
  const mandatory = checklist?.requirements.filter((r) => r.is_mandatory).length ?? 0;

  return (
    // `data-hero-page`: the nav pill is fixed and the photograph runs under it, so
    // this page opts out of the layout's automatic top clearance. It also turns on
    // the page-level top scrim that keeps the pill legible at rest.
    <main id="main" data-hero-page className="flex-1">
      {/*
        1. THE HERO. Dark register: everything in it is either a photograph of the
        ground or a reading taken from it.

        The photograph is not behind the text, it is what the section is made of: it
        runs full bleed under the floating nav, dissolves upward into midnight
        instead of ending on a crop line, and the contour field drifts over it in
        the same visual language as the elevation profile further down. The status
        panel floats on the bright right-hand side of the frame, which is the one
        thing glass is actually for.
      */}
      <section
        data-register-mark="dark"
        className="register-dark relative isolate overflow-hidden"
        // The pill takes no space, so the hero has to buy its own clearance. As an
        // inline calc rather than a `pt-*` utility because `--chrome-top` is
        // measured at runtime (the staging notice is not there in production) and
        // no breakpoint can express that.
        style={{
          paddingBlockStart:
            "calc(var(--chrome-top) + var(--nav-h) + var(--nav-inset) * 2 + 1.5rem)",
        }}
      >
        <SceneBackdrop
          name="hero"
          // The scene's own focus (62% 46%) leaves the sunlit massif just outside
          // the right edge of the crop at desktop widths, so the hero reads as navy
          // sky with a rumour of a mountain. Pushed right until the lit ridge sits
          // in the frame. This wants to move into `lib/imagery.ts` as the scene's
          // focus, which is a shared file: flagged, not edited here.
          position="object-[86%_48%]"
          scrim="left"
          sizes="(min-width: 1024px) 1440px, calc(100vw * 1.35)"
        />
        <TerrainField />

        <Content className="relative flex flex-col justify-end pb-[var(--band-y-tight)]">
          {/*
            On a phone the photograph is a band across the top and the words sit
            below it on solid navy: putting type over a picture at 390px means
            darkening the picture until nobody can see it, which loses both. The
            band is 320px, so the copy starts clear of it.
          */}
          <div className="grid items-end gap-x-[clamp(2rem,4vw,4rem)] gap-y-[var(--stack-block)] pt-[11.5rem] sm:pt-[var(--band-y-tight)] lg:grid-cols-12">
            <div className="lg:col-span-7">
              <p className="type-title-2 max-w-[22ch] text-tone-body">
                {displayLocalized(campaign.headlineLead, locale)}
              </p>
              <h1 className="type-display glow-display mt-2 max-w-[15ch] text-tone-strong">
                {displayLocalized(campaign.headlineTurn, locale)}
              </h1>
              <p className="type-lead mt-[var(--stack-title)] text-tone-body">
                {displayLocalized(campaign.support, locale)}
              </p>
              <div className="mt-[var(--stack-block)] flex flex-wrap items-center gap-3">
                <PrimaryAction href="/journeys">
                  {displayLocalized(campaign.primaryCta, locale)}
                </PrimaryAction>
                <QuietAction href={wa ?? "/enquire"}>
                  {displayLocalized(campaign.secondaryCta, locale)}
                </QuietAction>
              </div>
            </div>

            <div className="lg:col-span-5">
              <HeroStatus data={status} live={live} locale={typed} />
            </div>
          </div>

        </Content>
      </section>

      {/*
        THE READINGS. Still navy, still the hero's own argument, but out of the
        photograph's section.

        They give the headline the context the founder said it was missing: "Others
        begin with a calling" says nothing about where you would be going, and
        4,570 m, four documents and a date do.

        Out of the picture's section because `hero.webp` is a 21:9 panorama and the
        photograph is `absolute inset-0` of whatever contains it: every extra
        hundred pixels of text in that section is a hundred pixels of horizontal
        crop thrown away, and at the height this content wanted, the range was
        cropped down to a sliver of sky. The section change costs nothing visually,
        since both grounds are midnight and the register does not change.

        One figure and three meta pairs, not four matching cells. Three of these
        currently read "0 of 6" and "not yet", and giving those the same weight as
        the altitude would be dressing an absence up as a statistic.
      */}
      <section
        data-register-mark="dark"
        className="register-dark band--tight relative isolate overflow-hidden"
      >
        <Content>
          <dl className="grid gap-x-[clamp(2rem,4vw,4rem)] gap-y-[var(--space-lg)] lg:grid-cols-12">
            <div className="lg:col-span-4">
              <dt className="type-meta text-tone-muted">{t.factHighest}</dt>
              <dd className="type-figure mt-2 text-tone-strong">
                {t.about} {HIGHEST.altitudeM.toLocaleString("en-IN")} {t.metres}
              </dd>
              <dd className="type-meta mt-2 max-w-[30ch] text-tone-body">
                {t.factHighestNote}
              </dd>
            </div>

            <div className="grid gap-x-[clamp(2rem,4vw,3rem)] gap-y-[var(--space-lg)] sm:grid-cols-3 lg:col-span-8 lg:pt-1">
              <Reading
                label={t.factDocs}
                value={mandatory > 0 ? String(mandatory) : t.factDocsPending}
                note={t.factDocsNote}
              />
              <Reading
                label={t.factLegs}
                value={`${confirmed} ${t.of} ${legs.length}`}
                note={t.factLegsNote}
              />
              <Reading
                label={t.factChecked}
                value={since(status?.as_of, typed)}
                note={t.factCheckedNote}
              />
            </div>
          </dl>
        </Content>
      </section>

      {/*
        2. THE JOURNEYS. Light register: this is what we are offering, not what we
        have verified, and the ground says so before a word is read.
      */}
      <Band register="light" glow grain>
        <Content>
          <h2 className="type-title-1 max-w-[18ch]">
            {t.journeysHeading(journeys?.length ?? 0, typed)}
          </h2>

          {journeys && journeys.length > 0 ? (
            <>
              <p className="type-lead mt-[var(--stack-title)] text-tone-body">
                {t.journeysLead}
              </p>
              {/*
                The constellation, not a three-across grid. Unequal spans and
                unequal vertical offsets, so each photograph gets a different crop
                and the row stops reading as one template printed three times.
              */}
              <Constellation className="reveal mt-[var(--stack-block)]">
                {journeys.map((journey) => (
                  <JourneyCard key={journey.id} journey={journey} />
                ))}
              </Constellation>
            </>
          ) : (
            <p className="type-body mt-[var(--stack-title)] text-tone-body">
              {t.journeysEmpty}
            </p>
          )}
        </Content>
      </Band>

      {/*
        3. THE ROOM. Still light: an offer, not a reading.

        The page's one sanctioned grid break. The photograph leaves the reading
        column and runs to the viewport edge, feathering into the snow ground at its
        foot rather than ending on a rounded rectangle, and the argument continues
        underneath it. A picture bordered on four sides reads as an illustration
        dropped into an article; one that leaves the frame reads as the room the
        paragraph is describing.
      */}
      <Band register="light" tight>
        <BleedGrid>
          <div>
            <h2 className="type-title-1 max-w-[18ch]">{t.homestayHeading}</h2>
            <p className="type-lead mt-[var(--stack-title)] text-tone-body">
              {t.homestayLead}
            </p>
          </div>

          <PhotoFigure
            name="homestay-kitchen"
            register="light"
            className="reveal pop-right mt-[var(--stack-block)]"
            caption={t.homestayCaption}
            sizes="(min-width: 1024px) 68vw, calc(100vw * 1.35)"
          />

          <div className="mt-[var(--stack-block)]">
            {t.homestayBody.map((para) => (
              <p key={para} className="type-body mt-[var(--space-md)] first:mt-0 text-tone-body">
                {para}
              </p>
            ))}
            <div className="mt-[var(--space-lg)]">
              <InlineLink href="/journeys/homestay-immersion">{t.homestayLink}</InlineLink>
            </div>
          </div>
        </BleedGrid>
      </Band>

      {/*
        4. THE ROAD, AS ELEVATION. Back to navy, because everything in this band is
        a verified reading with a time on it.

        This is the section the redesign exists for. Altitude is the risk on this
        road and a four-cell table of badges never said so.
      */}
      <Band register="dark" id="route">
        <Content>
          <h2 className="type-title-1 max-w-[19ch] text-tone-strong">{t.routeHeading}</h2>
          <p className="type-body mt-[var(--stack-title)] max-w-[62ch] text-tone-body">
            {t.routeLead}
          </p>

          <div className="reveal mt-[var(--stack-block)]">
            <RouteProfile routes={status?.routes ?? []} locale={locale} />
          </div>

          <div className="mt-[var(--space-xl)]">
            <InlineLink href="/status">{t.routeLink}</InlineLink>
          </div>
        </Content>
      </Band>

      {/*
        5. THE CLOSE, on the checkpost barrier below Chiyalekh.

        The actual gate this whole page has been describing, and the last thing a
        traveller sees before the part we cannot promise anything about. A centred
        paragraph on bare navy is where a page goes to end; this is where it asks
        for something.
      */}
      <section
        data-register-mark="dark"
        className="register-dark band relative isolate overflow-hidden"
      >
        <SceneBackdrop
          name="permits"
          scrim="centre"
          motion={false}
          sizes="(min-width: 1024px) 1440px, calc(100vw * 1.35)"
        />
        <Content className="relative flex flex-col items-center text-center">
          <p className="type-title-1 max-w-[17ch] text-balance text-tone-strong">
            {displayLocalized(brand.identity.promise, locale)}
          </p>
          <p className="type-lead mt-[var(--stack-title)] text-tone-body">{t.closeLead}</p>
          <div className="mt-[var(--stack-block)]">
            <PrimaryAction href="/enquire">
              {displayLocalized(campaign.secondaryCta, locale)}
            </PrimaryAction>
          </div>
        </Content>
      </section>
    </main>
  );
}
