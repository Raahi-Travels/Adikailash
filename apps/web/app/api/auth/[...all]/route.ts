import { toNextJsHandler } from "better-auth/next-js";

import { auth } from "@/lib/auth";

/**
 * better-auth endpoints.
 *
 * Sits outside the [locale] segment: sign-in is not a localized page route, and the
 * i18n proxy matcher already excludes /api.
 */
export const { GET, POST } = toNextJsHandler(auth);
