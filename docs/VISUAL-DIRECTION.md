# Visual direction

Synthesised from four GPT Image 2 mockups (16 Aug 2026), the existing doc 02 brand
tokens, and the constraint that nothing on this site may claim more than we can
verify.

The mockups are referred to as M1 (dark hero, floating journey card), M2 (live status
panel plus route timeline), M3 (warm light hero, family), M4 (drenched dark, contour
lines, elevation chart).

---

## 1. The organising rule

Every mockup mixed dark and light, and none of them said why. The mix is worth
keeping, but it needs a rule or it reads as decoration.

> **The dark register carries what we have verified. The light register carries what
> we are offering.**

Navy is live, operational, time-stamped: route status, permits, altitude, weather,
the things where being wrong hurts somebody. Off-white is editorial: journeys,
homestays, reading, choosing, planning.

This is why the home page opens dark and turns light, and why the route instrument at
the foot of it returns to navy. It is not theme alternation. It is the same
distinction the API already makes between a verified reading and a piece of marketing
copy, made visible.

It also settles which page gets which. `/status`, `/trip` and the permit surfaces are
dark throughout. `/journeys`, `/plan` and `/guides` are light throughout, which is the
fully-light treatment from M3 with a reason attached.

**The hinge is physical.** Where the registers meet, a navy band overlaps both, exactly
as in M1 and M3. It carries route facts, so the band is the transition and the
argument at once.

---

## 2. What each mockup contributes

**From M2, the best single idea across all four:** the live route status panel sitting
in the hero, six named segments with state and age. The promise, structural, above the
fold, before anyone scrolls. It replaces the four-cell bordered table currently on the
site.

**From M2 also:** the horizontal route progression. Corrected, because M2 runs
Pithoragarh, Dharchula, Gunji, Kalapani, Adi Kailash, Om Parvat as one line and the
route does not work that way. Above Gunji it **forks**: the Kuti valley arm climbs to
Jyolingkong for Adi Kailash, the other arm climbs to Nabhidhang for Om Parvat darshan.
A branching profile is both more truthful and more interesting than a straight line.

**From M4:** the gold contour lines running through the hero, the vertical
hairline-separated fact stack on the right with no box around it, prices stated on
journey cards, and the elevation chart in the route panel. The contour motif is the
one device here that belongs to this brand and not to travel-site-in-general. It is
also the WebGL hook.

**From M3:** the warm light register and, more importantly, the photograph. A family
looking at the peak together is the strongest emotional frame across all four, and it
matches who actually books: an adult child arranging this for a parent. That becomes
the light register's lead image, not a generic summit.

**From M1:** the navy band hinging dark hero into light body, and the floating journey
panel anchored to the photograph.

---

## 3. Rejected, with reasons

| Element | Why |
|---|---|
| All traveller counts, ratings, "Since 2010", "98% safety record" | Fabricated. Zero departures run. The safety figure is the worst of them. |
| "Neha Sharma" testimonial | Invented person, stock face. |
| Kedarnath, Badrinath, Char Dham, Gangotri, Yamunotri, Rishikesh, Doditat | Not our product. Three journeys exist. |
| Heart / wishlist icons on journey cards | Ecommerce affordance with nothing behind it. No accounts, no wishlist. |
| Four-up icon-and-heading trust pillars (M1, M3, M4) | Identical card grids plus rounded icons above every heading. Could be any operator. |
| Six uppercase tracked eyebrows (M4 has four) | AI section grammar. One kicker maximum on the page. |
| "Watch the film" | No film. |
| "Up to 5,416m" | Thorong La, Nepal. Ours is ~4,570m at Jyolingkong. |
| Nested cards (M3's comfort row, M2's planner) | Cards inside cards, always wrong. |

The `01`–`06` numbering on the route strip **stays**. There it is a genuine ordered
sequence carrying information the reader needs, which is the one case where numbered
markers earn their place.

---

## 4. Type

Replacing EB Garamond plus Inter. Both current faces bolt a Latin design onto an
unrelated Noto Devanagari fallback, which quietly contradicts doc 02's rule that
Devanagari is a first-class layout rather than a smaller translation.

**Display: Eczar** (Rosetta, Vaibhav Singh). One superfamily drawn for Devanagari and
Latin together, high stroke contrast, real presence at display size. Weights 500 and
600.

**Interface: Mukta** (Ek Type, Mumbai). Devanagari-first UI face with a matched Latin,
open apertures and a generous x-height, which is what a 65-year-old reading on a
phone in daylight needs.

The pairing is a contrast axis, high-contrast serif against humanist sans, and the
reason is structural rather than aesthetic: both scripts are set in faces designed
for both scripts. The mockups' Playfair-flavoured display is the generic
luxury-travel default; Eczar reads specific and slightly Indic, which this brand is.

| Role | Face | Size |
|---|---|---|
| Hero display | Eczar 600 | `clamp(2.75rem, 6vw, 5.5rem)` / 1.05 / -0.02em |
| Section head | Eczar 500 | `clamp(1.875rem, 3.5vw, 3rem)` / 1.15 |
| Sub-head | Eczar 500 | 1.5rem |
| Body | Mukta 400 | 1.0625rem / 1.65, max 68ch |
| Interface | Mukta 500 | 0.875rem |
| Readings and times | Mukta 400 | tabular numerals |

---

## 5. Colour

The doc 02 palette holds; the mockups confirm it works. Two additions and one
discipline.

Added: `--color-contour`, gold at 12% for terrain hairlines, and `--color-dawn`, the
warm light that the M3 hero photograph carries into the light register.

The discipline: **warmth comes from photography and gold, never from the ground.**
`--color-snow` at `#f7f6f2` is a near-neutral off-white and stays that way. Tinting it
toward cream is the reflex that makes every premium-consumer page look the same.

Gold stays guidance, not coating. On the current page it appears on both CTAs, both
inline links, every checkmark and the logo. In the redesign it marks the primary
action and the contour lines, and nothing else.

Status colours are unchanged and, per doc 03, never carry state alone: every one is
paired with a word and, where time-bound, an age.

---

## 6. Shape

One rule, followed everywhere:

- **Interactive** elements are full pill.
- **Media** is 6px.
- **The two instrument panels** (hero status, route ribbon) are 16px. They are the only
  floating surfaces on the site.
- **Everything else has no container at all.** Sections separate with hairlines and
  space, not boxes. The current bordered status grid is exactly what this is
  removing.

---

## 7. Motion

`MOTION_INTENSITY 7` on marketing surfaces, **2 on `/status`, `/trip` and `/plan`**.
Somebody checking whether the road past Chiyalekh is open should not scroll through
choreography to find out.

- **Terrain**: a real elevation-derived contour field, Three.js, one isolated client
  leaf with its own frame loop, lazy after first paint. Drifts very slowly and takes
  parallax on scroll.
- **Everything else**: `motion/react`. No GSAP anywhere, which avoids two libraries
  competing for the same frames.
- **The route profile draws on scroll**, left to right, stations appearing in
  sequence. Motivated: it communicates altitude gain, the most safety-relevant fact
  on the site.
- **Reduced motion** collapses all of it to static, and every reveal enhances content
  that is already visible by default rather than gating it.

---

## 8. Home page architecture

1. **Hero**, dark. Eczar display left, dawn photograph bleeding right, contour field
   over both. Two actions. Live route status panel upper right, six segments.
2. **Hinge band**, navy, overlapping. Four route facts: highest point, permit state,
   season, last verification. No icons, no pillars.
3. **Journeys**, light. Three real journeys, asymmetric, no card chrome, price stated.
4. **Homestay**, light. Split composition, the differentiator, unchanged in substance.
5. **Route instrument**, dark. The branching elevation profile with live segment
   state, drawing on scroll.
6. **Close**, dark. The promise line and one action.

Six sections, six different layout families, one kicker, zero fabricated numbers.

---

## 9. Order of work

1. Tokens, fonts, dependencies.
2. The route instrument. It is the differentiator and it is currently the worst thing
   on the page.
3. The hero, with the terrain layer.
4. The light register: journeys and homestay.
5. Carry the system to `/journeys`, `/plan`, `/status`.

Live data to feed it, from the API research: Open-Meteo with explicit per-point
elevation, the KMVN bed endpoint, the ILP portal banner, SACHET, and the PWD road
register. The instrument is designed to show its own staleness, because above
Tawaghat no source is authoritative and the honest move is to say so on the face of
the dial.
