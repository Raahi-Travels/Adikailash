# Image brief

Prompts for the ChatGPT image thread, plus the one rule that decides what may be
generated at all.

## The rule, first

`docs/DECISIONS.md` and doc 02 both ban two things outright:

> "Unrelated Nepal, Tibet or Ladakh imagery labelled as Adi Kailash"
> "AI-generated travel images presented as real locations"

That is why `components/photo-slot.tsx` renders an honest empty slot instead of a
mountain. **So: never generate a photograph of Adi Kailash, Om Parvat, the Kailash
View Point, Gunji, Nabhidhang, a homestay interior, a host family, a road condition,
or anything a visitor could reasonably read as a photograph of the real route.** The
whole site is an argument that we tell the truth about this road. One synthetic
mountain photo destroys that argument, and it is the kind of thing people notice.

Those photographs come from the field trip. Nothing else fills them.

What *can* be generated is everything that is honestly decorative or diagrammatic:
texture, pattern, ornament, marks, and abstract art that is plainly art. Below is
that list.

## Palette (paste into every prompt)

| Name | Hex | Use |
|---|---|---|
| Midnight | `#0b1d2d` | primary dark ground |
| Himalayan | `#1b2638` | secondary dark surface |
| Snow | `#f7f6f2` | light ground, ink on dark |
| Gold | `#c89a4e` | guidance, one accent only |
| Saffron | `#a86632` | devotional and caution accent |
| Slate | `#5a6770` | secondary |

Typography on the site is a serif display face with Noto Serif Devanagari alongside
it, so ornament should feel drawn rather than geometric-modern.

---

## 1. Aipan border ornament (the highest-value asset here)

Aipan is the Kumaoni folk art the women of these villages actually paint on floors
and doorways at festivals. It is the correct ornament for a Pithoragarh company, it
is honestly decorative rather than a fake photograph, and no competitor is using it.

> A single horizontal border ornament in the Kumaoni Aipan folk-art tradition of
> Uttarakhand: fine continuous white line-work on a deep midnight blue background,
> hex #0b1d2d, lines in warm off-white #f7f6f2. Geometric and rhythmic, built from
> repeating dots, interlocking triangles, lotus-petal arcs and a continuous
> unbroken outline, the way Aipan is painted by hand with a fingertip. Symmetrical,
> tileable left to right, roughly 1600 by 200 pixels. Flat, no gradients, no
> shading, no drop shadow, no 3D. Hand-painted quality with slight natural
> irregularity in the line weight, not vector-perfect. No text, no figures, no
> deities, no religious icons.

Ask for three variants: a narrow divider, a wider header band, and a corner unit.

**Second pass, inverted:** same prompt, `#a86632` lines on `#f7f6f2` ground, for
light sections.

## 2. Topographic contour texture

A section background that says "terrain" without pretending to be a place.

> A seamless tileable background texture of topographic contour lines, as on a
> survey map of steep Himalayan terrain. Thin single-weight lines in #1b2638 on a
> #0b1d2d background, extremely low contrast, barely visible, like a watermark.
> Dense irregular closed contours suggesting ridges and river valleys. No labels, no
> numbers, no legend, no colour fills, no shading. Flat vector look. 2048 by 2048,
> tiles seamlessly on all four edges.

Also generate a `#f7f6f2` on `#f7f6f2`-adjacent version for light sections.

## 3. Ridge-line section divider

> A wide horizontal silhouette of a Himalayan ridge line, drawn as a single flat
> shape with no detail inside it. Solid #0b1d2d shape on a transparent background.
> Sharp asymmetric peaks of varying height, the profile of a high snow-free rock
> ridge seen from a distance, not a symmetrical cartoon triangle mountain. 2400 by
> 300 pixels, the shape anchored to the bottom edge. Flat, graphic, poster-like. No
> sky, no clouds, no sun, no snow caps, no trees, no text.

Generate three so sections do not repeat the same profile.

## 4. Paper grain overlay

Stops the large dark fields from looking like flat CSS.

> A subtle paper grain texture: fine irregular fibre noise, like handmade Himalayan
> lokta paper held to the light. Neutral grey, very low contrast, intended to be
> overlaid at 4 percent opacity in multiply mode. Seamlessly tileable, 1024 by 1024.
> No visible seams, no repeating pattern, no colour cast, no text.

## 5. Open Graph share card background

Every WhatsApp forward of a link shows this. It is worth getting right.

> A 1200 by 630 pixel social share card background. Deep midnight blue #0b1d2d
> ground. In the lower third, a flat solid silhouette of an asymmetric Himalayan
> ridge line in a slightly darker blue #071624. Across the upper area, a very faint
> topographic contour texture at low opacity. A single small eight-pointed star in
> gold #c89a4e in the upper right. Generous empty space in the upper left for
> typography to be added later. Flat, restrained, editorial. No text, no logo, no
> people, no photographic elements, no lens flare, no glow.

## 6. Brand mark refinements

The current mark is three peaks with an eight-point star, in
`components/site-chrome.tsx`. Worth exploring alternatives before committing.

> A minimal logo mark: three overlapping mountain peaks reduced to clean straight
> lines, with a small eight-pointed guiding star resting just above and right of the
> tallest peak. Single-weight stroke, no fill, gold #c89a4e on transparent.
> Geometric, calm, balanced in a square. Must stay legible at 16 pixels. Flat vector
> style, no gradient, no shadow, no 3D, no text, no circle badge around it.

Ask for six variations on one sheet, then pick.

## 7. Empty and error state ornament

For "no departures published yet" and similar.

> A small decorative ornament: a single continuous line drawing of a winding
> mountain switchback road curling from bottom left to top right, ending at a small
> eight-pointed star. Single-weight stroke in #c89a4e on transparent background.
> Sparse, calm, lots of empty space. 400 by 400. Flat vector, no fill, no shading,
> no landscape, no vehicles, no text.

## 8. Route diagram base (a diagram, not a photograph)

A schematic route map is honest: nobody mistakes it for a photo, and it genuinely
helps someone understand the journey.

> A clean schematic route diagram in the style of a transit map, not a geographic
> map. A single vertical line running bottom to top with evenly spaced circular
> station markers along it. Line and markers in #c89a4e on a #0b1d2d background.
> Small mountain glyphs beside two of the upper markers. Generous space to the right
> of each marker for labels to be added later. Flat, minimal, precise. No text, no
> place names, no compass rose, no terrain, no borders.

Place names get set in real type afterwards, so they can be translated into Hindi
and corrected when the route changes.

---

## What to do with them

- Aipan borders, contour texture and paper grain: `apps/web/public/textures/`
- Ridge dividers and ornaments: inline SVG if small, otherwise `public/ornament/`
- OG card: `public/og/` and reference it from `buildMetadata` in
  `apps/web/lib/brand/helpers.ts` once a domain exists (decision O7)
- Brand mark: replace `Mark` in `apps/web/components/site-chrome.tsx`

Ask for SVG where the asset is line art. Where the tool returns raster, ask for the
largest size available and trace the marks by hand; the mark in particular must be
real vector to stay sharp in the header and as a favicon.

## Still not generated, ever

The field-trip shot list, unchanged:

- Adi Kailash and Om Parvat from the viewpoints, with the date and weather recorded
- The road itself, including the bad sections. Doc 02 wants the route told truthfully.
- Host families and their kitchens, with recorded consent (see `/policies/consent`)
- Gunji, Nabhidhang, Kalapani, Budhi as they actually look
- The team, so the About page has real faces on it
