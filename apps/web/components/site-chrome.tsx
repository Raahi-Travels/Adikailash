import { getTranslations } from "next-intl/server";

import { NavRegister } from "@/components/nav-register";
import { NavSheet, type SheetLink } from "@/components/nav-sheet";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/lib/api";
import { brand, display, displayLocalized, whatsappLink } from "@/lib/brand";

/** Mark: three peaks and a guiding star. One colour, legible at favicon size. */
function Mark({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true" fill="none">
      <path
        d="M2 25.5 11 9l5.5 10L20 13l10 12.5z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M23 6.5v5M20.5 9h5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * Five links, and the ceiling is six.
 *
 * Five plus a language switch plus a call to action is already at the width the
 * pill can hold before Hindi labels start wrapping. Adding a seventh does not make
 * the bar longer, it makes the bar break.
 */
const NAV = [
  { href: "/journeys", key: "journeys" },
  { href: "/departures", key: "departures" },
  { href: "/status", key: "liveStatus" },
  { href: "/guides", key: "guides" },
  { href: "/plan", key: "planYourJourney" },
] as const;

/** The two links the footer carries, repeated in the mobile sheet so it is a map. */
const FOOTER_NAV: SheetLink[] = [
  { href: "/private", label: "Private groups and international travellers" },
  { href: "/partners", label: "Ground handling for agencies" },
];

/**
 * The header.
 *
 * **One floating glass pill.** The founder's brief was four things: "rounded edges,
 * no borders, slightly glassmorphic but not too much because it's a travel website".
 * The bar this replaces was the opposite of all four: square, full-bleed, hard
 * bottom border, flat 95% navy.
 *
 * So: `--radius-pill` at both breakpoints, **zero** `border-*` declarations
 * anywhere in this file (the edge is an inset highlight plus a hairline ring at 0.14
 * alpha, which is what `.glass` supplies), and a tint that sits at 0.50 over a hero
 * and 0.62 once you scroll, rather than the wall of blur that reads as an operating
 * system rather than as a road.
 *
 * `fixed` rather than `sticky` because it has to float clear of the content, and
 * because a hero should run *under* it. Pages whose first section is a full-bleed
 * hero say so with `data-hero-page` on their `<main>`; every other page gets its
 * clearance from one rule in `globals.css` rather than from a `pt-24` repeated
 * twenty times.
 *
 * Nothing here listens to scroll. See `components/nav-register.tsx`.
 */
export async function SiteHeader({ locale }: { locale: Locale }) {
  const t = await getTranslations("nav");
  const tc = await getTranslations("common");
  const other: Locale = locale === "en" ? "hi" : "en";
  const wa = whatsappLink({ intent: "journey" });
  const wordmark = display(brand.identity.shortName);

  const links: SheetLink[] = NAV.map((item) => ({ href: item.href, label: t(item.key) }));

  return (
    <>
      <NavRegister />

      {/*
        The scroll sentinel, in document flow but out of layout: 24px tall, pinned
        to the top of the page, absolutely positioned so it occupies no space. When
        it leaves the viewport the pill lifts. This is what a scroll listener would
        otherwise be for, and it costs nothing per frame.
      */}
      <div
        data-nav-sentinel
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-6"
      />

      {/*
        The top scrim.

        Always rendered on a hero page, never animated, hidden entirely on pages
        with no hero (the `:has()` rule in globals.css) because a navy wash across
        the top of a cream page is a bruise. Measured: this plus the 0.50 tint gives
        snow text 4.96:1 over the brightest sky in the hero photograph, which is the
        floor and it passes. Without it the at-rest pill is unreadable over snow
        peaks, and turning the tint up instead is how you end up with the opaque bar
        this replaced.
      */}
      <div
        data-nav-scrim
        data-nav-state="rest"
        aria-hidden
        className="pointer-events-none fixed inset-x-0 top-0 z-30 h-28 transition-opacity duration-[var(--dur-base)] ease-standard data-[nav-state=lifted]:opacity-0"
      />

      <header
        data-site-chrome
        className="pointer-events-none fixed inset-x-0 z-40 flex justify-center px-3 sm:px-6"
        style={{ top: "calc(var(--chrome-top) + var(--nav-inset))" }}
      >
        <a
          href="#main"
          /* `outline-offset-0` rather than the global 2px. This chip floats over
             the nav pill and whatever photograph is behind it, so at 2px the ring
             sits in a gap showing the glass and measured as low as 1.02:1 against
             it at 390. Flush to the chip, the ring's inner neighbour is the chip's
             own snow, which is 4.39:1 and does not depend on the page underneath. */
          className="type-meta pointer-events-auto sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-3 focus:z-50 focus:rounded-action focus:bg-snow focus:px-3 focus:py-2 focus:text-ink focus-visible:outline-offset-0"
        >
          {tc("skipToContent")}
        </a>

        <div
          data-nav-pill
          data-nav-state="lifted"
          className="register-dark glass pointer-events-auto flex w-full max-w-5xl items-center gap-2 rounded-pill pl-5 pr-2 sm:gap-4 sm:pl-7 sm:pr-3"
          style={{ blockSize: "var(--nav-h)" }}
        >
          {/*
            `min-h-11 min-w-11` is a 44px tap target, not a size.

            Below 640px the wordmark is hidden and this link collapses to the 28px
            mark, which measured 28x28: under every touch guideline, on the one
            control that takes a lost visitor home, for the audience most likely to
            be on a phone. The mark stays 28px and stays where it was, because the
            box grows to the right into pill space that measured empty (197px of
            controls in a 366px pill at 390, in Hindi).
          */}
          <Link
            href="/"
            className="flex min-h-11 min-w-11 shrink-0 items-center gap-2.5 text-tone-strong"
            aria-label={wordmark}
          >
            <Mark className="size-7 text-gold" />
            {/*
              Hidden below 640px, and that is a measurement rather than a
              preference. At 390px the pill has 338px of usable width; the mark,
              the wordmark, a language switch, a 48px call to action and a menu
              button come to 362px in Hindi. Something had to go, and the mark
              still carries the brand while the wordmark returns the moment there
              is room. The full name is announced by the link's own label, and the
              sheet repeats it as its heading.
            */}
            <span className="wordmark hidden sm:inline">{wordmark}</span>
          </Link>

          <nav
            /* `lg:` and not `md:`. Measured: at 768 the pill has 720px of content
               box and the five links plus the mark, language switch and call to
               action need 849 in English and 795 in Hindi, so turning the inline
               nav on at `md` pushed the call to action and the menu button off the
               right of the screen, 104px past the viewport in English. Nothing
               caught it because the header is `fixed`: the controls leave the
               screen without the page ever gaining horizontal scroll. The inline
               nav fits from 900, so it waits for `lg`. */
            className="mx-auto hidden items-center gap-7 lg:flex"
            aria-label="Main"
          >
            {links.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="type-meta whitespace-nowrap text-tone-body transition-colors duration-[var(--dur-fast)] hover:text-tone-strong"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-2 lg:ml-0">
            {/*
              `whitespace-nowrap`, and a two-character form below 640px. The Hindi
              page's own label is "Switch to English", which is 111px of pill at
              15px and used to wrap the whole header onto a second line. The short
              form keeps the accessible name intact.
            */}
            <Link
              href="/"
              locale={other}
              lang={other}
              aria-label={tc("switchLanguage")}
              /* Measured 27.2x42.7 in English and 33.8x40 in Hindi, both under a
                 44px tap target. Centring inside a 44px box fixes it without
                 moving the label or changing the type. */
              className="type-meta inline-flex min-h-11 min-w-11 items-center justify-center whitespace-nowrap rounded-pill px-2 text-tone-body transition-colors duration-[var(--dur-fast)] hover:text-tone-strong"
            >
              <span aria-hidden className="sm:hidden">
                {other === "hi" ? "हि" : "EN"}
              </span>
              <span aria-hidden className="hidden sm:inline">
                {tc("switchLanguage")}
              </span>
            </Link>

            {/*
              The call to action is one object everywhere: gold fill, midnight
              label, in both registers. Measured 6.67:1 each way. It is deliberately
              not flipped to navy on light pages, because the primary action should
              be the same thing on every page rather than a colour that follows the
              section.
            */}
            {wa ? (
              <a
                href={wa}
                className="cta-gold type-meta inline-flex min-h-12 shrink-0 items-center whitespace-nowrap rounded-pill px-5 font-semibold transition-transform duration-[var(--dur-press)] ease-standard active:scale-[0.97] motion-reduce:transition-none motion-reduce:active:scale-100"
              >
                {t("enquire")}
              </a>
            ) : (
              <Link
                href="/enquire"
                className="cta-gold type-meta inline-flex min-h-12 shrink-0 items-center whitespace-nowrap rounded-pill px-5 font-semibold transition-transform duration-[var(--dur-press)] ease-standard active:scale-[0.97] motion-reduce:transition-none motion-reduce:active:scale-100"
              >
                {t("enquire")}
              </Link>
            )}

            <NavSheet
              links={links}
              extra={FOOTER_NAV}
              title={wordmark}
              openLabel={tc("openMenu")}
              closeLabel={tc("closeMenu")}
            />
          </div>
        </div>
      </header>
    </>
  );
}

/**
 * The footer.
 *
 * Stays `register-dark`, and loses every `border-t`: four hairline rules stacked
 * down one column is scaffolding, and the space between blocks says the same thing
 * without drawing anything. Nothing here is below 15px any more, including the
 * disclaimer, which is the paragraph on this site most likely to matter and was set
 * at 12px.
 */
export async function SiteFooter({ locale }: { locale: Locale }) {
  const entity = brand.legal.entityName;
  const operator = brand.legal.operatorDisclosure;

  return (
    <footer
      data-site-chrome
      data-register-mark="dark"
      className="register-dark px-[var(--gutter)] pb-[var(--space-2xl)] pt-[var(--space-2xl)] text-tone-body"
    >
      <div className="mx-auto flex max-w-6xl flex-col gap-[var(--space-2xl)]">
        <div className="flex items-center gap-2.5 text-tone-strong">
          <Mark className="size-6 text-gold" />
          {/* One brand string, the same one the header wears. */}
          <span className="wordmark">{display(brand.identity.shortName)}</span>
        </div>

        <div className="grid gap-[var(--space-lg)] sm:grid-cols-3 sm:gap-[var(--space-xl)]">
          <p className="type-body">{displayLocalized(brand.identity.promise, locale)}</p>

          {/*
            Doc 06: the site "must not imply that a partner's registration belongs to
            the brand owner". O1 and O2 settled on 17 Aug 2026 as the same entity, so
            there is no partner to confuse it with; a per-departure disclosure still
            overrides the second line when a journey is run by somebody else.

            `display()` rather than a settled/placeholder branch: the compiler pointed
            out the fallback had become unreachable, and this keeps working if either
            value ever returns to undecided.
          */}
          <div>
            <h2 className="type-meta text-tone-strong">Who you contract with</h2>
            <p className="type-meta mt-2">{display(entity)}</p>
            {/* One line when one entity does both, which is the case today. Printing
                the same name twice reads as a rendering fault rather than as the fact
                that the seller and the operator are the same company. */}
            {display(operator) !== display(entity) && (
              <p className="type-meta mt-1">{display(operator)} operates this journey</p>
            )}
          </div>

          <div>
            <h2 className="type-meta text-tone-strong">Where we are</h2>
            <p className="type-meta mt-2">{display(brand.contact.baseCity)}</p>
            <p className="type-meta mt-1">{display(brand.contact.supportHours)}</p>
          </div>
        </div>

        {/*
          Doc 03 puts partnerships and B2B ground handling behind the main
          navigation — "Press, partnerships or B2B ground handling later". They are
          real revenue lines (doc 01 rates ground handling P1), and an agency
          operations head will look in the footer. A traveller should not have to
          step over them on the way to a journey.
        */}
        <div className="flex flex-col gap-[var(--space-lg)]">
          <nav className="flex flex-wrap gap-x-8 gap-y-3" aria-label="More">
            {FOOTER_NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="type-meta inline-flex min-h-11 items-center transition-colors duration-[var(--dur-fast)] hover:text-tone-strong"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <nav className="flex flex-wrap gap-x-8 gap-y-3" aria-label="Policies">
            <Link
              href="/policies/terms"
              className="type-meta inline-flex min-h-11 items-center transition-colors duration-[var(--dur-fast)] hover:text-tone-strong"
            >
              Terms
            </Link>
            <Link
              href="/policies/cancellation"
              className="type-meta inline-flex min-h-11 items-center transition-colors duration-[var(--dur-fast)] hover:text-tone-strong"
            >
              Cancellation and refunds
            </Link>
            <Link
              href="/policies/privacy"
              className="type-meta inline-flex min-h-11 items-center transition-colors duration-[var(--dur-fast)] hover:text-tone-strong"
            >
              Privacy
            </Link>
            <Link
              href="/policies/consent"
              className="type-meta inline-flex min-h-11 items-center transition-colors duration-[var(--dur-fast)] hover:text-tone-strong"
            >
              Consent
            </Link>
          </nav>
        </div>

        <p className="type-meta measure-meta text-tone-muted">
          We do not guarantee darshan, weather, visibility or route access. High
          altitude travel carries real health risk; please consult a qualified doctor
          about your own fitness. Route and permit information on this site is what our
          coordinators last verified, with the time shown.
        </p>
      </div>
    </footer>
  );
}
