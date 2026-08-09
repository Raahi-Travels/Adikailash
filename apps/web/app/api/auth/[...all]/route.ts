import { toNextJsHandler } from "better-auth/next-js";

import { getAuth } from "@/lib/auth";

/**
 * better-auth endpoints.
 *
 * The handler is resolved per request so the build never constructs a database
 * pool. Sits outside the [locale] segment: sign-in is not a localized page route,
 * and the i18n proxy matcher already excludes /api.
 */
export async function GET(request: Request) {
  return toNextJsHandler(getAuth()).GET(request);
}

export async function POST(request: Request) {
  return toNextJsHandler(getAuth()).POST(request);
}
