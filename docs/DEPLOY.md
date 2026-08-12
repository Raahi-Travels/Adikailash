# Deployment

## Live (private preview)

| | URL |
|---|---|
| Web (Vercel) | `https://adikailash-harshitqpy-6132s-projects.vercel.app` |
| API (Coolify on the VPS) | `https://pos48g4k0sw4gw80ww0c0swg.72.62.241.119.sslip.io` |

Vercel Authentication is on, so the site is reachable only by the team. The API's
`ALLOWED_ORIGINS` is pinned to the two Vercel origins and refuses everything else.

`DATABASE_URL` is set on Vercel, with `?options=-c%20search_path%3Dyatra`. It needs a
redeploy to take effect, after which staff sign-in works in production.

`BETTER_AUTH_URL` is deliberately **left unset**. There are two valid origins (the
project origin and the per-deployment one), and better-auth infers the origin per
request. Pinning it to one would break sign-in on the other.

Coolify was configured entirely through its API. The API token lives only on the VPS
at `/root/.coolify_ak_token` (chmod 600) and is not in this repo.


Two services, two hosts:

| Service | Host | Why |
|---|---|---|
| `apps/web` (Next.js) | Vercel | SSR, image pipeline, preview deploys |
| `apps/api` (FastAPI) | Hostinger VPS via Coolify | Needs a persistent connection pool; serverless would exhaust Supabase's connection limit and cannot hold one |

## Before you start: what is already on that VPS

`srv1264942` is not an empty box. It currently runs, under Coolify:

- **the Raahi cab platform in production** (`raahi-api`, `raahi-auth`, `raahi-public-web`)
- bullionbrains, trend-intel, image-first-api, minio

At the time of writing it was at **82% disk (36 GB free)** and 4 GB of 15 GB RAM.

Consequences:

- Deploy through **Coolify**, never by hand. Coolify owns Traefik on ports 80 and 443; a hand-rolled nginx or Caddy would fight it and can take Raahi's production down.
- The API image is ~354 MB. That fits, but watch disk before adding more services.
- Do not restart Docker or the proxy to fix an Adi Kailash problem. Other people's products are on that box.

---

## 1. API to the VPS (Coolify)

**Create the application**

- Coolify → new Resource → *Private Repository (with GitHub App)* or *Public Repository*
- Repository: this repo · Branch: `main`
- Build Pack: **Dockerfile**
- Base Directory: `/apps/api`
- Dockerfile Location: `/apps/api/Dockerfile`
- Port: `8000`

**Pre-deployment command** (this is where migrations run, not container start):

```
uv run alembic upgrade head
```

Running migrations at container start races between replicas and takes the API down
if one fails. Keep it here.

**Environment variables**

| Variable | Value |
|---|---|
| `APP_ENV` | `production` |
| `ALLOWED_ORIGINS` | the exact Vercel origin, e.g. `https://adikailash.vercel.app` |
| `DATABASE_URL` | `postgresql+asyncpg://postgres.<ref>:<pw>@aws-1-ap-south-1.pooler.supabase.com:6543/postgres` |
| `DIRECT_DATABASE_URL` | `postgresql+psycopg://postgres.<ref>:<pw>@aws-1-ap-south-1.pooler.supabase.com:5432/postgres` |
| `DB_SCHEMA` | `yatra` |
| `S3_ENDPOINT_URL` | `https://<project-ref>.storage.supabase.co/storage/v1/s3` |
| `S3_REGION` | `ap-south-1` |
| `S3_ACCESS_KEY_ID` | from Storage → S3 → Access keys |
| `S3_SECRET_ACCESS_KEY` | shown once at creation |
| `DOCUMENT_BUCKET` | `traveller-documents` |
| `PUBLIC_SITE_ORIGIN` | the public origin, e.g. `https://thesacrednorth.in`. Empty means no IndexNow submissions, which is correct until O7 |
| `INDEXNOW_KEY` | any opaque 8-128 char string. **Must match the web app's value** |

**Use S3 access keys, never the `service_role` key.** `service_role` bypasses RLS
across the whole project, which on this shared database means full read/write over
Raahi's passengers, trips and payments. S3 keys reach Storage and nothing else.

Copy the real values from `apps/api/.env`. Note the port split: **6543** (transaction
pooler) for the app, **5432** (session pooler) for migrations, which need a real session.

`ALLOWED_ORIGINS` is not optional. The API **refuses to start** in production without
it rather than falling back to a permissive CORS policy, because permissive origins
plus credentialed requests is how session cookies leak.

**Domain**: Coolify will issue TLS. Until O7 settles a real domain, a Coolify-generated
subdomain or an `sslip.io` hostname works. HTTPS is required: the browser posts the
enquiry form directly to this API, and a page served over HTTPS cannot call HTTP.

---

## 2. Web to Vercel

**Project settings**

- Root Directory: **`apps/web`** (this is a monorepo; Vercel must be told)
- Framework: Next.js (auto-detected)
- Install/build commands come from `apps/web/vercel.json`
- Region: `bom1` (Mumbai) — same region as the Supabase project and the VPS

**Environment variables**

| Variable | Value | Notes |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | `https://<coolify-api-host>` | Public. No trailing slash. |
| `DATABASE_URL` | `postgresql://postgres.<ref>:<pw>@aws-1-ap-south-1.pooler.supabase.com:5432/postgres?options=-c%20search_path%3Dyatra` | Server-only, for better-auth |
| `BETTER_AUTH_SECRET` | `openssl rand -base64 32` | Generate a **new** one; do not reuse the dev value |
| `BETTER_AUTH_URL` | the deployed origin | Must be set in production; unset only works in dev |
| `NEXT_PUBLIC_SITE_URL` | the public origin | **Asserting this turns indexing on.** Until it or a settled domain is present, robots disallows everything and no canonical is emitted |
| `INDEXNOW_KEY` | same value as the API | Served at `/indexnow-key.txt`. Without it every IndexNow submission is refused with a 403 |

The `search_path=yatra` on `DATABASE_URL` is load-bearing. It is what stops better-auth
from reaching Raahi's `public` schema, which holds their own `account` / `session` /
`verification` tables.

**Deployment protection**: turn it on for a private preview. The admin routes already
send `X-Robots-Tag: noindex`, but that is not access control.

---

## 3. Before the first public deploy

- [ ] Replace the placeholder imagery: `bun run --cwd apps/web check:imagery` must pass
- [ ] Purge demo data: `uv run --project apps/api python -m api.seed_demo --purge`
- [ ] Delete every test staff account (`ops@example.invalid`, `ops.test@example.invalid`).
      This database is shared with Raahi's production and the API is publicly
      reachable, so a leftover account with a known password is a live hole, not a
      tidiness issue.
- [ ] To remove somebody later, set `is_active = false` rather than deleting the row.
      A delete SET NULLs the coordinator on their reservations and then fails the
      check that a confirmed reservation must have one. That refusal is correct.
- [ ] Create real staff accounts: `bun run scripts/create-staff.ts <email> <pw> <name> <roles>`
- [ ] Confirm `/health` reports `document_storage_configured: true` if uploads are in use
- [ ] Confirm `payments_enabled: false` (it should be, until O2 to O4)
- [ ] Check the footer still names the real legal entity, or an honest gap, not a guess

## 4. Ongoing

Migrations run as the pre-deployment command. **Read the generated migration before
every deploy** and confirm `upgrade()` contains no `op.drop_table`. The database is
shared with Raahi's production; `docs/DECISIONS.md` explains how autogenerate once
produced 44 `DROP TABLE` statements against their schema.
