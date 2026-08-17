import { getTranslations } from "next-intl/server";

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

const NAV = [
  { href: "/journeys", key: "journeys" },
  { href: "/departures", key: "departures" },
  { href: "/status", key: "liveStatus" },
  { href: "/guides", key: "guides" },
  { href: "/plan", key: "planYourJourney" },
] as const;

export async function SiteHeader({ locale }: { locale: Locale }) {
  const t = await getTranslations("nav");
  const tc = await getTranslations("common");
  const other: Locale = locale === "en" ? "hi" : "en";
  const wa = whatsappLink({ intent: "journey" });

  return (
    <header data-site-chrome className="register-dark sticky top-0 z-30 border-b border-tone-line bg-midnight/95 backdrop-blur">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-3 focus:z-50 focus:rounded focus:bg-snow focus:px-3 focus:py-2 focus:text-ink"
      >
        {tc("skipToContent")}
      </a>
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4 sm:px-6">
        <Link
          href="/"
          className="flex shrink-0 items-center gap-2.5 text-tone-strong"
          aria-label={display(brand.identity.name)}
        >
          <Mark className="size-7 text-gold" />
          <span className="font-serif text-lg leading-none tracking-wide">
            {display(brand.identity.shortName)}
          </span>
        </Link>

        <nav className="ml-auto hidden items-center gap-7 md:flex" aria-label="Main">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-sm text-tone-body transition-colors hover:text-tone-strong"
            >
              {t(item.key)}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-3 md:ml-0">
          <Link
            href="/"
            locale={other}
            className="rounded px-2 py-1 text-sm text-tone-body transition-colors hover:text-gold"
            lang={other}
          >
            {tc("switchLanguage")}
          </Link>
          {wa ? (
            <a
              href={wa}
              className="whitespace-nowrap rounded-full bg-gold px-4 py-2 text-sm font-medium text-midnight transition-transform hover:brightness-105 active:scale-[0.98]"
            >
              {t("enquire")}
            </a>
          ) : (
            <Link
              href="/enquire"
              className="whitespace-nowrap rounded-full bg-gold px-4 py-2 text-sm font-medium text-midnight transition-transform hover:brightness-105 active:scale-[0.98]"
            >
              {t("enquire")}
            </Link>
          )}
        </div>
      </div>

      <nav
        className="flex items-center gap-5 overflow-x-auto border-t border-tone-line px-4 py-2.5 md:hidden"
        aria-label="Main"
      >
        {NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="whitespace-nowrap text-sm text-tone-body"
          >
            {t(item.key)}
          </Link>
        ))}
      </nav>
    </header>
  );
}

export async function SiteFooter({ locale }: { locale: Locale }) {
  const entity = brand.legal.entityName;
  const operator = brand.legal.operatorDisclosure;

  return (
    <footer data-site-chrome className="register-dark border-t border-tone-line px-4 py-12 text-tone-body sm:px-6">
      <div className="mx-auto flex max-w-6xl flex-col gap-8">
        <div className="flex items-center gap-2.5 text-tone-strong">
          <Mark className="size-6 text-gold" />
          <span className="font-serif text-base tracking-wide">
            {display(brand.identity.name)}
          </span>
        </div>

        <div className="grid gap-6 text-sm sm:grid-cols-3">
          <p className="max-w-[60ch]">{displayLocalized(brand.identity.promise, locale)}</p>

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
            <h2 className="text-tone-strong">Who you contract with</h2>
            <p className="mt-2">{display(entity)}</p>
            {/* One line when one entity does both, which is the case today. Printing
                the same name twice reads as a rendering fault rather than as the fact
                that the seller and the operator are the same company. */}
            {display(operator) !== display(entity) && (
              <p className="mt-1">{display(operator)} operates this journey</p>
            )}
          </div>

          <div>
            <h2 className="text-tone-strong">Where we are</h2>
            <p className="mt-2">{display(brand.contact.baseCity)}</p>
            <p className="mt-1">{display(brand.contact.supportHours)}</p>
          </div>
        </div>

        {/*
          Doc 03 puts partnerships and B2B ground handling behind the main
          navigation — "Press, partnerships or B2B ground handling later". They are
          real revenue lines (doc 01 rates ground handling P1), and an agency
          operations head will look in the footer. A traveller should not have to
          step over them on the way to a journey.
        */}
        <nav
          className="flex flex-wrap gap-x-6 gap-y-2 border-t border-tone-line pt-6 text-sm"
          aria-label="More"
        >
          <Link href="/private" className="hover:text-tone-strong">
            Private groups and international travellers
          </Link>
          <Link href="/partners" className="hover:text-tone-strong">
            Ground handling for agencies
          </Link>
        </nav>

        <nav
          className="flex flex-wrap gap-x-6 gap-y-2 border-t border-tone-line pt-6 text-sm"
          aria-label="Policies"
        >
          <Link href="/policies/terms" className="hover:text-tone-strong">
            Terms
          </Link>
          <Link href="/policies/cancellation" className="hover:text-tone-strong">
            Cancellation and refunds
          </Link>
          <Link href="/policies/privacy" className="hover:text-tone-strong">
            Privacy
          </Link>
          <Link href="/policies/consent" className="hover:text-tone-strong">
            Consent
          </Link>
        </nav>

        <p className="text-xs leading-relaxed">
          We do not guarantee darshan, weather, visibility or route access. High
          altitude travel carries real health risk; please consult a qualified doctor
          about your own fitness. Route and permit information on this site is what our
          coordinators last verified, with the time shown.
        </p>
      </div>
    </footer>
  );
}
