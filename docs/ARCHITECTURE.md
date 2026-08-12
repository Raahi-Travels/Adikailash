# Architecture

Answers doc 08's "expected technical-design outputs" at the depth appropriate for
pre-launch. Revise as scope lands; do not let this drift from the code.

## Stack

| Layer | Choice | Notes |
|---|---|---|
| Web | Next.js (App Router), TypeScript, Tailwind | SSG/ISR for content, streamed SSR for status |
| Client data | TanStack Query | Enquiry forms, status polling |
| Runtime / package manager | Bun | Install, dev, scripts |
| API | FastAPI, Python 3.14, uv | Async, Pydantic contracts |
| DB | Supabase PostgreSQL (shared with Raahi) + SQLAlchemy + Alembic | We own the `yatra` schema only — see D6 |
| Content | Structured records in Postgres, edited via admin | No third-party CMS at launch — see below |

### Why no headless CMS at launch

Docs 03 and 08 want journeys, departures, status and policies content-managed.
The tempting move is Sanity/Payload/Contentful. Rejected for now because the same
records drive operations (a departure is a CMS entry *and* an operational object with
capacity, allocations and readiness gates). Splitting them across a CMS and a database
creates exactly the competing-source-of-truth failure doc 08's principle #2 forbids.
One Postgres schema, one admin, one truth. Revisit if editorial volume outgrows it.

### Shared database

One Supabase Postgres serves both this project and the Raahi cab app. We create and
migrate exactly one schema, `yatra` (14 tables). `public` and `auth` belong to Raahi
and Supabase respectively and are never touched by our migrations.

The integration seam is a single nullable FK: `yatra.leads.raahi_user_id →
public.users(id)`, `ON DELETE SET NULL` so a Raahi account deletion neither orphans
nor blocks anything here. That is the only cross-schema reference we hold, and it is
what lets the Raahi mobile app surface Adi Kailash content for a signed-in user
without a sync job.

`docs/DECISIONS.md` (D6) lists four silent failure modes this arrangement creates —
read it before writing a migration. The most dangerous: a misconfigured Alembic filter
generates `DROP TABLE` for all 31 of Raahi's tables.

## Repo layout

```
apps/
  web/            Next.js public site (later: traveller portal)
  api/            FastAPI service
docs/
  handoff/        The 10 source handoff documents (markdown)
  DECISIONS.md    Decision register — read before inventing policy
  ARCHITECTURE.md This file
  brand/          Provisional brand exploration (reference only)
```

## Module boundaries

Doc 08 lists 14 logical modules. They live in one FastAPI app initially; the
boundaries are enforced by package structure, not deployment. Phase 1 needs five:

1. **brand** — name, tagline, logo, colours, legal entity, operator disclosure,
   contacts, social. Single source. Read by web at build time.
2. **catalogue** — Journey, ServiceTier, Destination, ItineraryVersion, ItineraryStage,
   Stay, MediaAsset (with provenance).
3. **departures** — Departure + its state machine, capacity, operator assignment.
4. **status** — RouteSegment, StatusUpdate with source type, verifier, timestamp,
   expiry. Drives the live-status page and affected-departure resolution.
5. **leads** — Lead, Contact, Consent, attribution, stage, owner, next action.

Deferred to later phases: proposals/reservations, payments, traveller/documents,
vendors/allocations, tasks/incidents, portal, analytics warehouse.

## The two state machines that matter

Both are code-managed (doc 08: state transition rules are *not* content-managed),
and both require an authorised role plus a recorded reason to advance.

**Departure** — `draft → feasibility_review → proposed → waitlist_open →
conditional_reservation → open_for_booking → minimum_group_pending → confirmed →
preparation → ready_to_depart → in_progress → completed`, with `suspended`,
`rescheduled` and `cancelled` reachable from most states.

Invariant, from doc 08's data-quality rules: **public departure state must be
compatible with the payment action offered.** A suspended or permit-pending departure
cannot expose a pay button. This is enforced server-side, not in the UI.

**Status update** — `field_input → unverified_note → reviewed → published_verified →
stale → expired`. A published status carries source type, verifier identity, verified-at
and next-verification-due. Past `next_verification_due` it renders as stale
automatically — no cron required for correctness, the staleness is derived at read time.

## Integration boundaries

Each external provider sits behind a thin port so the vendor choice stays reversible
(doc 08 principle #6). Nothing above the adapter uses provider vocabulary.

- `messaging` — WhatsApp (provider TBD, O9), email, SMS fallback. Business events
  *request* a message; the adapter delivers it.
- `payments` — provider TBD (O8). Idempotent webhook handling; a payment never
  confirms a departure by itself.
- `storage` — private object storage for traveller documents, signed time-limited
  access only. Built in Phase 2: `/booking` opens from the same token as
  `/documents` and shows state, party, payment trail and accepted terms.
- `analytics` — behavioural events client-side, business events server-confirmed.
  These stay distinguishable (doc 07's requirement).

## Phase 1 slice

Everything else in the pack waits. Phase 1 is what lets a stranger find them,
believe them, and start a conversation:

- Home, flagship journey page, departures list, live status, Plan Your Journey hub,
  policy pages, Our Story
- WhatsApp CTA carrying journey/departure/page/campaign context
- Lead capture with consent and attribution
- Admin sufficient to edit journeys, departures and publish a verified status

Reservations, the traveller portal, the departure manifest and booking updates are
built. Suppliers, payables, rooming, the departure manifest and the incident record are
built. Online payments (blocked on O8) and Phase 4 growth are what remain
and can run on spreadsheets for the first departures. Doc 09 explicitly permits this:
"Manual is acceptable; invisible is not."

## Non-functional targets

- Core content readable and enquiry usable with images, maps and JS degraded.
- Status text must exist in server-rendered HTML, not only in a client widget.
- Status never communicated by colour alone.
- Reduced-motion honoured.
- Devanagari treated as first-class, not a smaller subtitle under English.
