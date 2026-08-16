# Outside data sources

What each live source answers, what it costs, and where it lies to you. Findings from
the research pass of 16 to 17 August 2026; every status code was observed live.

The one-line summary a reader deserves, and which `/live` returns on every response:
**no official source reports road status above Tawaghat, and no weather station exists
anywhere on this route.** Everything the site shows for the high ground is either a
government portal's own words or a model's output. Never an observation.

## In use

| Source | What it answers | Auth | Cadence |
|---|---|---|---|
| Open-Meteo | Temperature and conditions per place | none (key for commercial) | 6h |
| ILP portal | Whether permits are being issued at all | none | 6 to 12h |
| KMVN | Bed availability at the government rest houses | none | nightly |
| SACHET / NDMA | Weather warnings naming this district | none | 15 min |
| UK PWD register | Road closures, district-wide | none | 15 min |

### Open-Meteo

Chosen over OpenWeatherMap, WeatherAPI and Visual Crossing because it reports the
elevation its own grid holds and **lets you override it**. On this route that is
decisive rather than a nicety.

Within a 10 by 8 km box near Gunji the ground spans 2,658 m to 5,534 m, which is
2,876 m of relief inside one grid cell, and no regional high-resolution model covers
India: ICON-D2, AROME, JMA-MSM and GEM-Regional all refuse these coordinates. So the
model reports a temperature for terrain that is hundreds of metres away from the real
ground, in either direction:

| Place | true | model | raw | error if uncorrected |
|---|---|---|---|---|
| Nabhidhang | 4,260 m | 4,989 m | 5.2 C | **5.4 C too cold** |
| Jyolingkong | 4,570 m | 3,895 m | 11.4 C | **4.4 C too warm** |
| Gunji | 3,160 m | 3,809 m | 10.4 C | 3.6 C too cold |

Three rules the client follows:

1. **Pass `elevation` explicitly.** Verified honoured, not echoed: the same point
   returns 12.5 C at the model's 3,477 m and 14.6 C when told 3,160 m, a gradient of
   6.6 C per 1,000 m. `domain/mountain_weather.py` re-checks and corrects locally if
   that ever stops holding.
2. **Never `timezone=auto`.** It returns **Asia/Kathmandu** for Nabhidhang, Kalapani
   and Lipulekh, because the geocoder resolves the disputed border in Nepal's favour.
   Confirmed live. A day boundary fifteen minutes out shifts which day a traveller
   reads.
3. **Several models, shown as a range.** Post-correction spread across models reached
   8.8 C where one model's own ensemble showed about 2 C. The ensemble is
   under-dispersed and believing it manufactures confidence.

One request per point, not the batched form: the batch takes a single `elevation` for
every coordinate, which on a route spanning 910 m to 4,570 m would be worse than no
correction because it would be wrong in a way that looks deliberate.

**Licensing.** The free tier is non-commercial, CC-BY 4.0. Commercial use needs the
paid host at about €29/month. `OPEN_METEO_API_KEY` switches hosts. Attribution belongs
on any page showing this.

### ILP portal

No API: `/api` is 404 and `/api/user` is 500. Two signals are read, the homepage
notice and whether `/registeruser` still serves a form, and they must agree or the
state is reported as uncertain.

Its TLS needs `OP_LEGACY_SERVER_CONNECT`, so it fails from Python while working under
curl. Permitted narrowly, with certificate and hostname verification left on.

Suspension is not always weather: the portal closed for a week in October 2025 for an
ultra marathon. So the notice is quoted verbatim rather than classified.

### KMVN

The apex `kmvn.in` redirects into a dead plain-HTTP host; the `www` host is required.
The fragment leaks a stale template date, so the requested range is authoritative.
Jyolingkong has **15 beds in total**, which is the sort of fact that changes a plan
and which nobody else publishes.

### PWD register

**It refuses the production host.** 200 from a domestic connection, **403 from the
Hostinger datacentre range**, with a browser User-Agent and with ours alike, so the
block is on the address. The road register therefore has no rows in production. It
degrades to reporting nothing rather than to an empty list, which on a closures page
would read as "no closures"; a source that has never been read successfully is
omitted entirely rather than shown as freshly fetched and empty.

Fixing it needs a fetch from an address the register will talk to. The cheapest
option that does not move database credentials is a small scheduled job elsewhere
that parses the page and posts the result to a scoped admin endpoint, so the only
secret leaving the box is a token that can write one live source.

Filtering on road name alone returned 21 rows where 197 concern this district, so
rows are kept district-wide and flagged `on_corridor` separately.

**Its coverage of the high road is nominal.** The BRO view holds about a dozen rows
since January 2025. The *Gunji to Kutti to Jolingkong* row has one entry, from August
2025. Dharchula and Lipulekh have none. A consumer reading "no closure" as "open"
would render the most exposed stretch as clear, which is why the caveat is attached to
the payload rather than left to a UI to remember.

## Deliberately not used

**IMD city pages: do not iframe, proxy or link.** `city.imd.gov.in/citywx/responsive/`
was observed serving **injected JavaScript that opens `filmm.me` every two minutes on
Android user agents**, across every city id tested. SACHET carries IMD's nowcast
content without that exposure. Worth reporting to CERT-In.

**IMD API.** Real, but returns 401 without a key, and registration is restricted to
`gov.in` and `nic.in` addresses. Legacy endpoints are IP-gated, so no serverless
deployment can use them.

**Air quality.** All of Uttarakhand has three CPCB stations, nearest 210 km away in
the plains. Modelled PM2.5 at 4,989 m is 0.1 µg/m³. Use UV index and visibility from
Open-Meteo instead.

**GLOF.** No early warning feed exists. NDMA's inventory lists six moraine-dammed
lakes in the Kali headwaters, four Risk Class A, one feeding the Kuthi Yankti which
joins the Kali at Gunji, and its attributes are unreliable enough that only the
coordinates should be trusted. Shipped as static context in the guide
`what-nobody-is-watching`, with the absence stated plainly.

**Bhuvan landslide layer.** Its extent stops at 80.768°E, so Gunji, Nabhidhang and
Lipulekh fall outside it. It would render the most dangerous stretch as blank.

**Earthquake.** EMSC carries 4.3 times USGS's coverage here and about 82% of it is
authored by NCS New Delhi, so EMSC is how Indian solutions are obtained
machine-readably. Zero events fell in the route box in a 17-day window, so this
belongs as a significant-event alert rather than a live panel. Not yet built.

**DGRE avalanche bulletin.** Pithoragarh is a named district with a danger level, as a
daily PDF, roughly 15 November to early June. Seasonal, so out of scope until autumn.

## Scheduling

The refresh runs on the VPS, hourly at :17, as `/root/refresh-adikailash-live.sh`.
It `docker exec`s into the running API container so it uses the environment Coolify
already gave it, and resolves the container by name prefix because the deployment
suffix changes on every deploy.

**It deliberately does not run in GitHub Actions.** That would mean putting
`DIRECT_DATABASE_URL` into a public repository's secrets, and that URL reaches a
Supabase instance shared with Raahi production (decision D6). The VPS already holds
those credentials; copying them somewhere else to give a scheduler a place to read
them is a much larger exposure than an hourly cron is worth.

Two things were only discovered by running it where it actually runs:

- **The weather job wrote nothing.** "Today" was taken from the host's local date,
  which is IST on a machine in India and UTC in the container. After 18:30 UTC those
  are different days, so no forecast date matched and the job reported success having
  stored zero readings. Now compared in `Asia/Kolkata`, with a regression test pinned
  to the boundary rather than to `today()`.
- **The PWD register 403s from this host.** See below.

## The Mumbai relay

Two sources refuse the production host for being outside India. Measured, not
assumed:

| Host | from Kuala Lumpur (the VPS) | from Mumbai (Vercel `bom1`) |
|---|---|---|
| `mis.pwduk.in` | **403** | **200** |
| `ilppithoragarh.uk.gov.in` | no connection | **200** |

So it is geography, not a general block on datacentres, and pinning a function to
Mumbai fixes it. `apps/web/app/api/india-fetch/route.ts` fetches an allowlisted URL
from `bom1` and returns the bytes; `apps/api/src/api/live/india.py` routes the two
affected clients through it when configured and goes direct otherwise.

The permit portal also needed `SSL_OP_LEGACY_SERVER_CONNECT` on the Node side, the
same legacy renegotiation that made Python fail. Certificate and hostname
verification stay on in both.

**It is not an open relay:** an allowlist of two hosts, a shared secret, no redirects
followed, a 12 MB cap, and it fails closed when the secret is unset. There is also an
unauthenticated `?probe=1` that fetches those two homepages and returns two status
codes with no body, which is how the table above was measured.

### Turning it on

It is deployed and inert until both sides hold the same secret. Nothing breaks while
it is off; the two sources simply report nothing in production, which is what they
already do.

1. **Vercel** project settings, environment variables, all environments:

   ```
   INDIA_FETCH_SECRET = 7e055472c6a620392ed9fcebe245f733ea794adcaf7a3d214faec873cb4a55b4
   ```

2. **Coolify**, application `adikailash-api`, environment variables:

   ```
   INDIA_FETCH_URL    = https://adikailash-ten.vercel.app/api/india-fetch
   INDIA_FETCH_SECRET = 7e055472c6a620392ed9fcebe245f733ea794adcaf7a3d214faec873cb4a55b4
   ```

3. Redeploy the API, then check that the two sources stop reporting errors:

   ```
   curl -s https://pos48g4k0sw4gw80ww0c0swg.72.62.241.119.sslip.io/live | jq '.road_register.last_error, .permit_portal.last_error'
   ```

Replace the secret with your own if you would rather not use one that has been
written into a repository. It only needs to match on both sides.

## Traps

- `uttarakhandtourism.gov.in` returns **HTTP 200 for every path**, a 73 KB soft-404
  shell. Diff the body length before believing any endpoint there.
- `heliservices.uk.gov.in` appears in many write-ups and **does not exist** (NXDOMAIN).
- `data.gov.in` returns HTTP 429 after about a dozen requests and its relevant
  datasets are stale to 2018 and 2022.
- The MEA's own FAQ page still says the route involves "about 200 km" of trekking over
  23 to 25 days. Its own 2026 itinerary and its May 2026 press release say otherwise.
  Anybody quoting the FAQ is quoting a page nobody has updated.
