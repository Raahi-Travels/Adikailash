/**
 * Fails when the API will not accept browser calls from an origin this site runs on.
 *
 * Run with `bun run check:origins` (add `--live` to test the deployed API).
 *
 * **Why this exists.** `ALLOWED_ORIGINS` on the API was left holding two Vercel
 * preview URLs from an earlier deployment. Preview hosts change on every push, so
 * the list went stale immediately and nobody noticed, because nothing on the server
 * fails: pages render, the build is green, and only the browser is refused.
 *
 * What that broke on the live site: the private-journey enquiry form, the route-alert
 * subscription, the feedback form, the family share view, and the assistant console.
 * Six things, all of them the paths where somebody is actually trying to reach the
 * business, silently returning a CORS error in a console nobody was reading.
 *
 * Server-rendered fetches are unaffected, which is exactly what makes this
 * invisible: the pages that call the API from the browser look completely fine until
 * you press the button.
 */

const LOCAL_API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8010";
const LIVE_API = "https://pos48g4k0sw4gw80ww0c0swg.72.62.241.119.sslip.io";

/**
 * Origins the site is served from. The settled domain plus its `www`, and the stable
 * Vercel project host that is used until DNS resolves.
 *
 * Per-deployment preview URLs are deliberately absent: they change on every push, so
 * listing them is how the list went stale in the first place.
 */
const ORIGINS = [
  "https://sacrednorth.in",
  "https://www.sacrednorth.in",
  "https://adikailash-ten.vercel.app",
];

/** One endpoint per browser-side caller, so a partial policy cannot pass. */
const ENDPOINTS = [
  { path: "/leads", method: "POST", used_by: "enquiry and specialist forms" },
  { path: "/status-alerts", method: "POST", used_by: "route alert subscription" },
];

const live = process.argv.includes("--live");
const base = live ? LIVE_API : LOCAL_API;

const failures: string[] = [];

for (const origin of ORIGINS) {
  for (const endpoint of ENDPOINTS) {
    let allowed: string | null = null;
    try {
      const response = await fetch(`${base}${endpoint.path}`, {
        method: "OPTIONS",
        headers: {
          Origin: origin,
          "Access-Control-Request-Method": endpoint.method,
          "Access-Control-Request-Headers": "content-type",
        },
        signal: AbortSignal.timeout(15_000),
      });
      allowed = response.headers.get("access-control-allow-origin");
    } catch (error) {
      failures.push(
        `${origin} -> ${endpoint.path}: could not reach the API (${
          error instanceof Error ? error.message : "unknown"
        })`,
      );
      continue;
    }

    if (allowed !== origin && allowed !== "*") {
      failures.push(
        `${origin} -> ${endpoint.path} (${endpoint.used_by}): refused, ` +
          `Access-Control-Allow-Origin was ${allowed ?? "absent"}`,
      );
    }
  }
}

if (failures.length) {
  console.error(`\n${failures.length} origin(s) the browser cannot use:\n`);
  for (const failure of failures) console.error(`  ${failure}`);
  console.error(
    "\nSet ALLOWED_ORIGINS on the API to the list in this file and redeploy; it is" +
      "\nread at startup, so changing the variable alone does nothing. Every entry" +
      "\nmust be an exact origin, scheme included.\n",
  );
  process.exit(1);
}

console.log(
  `Origins hold: ${ORIGINS.length} origin(s) accepted on ${ENDPOINTS.length} ` +
    `browser-called endpoint(s)${live ? " (live API)" : ""}.`,
);
