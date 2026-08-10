# Image follow-ups

Round two for the ChatGPT image thread. The ten scene photographs are done and in
place ([docs/IMAGE-BRIEF.md](IMAGE-BRIEF.md)); this is everything still missing,
in the order it is worth doing.

Every slot below already has its plumbing. Save the file to the path given and it
appears on the next request, with no code change. Where that is not true it says so.

## Keeping the set consistent

Run these in the **same thread** as the scene images so the model still has the
palette and light discipline in context. If you start a fresh thread, paste this
first:

> Everything in this thread shares one palette: deep midnight blue #0b1d2d, warm gold
> #c89a4e used sparingly and only in the light itself, off-white #f7f6f2, muted
> saffron #a86632. Cool, restrained, editorial. Never oversaturated.

---

## 1. Open Graph share card

**The highest-value item here.** Every WhatsApp forward, every link pasted into a
family group, currently shows no picture at all. On this route most sharing will
happen in exactly those places.

Save as **`apps/web/public/og/default.jpg`**, 1200 × 630.

> A 1200 by 630 pixel social share card background. Deep midnight blue #0b1d2d
> ground. In the lower third, a flat solid silhouette of an asymmetric Himalayan
> ridge line in a darker blue #071624. Across the upper area, a very faint
> topographic contour texture at low opacity. A single small eight-pointed star in
> gold #c89a4e in the upper right. Generous empty space in the upper left where
> typography will be added later. Flat, restrained, editorial. No text, no logo, no
> people, no photographic elements, no lens flare, no glow.

**One caveat.** The card only activates once a domain is settled (decision O7),
because an Open Graph image has to be an absolute URL and there is no correct value
to emit without one. `buildMetadata` in `apps/web/lib/brand/helpers.ts` is already
wired for it: the day O7 lands, every page gets a card with no further change. Put
the file in now so that is one less thing at launch.

## 2. Aipan border ornament

The single biggest lift available for how the site *feels*, and the one asset no
competitor will have. Aipan is the Kumaoni folk line-work the women in these villages
actually paint at festivals, so it is culturally yours rather than borrowed.

Save to **`apps/web/public/textures/`** as `aipan-divider.png`, `aipan-band.png`,
`aipan-corner.png`.

> A single horizontal border ornament in the Kumaoni Aipan folk-art tradition of
> Uttarakhand: fine continuous white line-work on a deep midnight blue background,
> hex #0b1d2d, lines in warm off-white #f7f6f2. Geometric and rhythmic, built from
> repeating dots, interlocking triangles, lotus-petal arcs and a continuous unbroken
> outline, the way Aipan is painted by hand with a fingertip. Symmetrical, tileable
> left to right, 1600 by 200 pixels. Flat, no gradients, no shading, no drop shadow,
> no 3D. Hand-painted quality with slight natural irregularity in the line weight,
> not vector-perfect. No text, no figures, no deities, no religious icons.

Then two variations on the same prompt:

- **Band**: "1600 by 400 pixels, a denser two-row composition."
- **Corner**: "600 by 600 pixels, an L-shaped corner unit for the top-left of a panel."

And a light-section pass of the divider: lines in `#a86632` on `#f7f6f2`.

**Needs code.** Unlike the scene slots, there is no component for this yet, because
how it is used depends on what comes back. Tell me when the files are in and I will
wire it into the section rules and the footer.

## 3. Departures header

Live slot, empty right now — `/departures` falls back to procedural ridge art.

Save as **`apps/web/public/scenes/departures.webp`** (or `.jpg`), 2400 × 1030 (21:9).
Sits behind the heading under a heavy scrim, so keep the left third quiet.

> A narrow mountain road seen from high above, winding along the side of a deep
> Himalayan valley in the flat blue light before sunrise. The road is a thin pale
> line against dark rock. Layered ridges behind, receding into haze. Wide cinematic
> framing, empty and quiet, with the left third of the frame plain dark rock and sky.
> Cool blue-toned palette, deep midnight blue shadows, no warm sunlight yet. No
> vehicles, no people, no signage, no text.

## 4. Brand mark

The current mark is three peaks and a star, hand-coded in
`apps/web/components/site-chrome.tsx`. Worth exploring alternatives before it goes on
anything permanent.

> A minimal logo mark: three overlapping mountain peaks reduced to clean straight
> lines, with a small eight-pointed guiding star resting just above and right of the
> tallest peak. Single-weight stroke, no fill, gold #c89a4e on transparent.
> Geometric, calm, balanced within a square. Must stay legible at 16 pixels. Flat
> vector style, no gradient, no shadow, no 3D, no text, no circular badge around it.

Ask for **six variations on one sheet**, pick one, and I will trace it as real vector
so it stays sharp in the header and as a favicon. The site still ships the default
Next.js `favicon.ico`, which this replaces.

## 5. Textures

Lower priority, but they are what stop large dark fields from reading as flat CSS.

**`apps/web/public/textures/contour.png`**, 2048 × 2048:

> A seamless tileable background texture of topographic contour lines, as on a survey
> map of steep Himalayan terrain. Thin single-weight lines in #1b2638 on a #0b1d2d
> background, extremely low contrast, barely visible, like a watermark. Dense
> irregular closed contours suggesting ridges and river valleys. No labels, no
> numbers, no legend, no colour fills, no shading. Flat vector look, tiles seamlessly
> on all four edges.

**`apps/web/public/textures/grain.png`**, 1024 × 1024:

> A subtle paper grain texture: fine irregular fibre noise, like handmade Himalayan
> lokta paper held to the light. Neutral grey, very low contrast, intended to be
> overlaid at 4 percent opacity in multiply mode. Seamlessly tileable. No visible
> seams, no repeating pattern, no colour cast, no text.

---

## Optional: re-rolls of the existing set

Nothing here is wrong, but two are worth a second look if you have the budget:

- **`hero`** and **`journeys/default`** are compositionally close, both layered ridges
  into haze. If `default` ever renders next to the hero they will read as a repeat.
  Re-roll `default` toward something at eye level rather than a distant range.
- **`journeys/kumaon-spiritual-circuit`** is the brightest image in the set by some
  margin. It works alone, but in the three-up grid on the home page it pulls the eye
  away from the flagship card next to it. A darker, mistier variant would sit better.

Overwrite the same filenames; nothing else changes.

## When these land

Drop the files in and tell me. Scene slots and the OG card need no code. The Aipan
set, the brand mark and the textures each need wiring, and I would rather see the
artwork before deciding how it is used than guess and build the wrong thing.

The field-trip replacement list, which supersedes all of the generated scenes, stays
in [docs/IMAGE-BRIEF.md](IMAGE-BRIEF.md).
