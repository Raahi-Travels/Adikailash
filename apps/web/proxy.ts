import createMiddleware from "next-intl/middleware";

import { routing } from "./i18n/routing";

/**
 * Locale negotiation and redirects.
 *
 * Next.js 16 renamed the `middleware` convention to `proxy` — same behaviour, new
 * file and export name. next-intl still ships its handler as `next-intl/middleware`;
 * that is the library's package path, not the Next convention, so it stays as-is.
 */
export default createMiddleware(routing);

export const config = {
  // Skip API routes, Next internals and anything with a file extension.
  matcher: "/((?!api|_next|_vercel|.*\\..*).*)",
};
