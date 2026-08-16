import { constants as cryptoConstants } from "node:crypto";
import { request as httpsRequest } from "node:https";

/**
 * Mirrors three fixed Indian government pages, from an Indian address.
 *
 * **Why it exists.** Two of the five live sources refuse the production host for
 * being outside India. Measured, not assumed: `mis.pwduk.in` answers **403** from the
 * Kuala Lumpur VPS and **200** from here, and `ilppithoragarh.uk.gov.in` will not
 * complete a connection there at all. Vercel can pin a function to Mumbai, so the
 * fetch happens here and the bytes go back for Python to parse. Parsing stays where
 * it is already tested rather than being reimplemented in TypeScript and left to
 * drift.
 *
 * **It takes no input, and that is the whole design.** An earlier version accepted
 * `?url=` against an allowlist, which is a proxy, and a proxy needs a shared secret
 * so it cannot be used by strangers. That secret then has to exist in two places,
 * and configuring the Vercel half needs dashboard access.
 *
 * Removing the parameter removes all of it. The three URLs are constants in this
 * file. There is nothing a caller can ask for that is not one of them, so there is
 * nothing to abuse, so there is no secret, so there is nothing to configure. An
 * unknown `source` is a 404.
 *
 * The remaining concern is somebody hitting it in a loop to burn function budget,
 * which the cache below handles: the API refreshes hourly, so serving a five-minute
 * copy costs nothing in freshness and makes a flood cheap. It also keeps us from
 * hammering a small government server.
 */

export const runtime = "nodejs";

//: Mumbai. The entire point of the file.
export const preferredRegion = ["bom1"];

/**
 * Five minutes. Long enough that repeated requests do not reach the origin, short
 * enough to be well inside the hourly refresh that consumes this.
 */
export const revalidate = 300;

/** The only pages this can fetch. Not configurable, not caller-supplied. */
const SOURCES = {
  road: "https://mis.pwduk.in/pwd/roadClosure",
  permit: "https://ilppithoragarh.uk.gov.in/",
  "permit-registration": "https://ilppithoragarh.uk.gov.in/registeruser",
} as const;

type Source = keyof typeof SOURCES;

/** The PWD register is about five megabytes. Headroom, not a target. */
const MAX_BYTES = 12 * 1024 * 1024;

/**
 * Hosts that negotiate TLS the way 2015 did.
 *
 * `ilppithoragarh.uk.gov.in` needs legacy renegotiation. OpenSSL 3 refuses it, so
 * Python fails with `UNSAFE_LEGACY_RENEGOTIATION_DISABLED` and Node's `fetch` fails
 * with a bare `TypeError`, while curl connects happily. That is why the host looks
 * fine when probed by hand and breaks from every runtime.
 */
const NEEDS_LEGACY_TLS = new Set(["ilppithoragarh.uk.gov.in"]);

const OUTGOING = {
  // A plain, honest identifier. The 403 was never about the User-Agent, so there is
  // nothing to gain by pretending to be a browser and something to lose in being
  // able to say what we are.
  "User-Agent": "adikailash-status/1 (+https://github.com/Raahi-Travels)",
  "Accept-Language": "en-IN,en;q=0.9,hi;q=0.8",
};

type Fetched = { status: number; body: string; contentType: string };

/**
 * `node:https` rather than `fetch`, because undici exposes no way to set
 * `secureOptions`. Certificate verification and hostname checking both stay on: this
 * permits one handshake behaviour, it does not stop checking who answered.
 * `rejectUnauthorized: false` would have been shorter and would have turned a
 * compatibility problem into a security one.
 */
function fetchLegacyTls(target: URL): Promise<Fetched> {
  return new Promise((resolve, reject) => {
    const req = httpsRequest(
      {
        hostname: target.hostname,
        path: `${target.pathname}${target.search}`,
        method: "GET",
        headers: OUTGOING,
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

async function fetchPlain(target: URL): Promise<Fetched> {
  // Redirects are not followed. A government portal that starts redirecting is a
  // thing to notice, not to chase.
  const upstream = await fetch(target.toString(), {
    redirect: "manual",
    headers: OUTGOING,
    signal: AbortSignal.timeout(45_000),
  });
  return {
    status: upstream.status,
    body: await upstream.text(),
    contentType: upstream.headers.get("content-type") ?? "text/html",
  };
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ source: string }> },
) {
  const { source } = await params;

  if (!Object.hasOwn(SOURCES, source)) {
    return new Response("Unknown source", { status: 404 });
  }

  const target = new URL(SOURCES[source as Source]);

  try {
    const result = NEEDS_LEGACY_TLS.has(target.hostname)
      ? await fetchLegacyTls(target)
      : await fetchPlain(target);

    if (result.body.length > MAX_BYTES) {
      return new Response("Response too large", { status: 502 });
    }

    // The origin's status travels in a header rather than as ours, so a caller can
    // tell "the portal said 403" from "this route said 403". Those are very
    // different problems and collapsing them would hide the interesting one.
    return new Response(result.body, {
      status: 200,
      headers: {
        "content-type": result.contentType,
        "x-upstream-status": String(result.status),
        "cache-control": "public, max-age=0, s-maxage=300",
      },
    });
  } catch (error) {
    return new Response(
      `Upstream failed: ${error instanceof Error ? error.message : "unknown"}`,
      { status: 502 },
    );
  }
}
