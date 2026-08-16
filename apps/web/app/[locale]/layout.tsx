import { notFound } from "next/navigation";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { Eczar, Mukta } from "next/font/google";

import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { StagingNotice } from "@/components/staging-notice";
import { OrganizationLd } from "@/components/structured-data";
import { routing } from "@/i18n/routing";
import type { Locale } from "@/lib/api";
import { brand, buildMetadata, displayLocalized } from "@/lib/brand";
import "../globals.css";

/**
 * Two faces, both drawn for Devanagari and Latin *together*.
 *
 * The previous pairing was EB Garamond and Inter with Noto Serif/Sans Devanagari
 * bolted on as fallbacks. That is four unrelated designs, and it quietly contradicts
 * doc 02's rule that "Devanagari is a first-class layout, not a smaller translation
 * beneath English" — a Hindi heading rendered in a fallback face is exactly the
 * second-class treatment the rule exists to prevent. Both scripts now sit in one
 * superfamily each, so a Hindi page is the same design as the English one rather
 * than a substitution for it.
 *
 * Eczar (Rosetta, Vaibhav Singh) is a high-contrast display face with real presence
 * at hero size. Mukta (Ek Type) is a Devanagari-first interface face whose open
 * apertures and tall x-height suit doc 02's other accessibility rule: body copy has
 * to stay comfortable for older travellers reading on a phone in daylight.
 *
 * Both are loaded for both locales, because journey and place names carry Hindi
 * alongside English on every page regardless of which locale is active.
 */
const heading = Eczar({
  variable: "--font-heading",
  subsets: ["latin", "devanagari"],
  weight: ["500", "600"],
  display: "swap",
});

const sans = Mukta({
  variable: "--font-interface",
  subsets: ["latin", "devanagari"],
  weight: ["400", "500", "600"],
  display: "swap",
});

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

/** Per-locale so the Hindi page does not advertise itself with an English title. */
export async function generateMetadata({ params }: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  return buildMetadata({
    title: displayLocalized(brand.identity.tagline, locale),
    description: displayLocalized(brand.identity.descriptor, locale),
    path: `/${locale}`,
  });
}

export default async function LocaleLayout({
  children,
  params,
}: LayoutProps<"/[locale]">) {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  // Required for static rendering — without it every page opts into dynamic.
  setRequestLocale(locale);

  return (
    <html
      lang={locale}
      className={`${heading.variable} ${sans.variable} h-full`}
    >
      <body className="min-h-full flex flex-col bg-midnight">
        <NextIntlClientProvider>
          <OrganizationLd locale={locale} />
          <StagingNotice />
          <SiteHeader locale={locale as Locale} />
          {children}
          <SiteFooter locale={locale as Locale} />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}

