/**
 * Brand configuration primitives.
 *
 * Doc 02 requires every brand element to be replaceable configuration. Doc 09 adds
 * a second rule that matters just as much: agents must not invent business facts.
 * So a config value is not just `string | undefined` — it is either *settled* or
 * explicitly *undecided*, carrying the decision reference and owner from
 * docs/DECISIONS.md.
 *
 * The payoff: an undecided legal entity renders as a visible gap rather than a
 * plausible-looking guess, and `undecidedLaunchBlockers()` can fail a preflight
 * check instead of shipping a fabricated registration number to a customer.
 */

export type Settled<T> = {
  readonly status: "settled";
  readonly value: T;
};

export type Undecided = {
  readonly status: "undecided";
  /** Row in docs/DECISIONS.md, e.g. "O2". */
  readonly decisionRef: string;
  /** Who has to make the call. */
  readonly owner: string;
  /** What to show a visitor meanwhile. Must not imply a value exists. */
  readonly placeholder: string;
};

export type Configurable<T> = Settled<T> | Undecided;

/**
 * Brand copy that must exist in both languages.
 *
 * Identity and campaign lines are localized; legal entity, contact details and
 * domains are not, because a registered company name is not translated. Doc 02 gives
 * the Hindi campaign lines directly, so leaving the hero in English on /hi would be
 * a defect rather than missing content.
 */
export type LocalizedValue = { readonly en: string; readonly hi?: string };

export function localized(en: string, hi?: string): Settled<LocalizedValue> {
  return { status: "settled", value: hi ? { en, hi } : { en } };
}

/**
 * Text for a locale, falling back to English.
 *
 * Falls back rather than returning empty: an untranslated tagline should read in
 * English, not vanish.
 */
export function displayLocalized(
  c: Configurable<LocalizedValue>,
  locale: string,
): string {
  if (!isSettled(c)) return c.placeholder;
  if (locale === "hi" && c.value.hi) return c.value.hi;
  return c.value.en;
}

export function settled<T>(value: T): Settled<T> {
  return { status: "settled", value };
}

/**
 * Returns `Configurable<T>` rather than a bare `Undecided` so the *intended* value
 * type survives. Without this, `valueOf(brand.contact.whatsappNumber)` would widen
 * to `unknown` and every call site would need a cast.
 */
export function undecided<T = string>(
  decisionRef: string,
  owner: string,
  placeholder: string,
): Configurable<T> {
  return { status: "undecided", decisionRef, owner, placeholder };
}

export function isSettled<T>(c: Configurable<T>): c is Settled<T> {
  return c.status === "settled";
}

/** The settled value, or `null`. Callers must handle `null` — that is the point. */
export function valueOf<T>(c: Configurable<T>): T | null {
  return isSettled(c) ? c.value : null;
}

/**
 * Display text for a configurable string. Returns the placeholder when undecided,
 * so a page renders "Operator to be confirmed" rather than a guessed entity name.
 */
export function display(c: Configurable<string>): string {
  return isSettled(c) ? c.value : c.placeholder;
}

/**
 * Values that must be settled before the site can go public. Doc 09's launch
 * readiness checklist, expressed as something a build can actually assert.
 */
export type LaunchCriticalKey =
  | "legalEntityName"
  | "operatorDisclosure"
  | "domain"
  | "whatsappNumber"
  | "supportHours";
