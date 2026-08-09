import { defineRouting } from "next-intl/routing";

/**
 * Locale routing.
 *
 * `localePrefix: "always"` gives /en/... and /hi/... rather than putting English at
 * the root and Hindi in a subfolder. Doc 02 is explicit that Devanagari is "a
 * first-class layout, not a smaller translation beneath English" — symmetrical URLs
 * are the structural version of that, and they make hreflang pairs trivial.
 *
 * This handles UI strings, locale routing and formatting. Journey content itself is
 * localized in the database as JSONB (decision D9); the two layers are separate on
 * purpose, because operations edits content without touching the codebase.
 */
export const routing = defineRouting({
  locales: ["en", "hi"],
  defaultLocale: "en",
  localePrefix: "always",
});

export type Locale = (typeof routing.locales)[number];
