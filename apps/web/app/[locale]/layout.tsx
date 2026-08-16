import { notFound } from "next/navigation";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import {
  EB_Garamond,
  Inter,
  Noto_Sans_Devanagari,
  Noto_Serif_Devanagari,
} from "next/font/google";

import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { StagingNotice } from "@/components/staging-notice";
import { OrganizationLd } from "@/components/structured-data";
import { routing } from "@/i18n/routing";
import type { Locale } from "@/lib/api";
import { brand, buildMetadata, displayLocalized } from "@/lib/brand";
import "../globals.css";

/** Editorial serif for headings — doc 02's "refined serif" direction. */
const heading = EB_Garamond({
  variable: "--font-heading",
  subsets: ["latin"],
  display: "swap",
});

/** Interface sans — legible at the sizes older travellers need. */
const sans = Inter({
  variable: "--font-interface",
  subsets: ["latin"],
  display: "swap",
});

/**
 * Devanagari faces are loaded for BOTH locales, not just `hi`.
 * Journey and place names carry Hindi alongside English throughout the site, so an
 * English page still renders Devanagari — doc 02: "Treat Devanagari as a first-class
 * layout, not a smaller translation beneath English."
 */
const headingDevanagari = Noto_Serif_Devanagari({
  variable: "--font-heading-hi",
  subsets: ["devanagari"],
  display: "swap",
});

const sansDevanagari = Noto_Sans_Devanagari({
  variable: "--font-interface-hi",
  subsets: ["devanagari"],
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
      className={`${heading.variable} ${sans.variable} ${headingDevanagari.variable} ${sansDevanagari.variable} h-full`}
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

