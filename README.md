# The Sacred North

A technology-enabled Himalayan spiritual-travel platform for Adi Kailash, Om Parvat
and the sacred landscapes of Kumaon.

> **"The Sacred North" is a provisional working name.** Every brand string lives in
> `apps/web/lib/brand/config.ts`. Changing it there changes it everywhere — that
> property is a launch requirement, not a nicety. Do not hard-code the name anywhere.

## Read before writing code

1. [`docs/DECISIONS.md`](docs/DECISIONS.md) — what is decided, what is open, who owns
   each open item. **Do not invent anything marked open.** Pricing, refund rules,
   permit guarantees, medical guidance, operator identity and route status are
   business decisions, not implementation details.
2. [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — stack, module boundaries, the two
   state machines, phase-1 scope.
3. [`docs/handoff/`](docs/handoff/) — the ten source handoff documents. Start with
   `00_Master_Handoff_Index.md`.

## Layout

```
apps/web/     Next.js 16 (App Router) public site
apps/api/     FastAPI service
docs/         Handoff documents, decision register, architecture
```

## Running

```bash
cd apps/web && bun install && bun run dev
```

## The rules that block a release

From doc 09: trust defects are severity-one. A launch is delayed for any of these,
and not for a missing 3D map.

- No guaranteed darshan, weather, route, visibility or spiritual outcome.
- A payment succeeding never confirms a departure by itself.
- Route status is never "live" without a real verification process; stale status
  must render as visibly stale.
- Traveller identity documents are never publicly accessible.
- No medical clearance or fitness certification, by human or AI.
- Real accommodation imagery only for real stays, with provenance recorded.
- No fabricated testimonials, traveller counts, ratings or awards.
