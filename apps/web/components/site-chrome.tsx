import { getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import type { Locale } from "@/lib/api";
import { brand, display, displayLocalized, isSettled, whatsappLink } from "@/lib/brand";

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
  { href: "/status", key: "liveStatus" },
  { href: "/plan", key: "planYourJourney" },
] as const;

export async function SiteHeader({ locale }: { locale: Locale }) {
  const t = await getTranslations("nav");
  const tc = await getTranslations("common");
  const other: Locale = locale === "en" ? "hi" : "en";
  const wa = whatsappLink({ intent: "journey" });

  return (
    <header className="sticky top-0 z-30 border-b border-white/10 bg-midnight/95 backdrop-blur">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-3 focus:z-50 focus:rounded focus:bg-snow focus:px-3 focus:py-2 focus:text-ink"
      >
        {tc("skipToContent")}
      </a>
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4 sm:px-6">
        <Link
          href="/"
          className="flex shrink-0 items-center gap-2.5 text-ink-inverse"
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
              className="text-sm text-ink-inverse/75 transition-colors hover:text-ink-inverse"
            >
              {t(item.key)}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-3 md:ml-0">
          <Link
            href="/"
            locale={other}
            className="rounded px-2 py-1 text-sm text-ink-inverse/70 transition-colors hover:text-gold"
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
        className="flex items-center gap-5 overflow-x-auto border-t border-white/10 px-4 py-2.5 md:hidden"
        aria-label="Main"
      >
        {NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="whitespace-nowrap text-sm text-ink-inverse/75"
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
    <footer className="border-t border-white/10 bg-midnight px-4 py-12 text-ink-inverse/70 sm:px-6">
      <div className="mx-auto flex max-w-6xl flex-col gap-8">
        <div className="flex items-center gap-2.5 text-ink-inverse">
          <Mark className="size-6 text-gold" />
          <span className="font-serif text-base tracking-wide">
            {display(brand.identity.name)}
          </span>
        </div>

        <div className="grid gap-6 text-sm sm:grid-cols-3">
          <p className="max-w-[60ch]">{displayLocalized(brand.identity.promise, locale)}</p>

          {/*
            Doc 06: the site "must not imply that a partner's registration belongs to
            the brand owner". Until O1 and O2 are decided these render as stated gaps
            rather than a plausible-looking company name.
          */}
          <div>
            <h2 className="text-ink-inverse">Who you contract with</h2>
            <p className="mt-2">
              {isSettled(entity) ? entity.value : entity.placeholder}
            </p>
            <p className="mt-1">
              {isSettled(operator) ? operator.value : operator.placeholder}
            </p>
          </div>

          <div>
            <h2 className="text-ink-inverse">Where we are</h2>
            <p className="mt-2">{display(brand.contact.baseCity)}</p>
            <p className="mt-1">{display(brand.contact.supportHours)}</p>
          </div>
        </div>

        <p className="border-t border-white/10 pt-6 text-xs leading-relaxed">
          We do not guarantee darshan, weather, visibility or route access. High
          altitude travel carries real health risk; please consult a qualified doctor
          about your own fitness. Route and permit information on this site is what our
          coordinators last verified, with the time shown.
        </p>
      </div>
    </footer>
  );
}
