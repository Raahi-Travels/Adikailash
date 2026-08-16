import { constants as cryptoConstants } from "node:crypto";
import { request as httpsRequest } from "node:https";

import { NextRequest } from "next/server";

/**
 * Fetches a page from an Indian address, for the API to parse.
 *
 * **Why this exists.** Two of the five live sources are Indian government portals
 * that answer an Indian IP and refuse the production host. `ilppithoragarh.uk.gov.in`
 * does not complete a connection at all and `mis.pwduk.in` returns 403, with a
 * browser User-Agent and with ours alike, so the block is on the address rather than
 * on how we ask. The API runs on a Hostinger VPS in **Kuala Lumpur**, and no amount
 * of header-fiddling changes which country it is in.
 *
 * Vercel can pin a function to Mumbai. So this route runs there, fetches the page,
 * and hands the bytes back. Parsing stays in Python where it already lives and is
 * already tested; duplicating the PWD table parser in TypeScript to avoid one hop
 * would mean two implementations of the same fragile scrape drifting apart.
 *
 * **It is not an open relay.** Three things stop it being one, and all three matter
 * because the URL comes in as a query parameter:
 *
 * 1. The host must be on `ALLOWED`. An allowlist, not a blocklist, so a redirect or
 *    a typo cannot reach anything else.
 * 2. `INDIA_FETCH_SECRET` must match. Without it, anybody who found this path would
 *    have a free proxy running in our account.
 * 3. Redirects are not followed, and the response is capped. A government portal
 *    that starts redirecting somewhere is a thing to notice, not to chase.
 */

export const runtime = "nodejs";

//: Mumbai. The whole point of the file.
export const preferredRegion = ["bom1"];

//: Never cached. It exists to be current.
export const dynamic = "force-dynamic";

/**
 * Hosts this may fetch. Exact matches only.
 *
 * Kept here rather than in an env var so that changing what this can reach requires
 * a commit and a review, which is the correct amount of friction for the allowlist
 * of a fetcher that runs in our infrastructure.
 */
const ALLOWED = new Set(["mis.pwduk.in", "ilppithoragarh.uk.gov.in"]);

/** The PWD register is about five megabytes. This is headroom, not a target. */
const MAX_BYTES = 12 * 1024 * 1024;

/**
 * Fetch, for a server that negotiates TLS the way 2015 did.
 *
 * `ilppithoragarh.uk.gov.in` needs legacy renegotiation. OpenSSL 3 refuses it by
 * default, so Python failed with `UNSAFE_LEGACY_RENEGOTIATION_DISABLED` and Node's
 * `fetch` fails with a bare `TypeError`, while curl connects happily. That is why the
 * host looks fine when probed by hand and then breaks from every runtime.
 *
 * `node:https` is used rather than `fetch` because undici gives no way to set the
 * option. Certificate verification and hostname checking both stay **on**: this
 * permits one handshake behaviour, it does not stop checking who answered. Reaching
 * for `rejectUnauthorized: false` would have been one line shorter and would have
 * turned a compatibility problem into a security one.
 */
function fetchLegacyTls(
  target: URL,
  headers: Record<string, string>,
): Promise<{ status: number; body: string; contentType: string }> {
  return new Promise((resolve, reject) => {
    const req = httpsRequest(
      {
        hostname: target.hostname,
        path: `${target.pathname}${target.search}`,
        method: "GET",
        headers,
        secureOptions: cryptoConstants.SSL_OP_LEGACY_SERVER_CONNECT,
        timeout: 45_000,
      },
      (res) => {
        const chunks: Buffer[] = [];
        let size = 0;
        res.on("data", (chunk: Buffer) => {
          size += chunk.length;
          if (size > MAX_BYTES) {
            req.destroy();
            reject(new Error("Response too large"));
            return;
          }
          chunks.push(chunk);
        });
        res.on("end", () =>
          resolve({
            status: res.statusCode ?? 0,
            body: Buffer.concat(chunks).toString("utf8"),
            contentType: String(res.headers["content-type"] ?? "text/html"),
          }),
        );
      },
    );
    req.on("timeout", () => req.destroy(new Error("Timed out")));
    req.on("error", reject);
    req.end();
  });
}

/** Hosts that need the legacy handshake. Kept narrow on purpose. */
const NEEDS_LEGACY_TLS = new Set(["ilppithoragarh.uk.gov.in"]);

/**
 * Status codes only, for the two allowlisted hosts, with no body returned.
 *
 * The whole approach rests on an assumption worth checking before anything depends
 * on it: that these portals refuse our Kuala Lumpur host for being outside India,
 * rather than refusing datacentre addresses generally. If it is the latter, an AWS
 * Mumbai function is no better off and this file is dead weight.
 *
 * Unauthenticated on purpose, because it is how you find out whether the secret is
 * worth configuring. It is not a relay: it fetches two hardcoded government
 * homepages and returns two integers. No caller-supplied URL, no response body, no
 * headers passed through.
 */
async function probe(): Promise<Response> {
  const results: Record<string, number | string> = {};

  for (const host of ALLOWED) {
    try {
      const url = new URL(`https://${host}/`);
      const headers = { "User-Agent": "adikailash-status/1" };
      if (NEEDS_LEGACY_TLS.has(host)) {
        results[host] = (await fetchLegacyTls(url, headers)).status;
      } else {
        const response = await fetch(url, {
          redirect: "manual",
          headers,
          signal: AbortSignal.timeout(25_000),
        });
        results[host] = response.status;
      }
    } catch (error) {
      results[host] = error instanceof Error ? error.message || error.name : "failed";
    }
  }

  return Response.json(
    { region: process.env.VERCEL_REGION ?? "unknown", results },
    { headers: { "cache-control": "no-store" } },
  );
}

export async function GET(request: NextRequest) {
  if (request.nextUrl.searchParams.get("probe") === "1") return probe();

  const secret = process.env.INDIA_FETCH_SECRET;
  if (!secret) {
    // Failing closed. An unset secret must not mean "no check required".
    return new Response("Not configured", { status: 503 });
  }
  if (request.headers.get("x-fetch-secret") !== secret) {
    return new Response("Forbidden", { status: 403 });
  }

  const target = request.nextUrl.searchParams.get("url");
  if (!target) return new Response("Missing url", { status: 400 });

  let parsed: URL;
  try {
    parsed = new URL(target);
  } catch {
    return new Response("Bad url", { status: 400 });
  }

  if (parsed.protocol !== "https:" || !ALLOWED.has(parsed.hostname)) {
    return new Response("Host not allowed", { status: 403 });
  }

  // A plain, honest identifier. The 403 was never about the User-Agent: it is the
  // same from a browser string, so there is nothing to gain by pretending to be one
  // and something to lose in being able to say what we are.
  const outgoing = {
    "User-Agent": "adikailash-status/1 (+https://github.com/Raahi-Travels)",
    "Accept-Language": "en-IN,en;q=0.9,hi;q=0.8",
  };

  try {
    let status: number;
    let body: string;
    let contentType: string;

    if (NEEDS_LEGACY_TLS.has(parsed.hostname)) {
      ({ status, body, contentType } = await fetchLegacyTls(parsed, outgoing));
    } else {
      const upstream = await fetch(parsed.toString(), {
        redirect: "manual",
        headers: outgoing,
        signal: AbortSignal.timeout(45_000),
      });
      status = upstream.status;
      body = await upstream.text();
      contentType = upstream.headers.get("content-type") ?? "text/html";
    }

    if (body.length > MAX_BYTES) {
      return new Response("Response too large", { status: 502 });
    }

    // The upstream status is passed through in a header rather than as our own, so
    // the caller can tell "the portal said 403" from "this route said 403", which
    // are very different problems.
    return new Response(body, {
      status: 200,
      headers: {
        "content-type": contentType,
        "x-upstream-status": String(status),
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    return new Response(
      `Upstream failed: ${error instanceof Error ? error.message : "unknown"}`,
      { status: 502 },
    );
  }
}
