# Decision Register

Doc 00 asks for this explicitly: a live record of what is decided, what is open, and
who owns each open item. Coding agents must not silently invent anything listed as OPEN.

Last updated: 8 August 2026

---

## Decided

| # | Decision | Choice | Date | Rationale |
|---|---|---|---|---|
| D1 | Frontend framework | **Next.js App Router** + TanStack Query + Bun | 2026-08-08 | Docs 03 and 07 make organic search the primary acquisition channel: crawlable HTML, an indexable live-status page, and heavy original photography on slow mobile connections are all P0. Next's SSG/ISR, metadata and image pipeline serve those directly. TanStack Router was considered and dropped — it does not compose with Next's own router. TanStack Query is retained for client-side data. |
| D2 | Backend | **FastAPI + uv + PostgreSQL** | 2026-08-08 | The operational domain (departures, readiness gates, allocations, status verification) is genuinely relational. Python keeps the door open for the AI-assist layer described in doc 08 without a second runtime. |
| D3 | Working brand | **"The Sacred North"**, provisional | 2026-08-08 | Retained as the pack's working name until trademark and domain clearance. Per doc 02 this changes nothing structurally: every brand string stays central configuration. See D4. |
| D4 | Brand portability | All brand values live in one config module; no brand string in any page, template, table name, route or env var | 2026-08-08 | Doc 02's hard requirement and doc 03's launch acceptance scenario #5. Makes D3 cheap to reverse. |
| D5 | Positioning | **Tiered, with homestay immersion as the hero tier** | 2026-08-08 | Conventional shared departures carry volume and proven demand; a distinct homestay-led journey carries the brand story and is the one axis where local roots in Pithoragarh cannot be copied by a Delhi operator. Requires building a real host network — tracked as an operational dependency, not a content exercise. |
| D6 | Database | **Share the Raahi Supabase Postgres; own the `yatra` schema only** | 2026-08-08 | Lets Adi Kailash content surface inside the existing Raahi mobile app later without a cross-database join or a sync job. `leads.raahi_user_id` → `public.users(id)` is the seam. See the shared-database rules below — they are not optional. |
| D7 | Admin | **Custom admin inside the Next.js app, behind staff auth** | 2026-08-08 | Doc 06 requires role-based permissions, approval workflow and audit that a generic table editor cannot express. Also keeps operations away from Raahi's tables — Supabase Studio on this database exposes passengers and payments. |
| D8 | Staff auth | **better-auth, staff tables in `yatra`** | 2026-08-08 | Same library the Raahi backend uses, so no new concept for the team. Staff identity stays separate from Raahi's passenger pool in `auth`. Per-person attribution is required: doc 09 makes status publishing and departure state changes attributable. |
| D9 | Languages | **English + Hindi from launch** (O11 closed) | 2026-08-08 | Doc 01's primary segment — the called pilgrim, 35–65, devotional — is Hindi-comfortable. Doc 02: Devanagari is a first-class layout, never a smaller subtitle under English. |
| D10 | Launch scope | **Three journey families: Adi Kailash & Om Parvat, Kumaon circuit, homestay immersion** (O6 partially closed) | 2026-08-08 | Wider than doc 09's "smallest coherent system" advice. Accepted deliberately: the Kumaon circuit sells in the months the Adi Kailash route is shut, and the homestay journey carries D5's differentiation. Cost is roughly triple the content and vendor work in a fixed eight-week photography window — that window, not engineering, is the binding constraint. |

| D12 | O2 · Who sells the trip | **Own tour-operator registration** | 2026-08-10 | Founders chose to register and contract with travellers directly rather than fronting a licensed partner's registration. Slower to launch than the partner route, but doc 06 warns against a site that "implies a partner's registration belongs to the brand owner", and owning it removes that risk entirely. A partner may still operate a segment on the ground, so `operator_assigned` stays a confirmation gate: somebody registered has to be responsible for the inner line before anyone is told they are going. Makes **O1 the critical path** — the entity is now the thing being sold under. |

| D13 | O3 · How money works, first season | **Offline only** | 2026-08-10 | No payment is taken on the website for the 2026 test departures. A coordinator records what arrived by bank transfer or UPI against the reservation, with its reference, so finance reconciles against a statement. Zero gateway risk while operations are still unproven, and it defers O8 without blocking anything. `PaymentRecord` is an append-only ledger with no balance column, so the balance is the sum of the evidence and cannot be quietly corrected. `PaymentMethod.GATEWAY` exists and is refused at the API, so adding a provider later is a change of behaviour rather than of schema. |

| D14 | Vehicles, drivers and guides | **Hire per departure from local suppliers** | 2026-08-11 | No fleet. The unit is a *booking of a supplier for a departure*, which is how a three-person team actually runs a first season, and it avoids modelling a scheduling problem nobody has. An owned vehicle, if one is ever bought, is recorded as a supplier the company happens to control, so nothing needs rewriting if that changes. |

| D15 | Supplier money | **A payables ledger mirroring the customer one** | 2026-08-11 | Append-only, no balance column on either side of the business, so neither can drift from its evidence and a mistake is corrected by recording a refund rather than an edit. The symmetry is what makes per-departure margin real rather than a spreadsheet guess, which doc 09's Phase 4 calls unit-economics visibility. Still offline: no gateway on either side. |

| D16 | Rooming granularity | **Traveller to stay, per night** | 2026-08-11 | Precise enough to answer a family asking where their parents will sleep, which doc 01 puts at the centre of this business, and no more precise than a 3-4 bed shared room in somebody's house can actually be. Room-level allocation was rejected: those rooms rarely have stable identities to allocate against. Over-capacity is a blocker, not a note, because it is what leaves a family outside at night at altitude. |

| D17 | Route alerts | **Send on change, never on re-verification** | 2026-08-12 | A coordinator re-verifies a segment roughly twice a day through the season. Alerting on every publish would produce ~60 messages a season saying the road is still open; everyone mutes us, and the one message that says it *closed* lands in a channel nobody reads. So `material_change()` compares access to the previous published access and returns false when nothing moved — the page still updates, which is where somebody who wants to check goes. Closure is urgent and ignores the 21:00–07:00 IST quiet window; everything else waits for morning. Three messages per subscriber per day is a hard cap, and a segment flapping past it is an operations problem, not something to forward. Rules live in `domain/subscriptions.py` with no database, so they are testable against a season before anyone is messaged. |

| D18 | Unsubscribing | **One click, no login — but the click is a POST** | 2026-08-12 | The link in every message resolves to a page with a single button rather than unsubscribing on load. Corporate mail scanners and link-preview crawlers fetch every URL in an incoming message before the recipient sees it, so a mutating GET would silently unsubscribe people who never opened the mail. Idempotent by design: a second click returns success, not an error. Anything already queued for that subscriber is suppressed rather than sent, because a message going out *after* somebody left is the most common way this kind of system breaks its promise. |

| D19 | Post-trip reviews | **The public-review request is gated on resolved complaints, with no override** | 2026-08-12 | Doc 07 numbers the review flow: collect private feedback, *then* resolve material complaints, *then* ask for a public review. That ordering is the design, so it lives in code rather than in a coordinator's memory. `review_request_blockers()` returns every reason and the endpoint refuses with 409 while any remain; resolving requires a written note of what was actually done, enforced at the schema, the domain and a database check. There is deliberately no `force` flag — an override is how step 2 quietly becomes optional on a busy Tuesday, and asking somebody for a public review while their complaint is open is how a private, fixable problem becomes a permanent public one. Below 8/10 on the recommendation question we do not ask at all: the right follow-up there is a phone call. No review wording is ever stored or suggested (doc 07: "without scripting false praise"), and image, video and story permissions are three separate booleans so agreeing to write a sentence does not put a family's photograph on a landing page. |

| D20 | Referrals | **Attribution and recognition, no discount** | 2026-08-12 | Doc 07: "The most powerful referral message is reliable delivery, not a large discount." So `benefit` is null at launch. A large discount also selects for the wrong referrals — people forwarding a link for money, to people who did not ask. Codes carry the referrer's initials (`MB-T5XVM3`) because attribution they can see is what makes somebody comfortable passing it on, and the alphabet excludes 0/O and 1/I/L because these get read aloud over a phone and typed by somebody's father. An unrecognised code is still recorded rather than discarded: a coordinator who can see what was typed can find the right traveller and thank them. Terms are versioned, and carry doc 07's restriction against soliciting inside spiritual communities. |

| D21 | Family sharing | **A constructed projection, never a filtered reservation** | 2026-08-12 | Doc 05 lists six things to show a non-travelling relative and four to exclude. The obvious implementation — load the reservation, strip the sensitive fields — is a deny-list, and deny-lists fail silently in one direction: somebody adds `passport_number` to a traveller record in eighteen months, nobody updates the stripper, and a mother is looking at her son's passport number on a link she forwarded to four relatives. Nothing breaks, no test fails. So `FamilyView` is built field by field from explicit arguments, has no constructor that takes a `Reservation`, and a test walks the type against a forbidden-field set — including nested types, because the realistic leak is somebody enriching `SharedDay` with a homestay's address. The single exception, `SharedContact.phone`, is named per-type rather than by weakening the rule; it carries company numbers only. Travellers appear as first names: "is Amma on this trip" is reassurance, a full name beside a date of birth is a contact list. |

| D22 | Trip companion | **Cached, and honest about how stale it is** | 2026-08-12 | There is no mobile network above Dharchula for two days at a stretch, so a companion that needs the network is worthless exactly where it matters. A narrowly-scoped service worker keeps the document loadable and the payload is cached in `localStorage`; one request rather than five, because a page assembled from several endpoints renders four-fifths of itself in the one place it has to work. Every payload carries `generated_at` and the page shows its age. "Could not reach us" is claimed only after a request has actually *failed*, never merely while one is in flight — on a page whose entire value is being straight about how old its information is, that distinction is the feature. Check-ins are posted by a person, never inferred from the itinerary: an automatic "they should be in Gunji by now" is a claim we cannot stand behind at the moment a family is relying on it. |

| D23 | Specialised enquiries | **One pipeline, one discriminator, one side table** | 2026-08-12 | Private/international and B2B ground-handling enquiries get their own pages and their own fields, but land in the same `leads` table with an `enquiry_kind` and an optional `enquiry_details` row. Doc 04 wants one pipeline with one set of stages, owners and next actions; three tables would give a three-person team three inboxes and guarantee the quietest one goes unread for a week. The extra answers are real typed columns rather than JSONB — a coordinator filters on time zone to schedule calls that do not land at 3am for the traveller. Every field except a contact method is optional (doc 03: "Ask only what is necessary for the current stage"), and accessibility needs are set apart, explained, never required, and never shown in a list view. |

| D24 | WhatsApp, human half | **+91 83408 58764 for wa.me links — and this number must NOT be registered on the Cloud API** | 2026-08-13 | Settles the traveller-facing half of O9: a number a person answers, feeding every `wa.me` link with journey and departure context (doc 04: "The customer should not have to repeat which package they were viewing"). It removes `whatsappNumber` from `undecidedLaunchBlockers()`. It does **not** enable outbound alerts, and the two must not be conflated. Registering a number on the WhatsApp Business Platform *removes it from the consumer WhatsApp app* — putting the founders' working number on the Cloud API would take away the phone they run the business from, which is close to irreversible in practice. The API number, when O9 settles, must be a second number. Note also that route alerts are business-initiated messages: WhatsApp requires pre-approved **template** messages outside a 24-hour reply window, so the free-form bodies `domain/subscriptions.py` produces map cleanly to email but will need restructuring into templates with variable slots for WhatsApp. Email is the honest first channel for alerts; WhatsApp is the honest first channel for conversation. |

| D25 | Templated channels | **Alert wording restructured as pre-approved templates, with email keeping prose** | 2026-08-13 | WhatsApp refuses free-form business-initiated messages outside a 24-hour reply window, and India's TRAI DLT regime imposes the same rule on SMS — so `domain/templates.py` holds four Utility templates with the exact text to submit, and `OutboundMessage` gained `template_name` and `template_parameters` (deliberately provider-neutral names, since both regimes need the same two things). The unexpected benefit is that the caveats become *structural*: once "not a forecast" and "do not set out before speaking to us" are fixed reviewed text, nobody can send a closure alert without them, where in prose they were a convention somebody maintained. `submission_problems()` encodes the rejection rules and is asserted per template in tests — it caught three of the four bodies opening on a variable, which Meta rejects and which is invisible when you read the wording. Runtime values are sanitised because Meta rejects a parameter containing a newline (a coordinator types notes on a phone) and rejects an empty one, both of which fail per-message long after review passed. Email keeps prose and its unsubscribe link; WhatsApp's opt-out is the template's fixed "Reply STOP" footer, because a URL inside a template parameter is both a rejection risk and a phishing pattern. `docs/WHATSAPP-TEMPLATES.md` is generated from the registry so the submitted text and the sent text cannot drift. |

| D26 | Acquisition reporting | **Contribution by source, never revenue by source** | 2026-08-13 | Doc 07 ends its measurement section with "Do not report return on ad spend using gross booking value alone when supplier costs, refunds and conditional reservations materially affect the business." All three do here, so the report subtracts or separates all three before ranking anything: supplier cost apportioned per traveller (per head, because a seat, a permit and a bed are what is actually consumed — apportioning by revenue share would make a discounted party look cheaper to serve), refunds subtracted rather than netted into revenue, and proposed/held reservations kept in a separate at-risk bucket because doc 05 calls a hold "explicitly not a booking". `SourcePerformanceOut` deliberately has no field called `revenue`. Ranking puts low-confidence sources last regardless of contribution: fewer than four confirmed bookings and one unusual party dominates the average, and the first row of a report is the one that gets acted on. `cost_per_qualified_lead` returns `None` with no recorded spend rather than zero, because zero reads as "free" and the two render identically in a table unless the type forbids it. `AcquisitionSpend` is hand-entered and expected to be empty while the founders stay organic-first. |

| D27 | Unattributed business | **Measured on contribution, not on leads** | 2026-08-13 | The first real run of the report said "0% unattributed" while a walk-in booking taken over the phone was quietly the best-margin business in the table — it has no lead row, so a lead-based share counted it as nothing. Money is what is being attributed, so money is what the share is taken over. Both figures are now reported, because the two diverging is itself the signal: a small share of leads carrying a large share of contribution means the good business is arriving through a door nobody is measuring. |

| D28 | Vendor performance | **Evidence and a sentence, never a score** | 2026-08-13 | Doc 06: "A future vendor score may assist planning, but serious incidents and manual judgement must remain visible rather than hidden in an average." The only reliable way to honour that is not to emit an overall number that could carry the whole answer, so `assess()` returns a headline sentence, blocking concerns, and per-dimension ratings — and `VendorAssessmentOut` has no `score` field. A serious or critical incident lands in `blocking_concerns` no matter how good the ratings are; a manual hold outranks everything computed. A near miss deliberately does *not* count against a vendor, because doc 06 calls it the most valuable row in the incident table and penalising it would teach coordinators to stop recording them. Ratings are withheld entirely below three reviewed departures rather than shown with a caveat — a number on a screen is remembered and the caveat beside it is not. Coordinator ratings and traveller ratings are never averaged together: the coordinator chose the vendor and may have to defend that choice, the traveller has no such stake, and when the two disagree that gap is the most informative thing on the page. Traveller ratings reach a vendor only through `FEEDBACK_DIMENSION_BY_KIND`, so a driver is never credited for a good homestay. |

| D29 | Unsettled supplier cost | **An unpaid vendor is a debt, not a saving** | 2026-08-13 | The first real run of the vendor report showed `cost variance -3,00,000` against a vendor that had simply not been paid yet — an unpaid invoice wearing the clothes of a three-lakh underspend, on a screen a founder reads for exactly that kind of number. `CostVariance.is_settled` now gates it: variance is reported as a performance signal only once everything agreed has been paid, and until then the row reports `outstanding` instead. Same family of error as D27 — a derived figure that is arithmetically correct and means the opposite of what it appears to. |

| D30 | Altitude profile | **Sleeping altitude against published guidance — and never a verdict on a person** | 2026-08-13 | Phase 5 lists an "interactive 3D terrain and altitude experience"; this is the half that helps a 62-year-old decide, and doc 03's non-goals rule out the other half ("a cinematic 3D homepage that delays essential information"). Sleeping altitude, not the day's peak: you can walk to 4,500m and sleep at 3,200m and be following the guidance perfectly, and using the peak would flag a well-designed itinerary as reckless. A rest night is derived as sleeping in the same place two nights running, so it cannot drift from the itinerary it describes. **The standing constraint — "no medical clearance, diagnosis or fitness certification, by human or AI" — is what shapes the output.** Every sentence is about the *schedule* measured against *published general guidance*, attributed as such; there is no risk score, no traffic light and no `is_safe` anywhere in the module, and a test asserts their absence. A green tick on this page is the thing that talks somebody out of seeing a doctor. The guidance is stored as a range (300-500m) because the literature disagrees and a single number would be false precision. Server-rendered inline SVG with the same data repeated as text: doc 02's audience is mid-range Android on mobile data, doc 03 says the text itinerary stays the source of truth, and a canvas chart is invisible to both a screen reader and an answer engine. |

| D31 | Altitude provenance | **Recorded is not verified; only verified figures are plotted** | 2026-08-13 | Altitudes carry a required source and a separate `altitude_verified` flag defaulting to false, and the public profile treats an unverified figure exactly like a missing one — the chart shows the gap and names the place. Prompted by catching myself: having built a required-provenance field precisely to stop unattributed numbers, I then seeded it with plausible source strings for figures I had not checked. The numbers are stored for operations to work from and are labelled `UNVERIFIED SEED VALUE`; none reaches the public page until a person confirms it. Missing altitudes are never interpolated from neighbours either, and a gap breaks the gain chain rather than spanning it — computing Dharchula to Gunji across an unrecorded night would invent a single 2,260m jump nobody is making. |

| D32 | Assistant | **Refusal is a pure function that runs before the model, not a rule inside it** | 2026-08-13 | Doc 04 lists what AI may not do independently: medical clearance, price or policy commitments, promises about a hotel or a view, resolving a complaint, confirming status without an approved source. The usual implementation puts those in the system prompt and trusts the model. Here `refusal_for()` is a deterministic function over the question text, checked before any network call — a question about somebody's heart condition is refused by code and the model never sees it. The contract carries the same rules as a second layer, but the layer that has to hold holds without a provider. Patterns are deliberately broad: a false refusal costs one handover to a human, which this system does well; a false answer about somebody's heart costs something that cannot be undone. Refusals render at the same visual weight as answers, because "this needs a doctor" *is* the correct output, and styling it as an error teaches people to retry until it gives in. |

| D33 | Retrieval | **Postgres FTS, not pgvector — because the database is Raahi's too** | 2026-08-13 | `pgvector` installs with `CREATE EXTENSION`, which is database-wide on a database shared with Raahi's production application. D6's shared-database rules exist to stop this codebase making changes with blast radius outside the `yatra` schema, and installing an extension to improve our own search is exactly that. Native FTS needs no extension and suits a corpus of a few dozen guides where questions are concrete ("inner line permit", "Gunji") rather than semantically oblique. If the corpus outgrows lexical search, a vector service *outside* this database is the answer. Terms are ORed rather than ANDed: `plainto_tsquery` turned "Where do I get the inner line permit?" into `get & inner & line & permit` and scored nothing against a guide titled almost identically, because the guide never says "get". A question is a sentence, not a boolean expression. |

| D34 | Public attribution | **Named verifier, never their email** | 2026-08-13 | Attribution is stored as "Name <email>" because an internal audit trail wants an identifier unambiguous between two people called Suresh. The public `/status` feed was returning that string verbatim — staff inboxes on an unauthenticated endpoint, scrapeable, though the website never rendered them. Found sideways: the assistant quoted a status sentence with an email in the middle of it. `public_attribution()` now strips it at the public boundary, and doc 02's requirement is still met — a *named* verifier makes the claim somebody's responsibility, and the address adds nothing to that. |

| D35 | Route history | **Four readings AND two seasons before any verdict** | 2026-08-13 | Per segment, per ISO week, what our own verified readings recorded — the first thing in the system that answers "when should I go" rather than "it depends on the road". ISO week not month, because the road opens and shuts on a scale of days and "May" spans the whole difference on this route. The threshold was wrong first time and running it against realistic data proved it: six readings per week silenced every week, because two seasons of twice-weekly checking gives exactly four. The count was aiming at the wrong failure — the risk is *one unusual year being the whole picture*, so the gate is now four readings across at least two seasons, and eight readings from one May says so in those words. Everything is past tense, asserted by a test that rejects "will be", "should be", "expect", "likely" and "predict": the moment this reads as a forecast it becomes a promise about a road nobody controls. "Usually open" needs 80% — it is the phrase somebody books flights against, and at 75% the honest word is "mixed". |

| D36 | Brand portability | **Checked, not assumed** | 2026-08-13 | D4 claims no brand string appears outside the brand config and D3 makes the working name provisional, so D4 is load-bearing rather than tidy — but nobody had ever verified it. `bun run check:brand` reads the settled values *from* the config and greps `apps/` for them, so it keeps working the day the brand changes; a check that needs editing when its subject changes is one that gets deleted. Its first run failed on a line written that same afternoon by somebody who had read D4 — the brand name in the OpenRouter attribution header. The API now takes it from `PUBLIC_BRAND_NAME` and omits the header when unset. Added to the deploy preflight. |

| D37 | Partner portal | **Scoped by token, never by URL — and read-only** | 2026-08-13 | An operating partner sees their own departures and the public route record. There is no endpoint anywhere that takes a partner id, so changing a number in the address bar reaches nothing, and a test asserts that no such parameter exists — scoping by query filter is correct right up until somebody adds a convenience endpoint that takes an id, which would look entirely reasonable in a diff. Read-only by construction, also asserted: doc 06 keeps departure lifecycle and status publishing behind named staff roles. Travellers appear only as a head count; the manifest stays with the coordinator accountable for it (doc 08). Tokens are hashed unlike the traveller and family ones — this is closer to an API credential, it goes to another company, and it expires by default. |

| D38 | Vendor reliability score | **A real 0-100 score, capped by any open concern** | 2026-08-13 | Supersedes the "no score" position in D28, at the founders' request — and doc 06 does permit one: "A future vendor score may assist planning, **but** serious incidents and manual judgement must remain visible rather than hidden in an average." The usual way to honour that clause is to print the incidents beside the number and hope somebody reads them. They do not; the number is what gets sorted on, pasted into a message and remembered. So the clause is enforced in the arithmetic instead: a blocking concern caps the score at 40, below anything anybody would read as fine, and the cap lifts when the concern is *settled* rather than when the average improves. Ten perfect reviews against one serious incident scores 40, not 100, and the explanation says so in those words. Components are weighted (coordinator ratings 45%, willingness to use again 35%, traveller ratings 20%) and a component with no data is dropped with the weights renormalised, never scored zero — a vendor nobody rated on cleanliness has not scored badly on it. No score at all below three reviewed departures. The list still sorts by recommendation first and score second: a score-ordered table is a league table, which is the framing doc 06 is guarding against. |

| D11 | i18n | **next-intl, `localePrefix: "always"`** | 2026-08-08 | `/en/...` and `/hi/...` symmetrically, rather than English at the root with Hindi in a subfolder — the structural form of doc 02's "first-class layout, not a smaller translation". Makes hreflang pairs trivial. Note Next.js 16 renamed the `middleware` convention to `proxy`, so the handler lives in `apps/web/proxy.ts`. |

**Two i18n layers, deliberately separate.** next-intl covers UI strings, locale routing
and formatting — things developers change. The JSONB fields below cover journey
content — things operations edits without a deploy. Devanagari faces load on both
locales, because an English page still renders Hindi place and journey names.

### Localized content storage (D9)

Translatable text is a JSONB object, `{"en": "...", "hi": "..."}`, not paired `name` /
`name_hi` columns. A CHECK constraint requires the `en` key on every such field.

Chosen because O11 anticipated "more later": a third language needs no migration, and
paired columns would have added roughly twenty `_hi` columns across the catalogue.
One row still carries every locale, so PostgREST reads from the Raahi mobile app stay
a single query. The tradeoff is weaker type safety and the need for an explicit
fallback helper when a Hindi translation is missing — `localized()` on the web side
falls back to English rather than rendering an empty string.

### What D5 changes downstream

The pack (docs 01, 03) treats accommodation as a liability to disclose honestly —
"Accommodation reality", "transparent comfort", the job of the section is to reduce
future disappointment. Under D5 that stays true for the shared tiers, but the homestay
tier inverts it: the stay **is** the product. Concretely:

- Journey model needs stays as first-class narrative content (host, family, village,
  kitchen, what a night there is actually like), not just a category label per segment.
- Photography brief for the Sept–Oct 2026 window must cover hosts and interiors as
  hero assets, not as evidence-of-honesty thumbnails.
- Vendor records for homestay hosts carry different fields than hotel vendors
  (doc 06's vendor model assumes properties with room counts and rate cards).
- Pricing must be able to route a larger share to the host — the stated reason for
  the tier existing.

### Shared-database rules (D6)

One Postgres now serves two products. Supabase project `<project-ref>`, ap-south-1.

| Schema | Owner | Our access |
|---|---|---|
| `public` | Raahi intercity cabs — 31 tables, better-auth, `alembic_version` | **Read-only, via their service.** Never migrate. |
| `auth` | Supabase GoTrue | None |
| `yatra` | This project — 14 tables | Full |

Four traps, each of which was hit and fixed while setting this up. All are silent
failures — nothing warns you:

1. **Alembic autogenerate will try to drop Raahi's entire database.** Postgres reports
   the default schema (`public`) as `None`, not by name, so a deny-list filter misses
   it and autogenerate reads all 31 Raahi tables as "removed". The first generated
   migration contained 44 `DROP TABLE` statements. `alembic/env.py` now uses an
   *allow-list* (`name == "yatra"`) in both `include_name` and `include_object`.
   **Audit every generated migration for `op.drop_table` in `upgrade()` before running it.**
2. **Migration heads must not share a table.** `public.alembic_version` is Raahi's.
   Ours is `yatra.alembic_version`, via `version_table_schema`.
3. **Enum types do not inherit the metadata schema.** Without `inherit_schema=True`
   SQLAlchemy runs `CREATE TYPE public.departure_state`, littering Raahi's schema.
   Use the `pg_enum` helper in `api/db.py`, never a bare `Enum(...)`.
4. **Python-side `default=` is invisible to Postgres.** The mobile app will reach this
   data through Supabase PostgREST, which bypasses SQLAlchemy entirely, so every
   defaulted column also carries `server_default`.

Also: enum labels use `values_callable` so the database stores `open_for_booking`,
not `OPEN_FOR_BOOKING`. And `anon` was deliberately **not** granted on `yatra` —
departures, leads and traveller data are not world-readable.

---

## Open — needed before taking money

| # | Decision | Owner | Blocks |
|---|---|---|---|
| O1 | Legal entity and public legal name | All founders + adviser | **Critical path since D12.** Invoicing, contracts, footer, payment recipient. Own registration means there is no partner entity to fall back on |
| O4 | Cancellation, refund and route-disruption policy | Finance founder + adviser | Policy versioning, proposal content |
| O5 | Route-status source hierarchy and authorised publisher | Operations founder | Live status page (a P0 surface) |
| O6 | Final journey list, itineraries and service tiers | Operations founder | Journey content model population |
| O7 | Domain | Brand founder | Canonical URLs, email identities |
| O8 | Payment provider | Finance + tech | Payment adapter. Deferred by D13: nothing is blocked until online payment is wanted, which is a 2027-season question |
| O9 | WhatsApp **provider** (Business Platform or authorised BSP) | Tech + sales | Messaging adapter. **Half closed by D24: the human number is set, the sending path is not.** Everything upstream of sending is built and running — subscribe, confirm, unsubscribe, and every route change producing the exact rows that would go out at `GET /admin/alert-queue`. `sending_enabled` stays hard false. See D24 for why the site number must not be the API number |
| O7 (note) | Domain | Brand founder | Additionally blocks the unsubscribe link: until `PUBLIC_SITE_ORIGIN` is set, queued message bodies carry a visible `[SITE ORIGIN NOT CONFIGURED]` placeholder instead of a silently relative link |
| O10 | Support hours, escalation and emergency ownership | Operations founder | Response-time claims on the site |


---

## Standing constraints (from the pack; treat as non-negotiable)

- Never publish guaranteed darshan, weather, route, visibility or spiritual outcome.
- Never present a departure as confirmed because a payment succeeded — confirmation
  requires operator, permit and minimum-group conditions to be met.
- Never mark route status "live" without a functioning verification process; stale
  status must become *visibly* stale.
- Never expose traveller identity documents through public or broadly-accessible links.
- No medical clearance, diagnosis or fitness certification, by human or AI.
- Real accommodation imagery only for real stays. Label provenance on every asset:
  original / supplier-provided / licensed / illustrative / AI-generated.
- No fabricated testimonials, traveller counts, ratings or awards.

---

## Timing note

It is 8 August 2026, mid-monsoon. The Adi Kailash season runs roughly May–October.
This season's demand is largely spent, which makes the target the **2027 season**.
The Sept–Oct 2026 window is therefore for running one or two real departures and
capturing the original photography and field content that docs 02 and 07 make
non-substitutable. Content acquisition, not code, is the critical path.

---

## Reference designs (2026-08-09)

Four sample-site images were provided and used as visual direction. What was taken
and what was deliberately rejected:

**Taken**
- The live status bar as the element that occupies the top of the page (ref 2). Route,
  permits, weather and a verification timestamp, side by side.
- Deep navy surface with restrained gold, editorial serif display (refs 1 and 3).
- Journey cards carrying duration, gateway and difficulty rather than only a photo.
- Document checklist as a real, first-class page section (ref 2).
- Devanagari used with dignity alongside English (ref 3).

**Rejected, on purpose**
- `100+ Curated Journeys`, `15+ Years of Experience`, `4.9/5 Traveller Rating`,
  `1000+ Pilgrims Travelled with Us`. Doc 02 bans "fake traveller counts, awards or
  ratings" and doc 09 bans "unverified traveller counts, awards or ratings". The
  company has run zero departures; every one of these would be a fabrication on the
  page whose job is to prove it tells the truth.
- The testimonial from "Ananya Mehra, Mumbai". No traveller has travelled yet.
- Prices (`From ₹28,500`). Deposit and pricing rules are decision O3, unapproved.
- AI-generated Shiva and mountain imagery presented as the real route. Doc 02 bans
  both "AI-generated travel images presented as real locations" and "unrelated Nepal,
  Tibet or Ladakh imagery labelled as Adi Kailash".

Photography is therefore reserved rather than faked: `PhotoSlot` renders a labelled
empty frame that holds its aspect ratio and states what belongs there. Generic stock
would have violated the same rule the site exists to demonstrate.

### Design-skill conflicts, resolved

The `taste-skill` and `impeccable` skills were applied. Two of their defaults conflict
with the handoff docs, resolved as follows:

- **Serif display.** Both discourage serif by default. Permitted here because the
  brand brief names one (doc 02: EB Garamond / Cormorant / Playfair) and the register
  is genuinely editorial-heritage. EB Garamond is not one of the two banned defaults.
- **Warm off-white palette.** `impeccable` flags the `#F7F6F2` cream family as the
  saturated 2026 AI default. Doc 02 specifies it as a brand token, and committed brand
  colours win over the generic rule, but the site leads with navy carrying the surface
  rather than cream-on-cream, which satisfies the intent behind the warning.
- **Em-dashes** are banned in visible copy by `taste-skill`, so status labels, seeded
  content and page copy use full stops or hyphens instead.

---

## D39 — Two registers, and what decides which

**Navy carries what we have verified. Off-white carries what we are offering.**

Live route state, permits, altitude and weather are dark. Journeys, homestays,
guides, planning and reading are light. This is why the home page opens dark and
turns light, and why the route instrument at its foot returns to navy. It is not
alternation for variety; it is the line the API already draws between a timestamped
reading and a piece of marketing copy, made visible.

It also settles per-page treatment with no further argument: `/status`, `/trip`,
`/booking`, `/documents` and the family view are dark throughout; `/journeys`,
`/plan`, `/guides`, `/departures`, `/private`, `/partners`, `/policies`, `/enquire`
and `/feedback` are light throughout.

Components read `--tone-*` and never a fixed colour, so the same component renders
correctly in either. Anything rendering outside a register falls back to light.

## D40 — Status colours are register-relative

Doc 02's status palette is drawn for a light background and several values are
unreadable on navy. Measured against `#0b1d2d`: open-teal `#2d5d5f` is **2.32:1**,
less than half the 4.5:1 body minimum, and limited and unverified both sit near
3.7:1. Each was being used as the text of a status label.

`--color-status-*` therefore resolves through a `--status-*` variable that each
register sets, so `text-status-open` means "open, in whichever register this element
is". Dark variants are the same hues at reduced chroma and raised lightness, each
taken to the first value clearing 4.6:1.

Gold stays out of body text on light: `#c89a4e` on snow is 2.37:1. It survives as the
link underline and the contour colour, where it points without needing to be read.

## D41 — Weather is corrected for elevation, or it is not published

Open-Meteo is used because it reports the elevation its own grid holds **and lets you
override it**. OpenWeatherMap, WeatherAPI and Visual Crossing report neither, which is
disqualifying here rather than inconvenient: you cannot correct an error you cannot
see.

Within a 10 by 8 km box near Gunji the ground spans 2,876 m inside one model grid
cell, and no regional high-resolution model covers India. Uncorrected, Nabhidhang
reads 5.4 C too cold and Jyolingkong 4.4 C too warm on the same day, in opposite
directions.

`timezone=auto` is banned: it returns **Asia/Kathmandu** for Nabhidhang, Kalapani and
Lipulekh, because the geocoder resolves the disputed border in Nepal's favour.

Readings come from two genuinely different models and are shown as a range. A single
model's ensemble is under-dispersed here (about 2 C against 8.8 C across models) and
believing it would manufacture confidence.

The free tier is non-commercial. `OPEN_METEO_API_KEY` moves to the paid host, and
that becomes a launch requirement the day journeys are sold.

## D42 — Third-party data never borrows our verification language

`/live` is separate from `/status` and renders in its own section below it. A scraped
government table and a coordinator who drove the road are different kinds of claim,
and a reader who cannot tell them apart will trust the wrong one.

Every response carries a coverage note stating that no official source reports road
status above Tawaghat and no weather station exists on the route, so a UI cannot
render the readings without the caveat. The permit portal's notice is passed through
verbatim; a paraphrase of "suspended until further orders" is a liability.

A stale reading keeps its payload and loses its freshness: `fetched_at` only advances
on success, so a failing job can never make old data look current.

## D43 — Route statuses are not seeded from research

Eight route statuses still read `verified_by = "DEMO DATA - not a real verification"`
and will keep reading that until a coordinator enters real ones. A route status means
a named person checked that stretch on that date. No amount of research produces one,
and replacing them with plausible entries to clear a warning banner is the exact
failure this site exists to prevent.

## D44 — `check:copy` guards the two things comps smuggle in

Em-dashes in user-visible text, and claims with nothing behind them. The redesign
mockups arrived carrying traveller counts, a Trustpilot score, "Since 2010", years of
experience and a **98% safety record**, for a business that has not run its first
departure, on a route with no hospital above Dharchula. They looked entirely at home.

The check is verified to catch all seven, and verified **not** to fire on doc 09's own
disclaimer, which a naive pattern flags as the very thing it exists to prevent. A
check that fails on the disclaimer is a check people switch off.

## D45 — No fabricated verification survives in the database

Nine route statuses were deleted on 17 Aug 2026: eight labelled `DEMO DATA - not a
real verification`, one attributed to `ops@example.invalid`, a reserved non-domain.
There are now zero, which is the true count.

A route status asserts that a named person checked a named stretch on a given date.
Nothing except a coordinator can produce one. Research cannot, and a plausible entry
written to clear a warning is the precise failure this product exists to prevent.

The status page was changed at the same time, because an empty list rendered as **no
section at all**: a reader went from the heading "what our coordinators have actually
confirmed" straight to the weather and would reasonably conclude everything was fine.
Absence is now stated.

## D46 — The leaked Coolify token is contained, and still needs rotating

A full-privilege Coolify API token was printed into a session transcript. Assessed
rather than assumed:

- It reaches `/servers`, `/projects`, `/teams` and `/databases`. Full team scope.
- **Coolify's API is unreachable from the internet.** Port 8000 is filtered upstream
  by Hostinger, which is the same block that forced the SSH-with-forced-command
  deploy in the first place. Verified again on 17 Aug 2026: no route from outside.
- So using it requires shell access to the box first, at which point the token is not
  the weakest thing available.

It is hygiene rather than an open door. Coolify 4.0.0-beta.462 exposes no token API,
so creation is UI-only and a hand-inserted Sanctum row is rejected; this is why the
earlier programmatic attempt failed. Rotate in the UI, write the new value to
`/root/.coolify_ak_token` with mode 600, and nothing else needs changing.

## D47 — Four decisions block launch and none of them are technical

`legalEntityName` (O1), `operatorDisclosure` (O2), `domain` (O7) and `supportHours`
(O10) are unresolved, and `isLaunchReady()` is false because of them.

They are founder decisions. Inventing a legal entity name would be a legal
misrepresentation as well as the fabrication failure this codebase spends most of its
guardrails preventing, so the code states the gap instead and does so everywhere it
matters: the footer reads "Legal entity to be confirmed", `robots.txt` disallows the
whole site because no domain is settled, and payments are off.

Nothing is technically blocked. The site is deployed, public and working. What is
blocked is describing ourselves as a company somebody can contract with, which is
correct until somebody decides what that company is.

## D48 — The site went public with the photographs still generated

`sacrednorth.in` is live: DNS at the registrar points at Vercel, the certificate is
issued, and `NEXT_PUBLIC_SITE_URL` is set for production only, which is what turned
off `Disallow: /` and removed the staging notice.

That notice made two claims. One has been resolved properly: there are zero route
statuses in the database, so every leg renders "Never checked" and the page says "0 of
6 legs confirmed recently" and that anything unconfirmed above Tawaghat is genuinely
unknown. Nothing is asserted that nobody checked, which was the point.

The other has not. The scene photographs are still AI-generated, several of them of
Adi Kailash and Om Parvat, and they now sit on a public page with nothing marking them
as such. This was put to the founder with the alternative of a standing image credit,
and going live unmarked was chosen deliberately. Recording it because it is the one
claim on the site that the site's own guardrails do not cover: `check-copy` polices
prose, and there is no equivalent for imagery. Replacing them with real photographs
retires this entry; until then it is a known, accepted gap rather than an oversight.

**Preview stays provisional.** The variable is production-scoped on purpose. Setting it
on preview makes every per-push URL drop the staging notice and claim the real domain
in its canonicals, which is exactly what an origin-based signal exists to avoid.
