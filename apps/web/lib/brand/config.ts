/**
 * THE single source of brand truth.
 *
 * Doc 02: "Brand elements should never be hard-coded into individual pages, message
 * templates or transactional documents." Doc 03 launch acceptance #5: "A brand name
 * or logo change can be made centrally without editing every page."
 *
 * Rules for anyone editing this file:
 *  - Nothing outside this file may contain the brand name as a literal.
 *  - Module, route, table and env-var names stay neutral ("brand", not "sacredNorth").
 *  - Do not settle a value the founders have not actually decided. Mark it
 *    `undecided(...)` with its row from docs/DECISIONS.md.
 *
 * "The Sacred North" is a provisional working name (decision D3).
 */

import {
  type Configurable,
  type LaunchCriticalKey,
  isSettled,
  localized,
  settled,
  undecided,
} from "./types";

const FOUNDER_BRAND = "Brand founder";
const FOUNDER_OPS = "Operations founder";

export const brand = {
  identity: {
    /** Full public name. Provisional — see D3. */
    name: settled("The Sacred North"),
    /** Short form for tight spaces, nav and message templates. */
    shortName: settled("Sacred North"),
    /** One line describing what the company does, for meta and nav. */
    descriptor: localized(
      "Himalayan pilgrimages and transformative journeys",
      "हिमालयी तीर्थयात्राएँ और परिवर्तनकारी यात्राएँ",
    ),
    /**
     * Master brand line. Doc 02 offers four candidates and says to use one at a
     * time; this one is chosen because it leads with local roots, which is what
     * decision D5 puts at the centre of the product.
     * Alternatives: "Himalayan pilgrimages and transformative journeys",
     * "Between devotion and destination", "Journeys to the sacred heights".
     */
    tagline: localized("Sacred journeys, born in Kumaon", "कुमाऊँ से जन्मी पवित्र यात्राएँ"),
    /** Doc 02's working brand promise. */
    promise: localized(
      "We do not create the calling. We help you answer it.",
      "बुलावा उनका। यात्रा की ज़िम्मेदारी हमारी।",
    ),
  },

  /**
   * Doc 07: "The Kailash Call can remain a campaign even if the master brand
   * changes." Kept separate from identity for exactly that reason.
   */
  campaign: {
    flagship: {
      name: settled("The Kailash Call"),
      headline: localized(
        "Some journeys begin with a plan. Others begin with a calling.",
        "कुछ यात्राएँ योजना से शुरू होती हैं। कुछ बुलावे से।",
      ),
      /**
       * The same headline, split at the sentence break for display.
       *
       * Set as one block it runs to four lines in the hero at any size worth using,
       * and a four-line hero headline is a font-size error rather than a copy
       * problem. The rhetoric is already two-part: the first sentence sets up, the
       * second turns. Typography follows that, quiet lead into full-size turn, so
       * the line fits the fold without a word being cut. Both languages break at the
       * same place because both were written as two sentences.
       */
      headlineLead: localized(
        "Some journeys begin with a plan.",
        "कुछ यात्राएँ योजना से शुरू होती हैं।",
      ),
      headlineTurn: localized(
        "Others begin with a calling.",
        "कुछ बुलावे से।",
      ),
      support: localized(
        "Answer the call of Adi Kailash through a carefully guided journey rooted in the Himalaya.",
        "हिमालय में बसी, सावधानी से संचालित यात्रा के साथ आदि कैलाश के बुलावे का उत्तर दें।",
      ),
      primaryCta: localized("Explore the Journey", "यात्रा देखें"),
      secondaryCta: localized("Speak to a Journey Guide", "गाइड से बात करें"),
    },
  },

  /**
   * Doc 06: "The public website and customer documents must not imply that a
   * partner's registration belongs to the brand owner." Until O1 and O2 are
   * resolved, these render as explicit gaps.
   */
  legal: {
    entityName: undecided("O1", `${FOUNDER_BRAND} + adviser`, "Legal entity to be confirmed"),
    /** Per-departure disclosure overrides this default. */
    operatorDisclosure: undecided(
      "O2",
      FOUNDER_OPS,
      "Operating entity to be confirmed before booking opens",
    ),
    registrationNumber: undecided("O1", `${FOUNDER_BRAND} + adviser`, "not yet registered"),
    registeredAddress: undecided("O1", `${FOUNDER_BRAND} + adviser`, "Pithoragarh, Uttarakhand"),
    copyrightHolder: undecided("O1", FOUNDER_BRAND, "The Sacred North"),
  },

  contact: {
    /**
     * E.164, no spaces. Feeds wa.me links.
     *
     * This settles only the *human* half of O9: a number a traveller can message,
     * which a person answers. It is deliberately NOT evidence that the WhatsApp
     * Business Platform is wired up — that is a separate decision with a separate
     * consequence (see `docs/DECISIONS.md`, O9), and `sending_enabled` on the API
     * side stays false until a provider and token actually exist.
     */
    whatsappNumber: settled("+918340858764"),
    whatsappDisplayName: settled("The Sacred North"),
    phone: undecided("O10", FOUNDER_OPS, ""),
    supportEmail: undecided("O7", FOUNDER_BRAND, ""),
    /**
     * Doc 04: "It should not display a response promise that the team routinely
     * misses." Stays undecided until the founders commit to a rota.
     */
    supportHours: undecided("O10", FOUNDER_OPS, "Support hours to be confirmed"),
    baseCity: settled("Pithoragarh, Uttarakhand"),
  },

  web: {
    domain: undecided("O7", FOUNDER_BRAND, "example.invalid"),
    /** Appended to page titles: "Adi Kailash and Om Parvat — The Sacred North". */
    seoTitleSuffix: settled("The Sacred North"),
    defaultOgAlt: settled(
      "A pilgrim facing the Himalaya on the route to Adi Kailash",
    ),
  },

  social: {
    instagram: undecided("O7", FOUNDER_BRAND, ""),
    youtube: undecided("O7", FOUNDER_BRAND, ""),
    facebook: undecided("O7", FOUNDER_BRAND, ""),
  },

  locale: {
    /** D-pending O11. English first, Hindi as a first-class peer, not a subtitle. */
    defaultLanguage: settled("en"),
    languages: settled(["en", "hi"] as const),
  },

  finance: {
    currency: settled("INR"),
    /** Doc 09: deposits cannot be taken until O3 and O4 are approved. */
    paymentsEnabled: settled(false),
    paymentsBlockedReason: settled(
      "Deposit, refund and operator decisions (O2 to O4) are not yet approved.",
    ),
  },
} as const;

/**
 * Launch-critical values that are still undecided. Doc 09 treats a false or missing
 * operator claim as a severity-one trust defect, so this is meant to be asserted in
 * a preflight check before a production deploy — not merely logged.
 */
export function undecidedLaunchBlockers(): Array<{
  key: LaunchCriticalKey;
  decisionRef: string;
  owner: string;
}> {
  const checks: Array<[LaunchCriticalKey, Configurable<unknown>]> = [
    ["legalEntityName", brand.legal.entityName],
    ["operatorDisclosure", brand.legal.operatorDisclosure],
    ["domain", brand.web.domain],
    ["whatsappNumber", brand.contact.whatsappNumber],
    ["supportHours", brand.contact.supportHours],
  ];

  return checks
    .filter(([, value]) => !isSettled(value))
    .map(([key, value]) => {
      const u = value as Extract<Configurable<unknown>, { status: "undecided" }>;
      return { key, decisionRef: u.decisionRef, owner: u.owner };
    });
}

/** True once the brand config alone no longer blocks a public launch. */
export function isLaunchReady(): boolean {
  return undecidedLaunchBlockers().length === 0;
}
