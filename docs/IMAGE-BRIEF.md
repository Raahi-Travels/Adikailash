# Image brief

Prompts for the ChatGPT image thread, and where the files go.

## Status

**All ten scene images are in place**, generated from the prompts below and converted
to WebP (1.5 MB for the set, down from 23 MB of source PNGs). They are provisional:
`bun run check:imagery` fails on all ten until real photography replaces them.

Still outstanding, and worth a second pass in the image thread: the **Aipan border**,
the contour and grain textures, the **Open Graph card**, and the brand mark
explorations. Those are further down this page. The Aipan is the one that will do the
most for how the site feels.

## How this works

Every image slot resolves by filename. Save a file to the path below and it appears
on the next request; delete it and the slot falls back to procedural ridge
illustration. No code change either way, so you can iterate in the image thread
without touching the repo.

```bash
bun run check:imagery
```

That fails while any generated image is still in place, and the pre-launch checklist
in `docs/DEPLOY.md` runs it. When a real photograph replaces a placeholder, add its
filename to `apps/web/public/scenes/REAL.txt` to record that it was actually taken.

Formats: AVIF or WebP win over JPG if both exist. JPG is fine.

## The one line not to cross

Generated imagery as atmosphere is fine, and that is what these prompts produce.
Generated imagery presented as **documentation of a specific named place** is not,
because the entire site is an argument that our route information is true. So:

- Prompt for *a* high Himalayan ridge, not *Om Parvat*. Never ask for the Om marking
  on the rock face, or the Adi Kailash summit profile. Those are recognisable, and a
  synthetic version of either is the one image that could genuinely mislead someone.
- Prompt for *a* Kumaoni village kitchen, not a named host family's home.
- Never generate people's faces for the About page or testimonials.

Alt text throughout already describes these as illustrations rather than places. Keep
it that way when you swap files in.

---

## Scene prompts

Shared suffix, paste at the end of every scene prompt:

> Cinematic, restrained, editorial travel photography. Cool blue-toned palette built
> around deep midnight blue #0b1d2d with warm gold #c89a4e only in the light itself.
> Natural light, no artificial colour grading, no HDR, no oversaturation. Muted and
> calm rather than dramatic. No text, no watermark, no logo, no people looking at
> camera, no tourists in bright modern hiking gear.

### `hero.jpg` — 2400 × 1030 (21:9)

Sits behind the headline under a heavy scrim, so it needs to work as texture. Keep
the left third quiet; that is where the type sits.

> A wide cinematic view of a high Himalayan range at first light, seen from a
> distance. Layered ridge lines receding into cold blue haze, the furthest almost
> dissolved into the sky. The nearest ridge in deep shadow. A narrow band of warm
> gold light catching only the highest snow along the top edge. Vast empty sky in the
> upper left. No foreground detail, no people, no buildings, no road.

### `homestay-kitchen.jpg` — 1500 × 1200 (5:4)

The most important image on the site. Doc 01 puts the host family at the centre of
the whole business, and this is the only slot that shows what that means.

> The interior of a traditional Kumaoni village kitchen in the Uttarakhand
> Himalaya. A low mud-plastered hearth with a small wood fire, blackened copper and
> brass vessels stacked on a stone shelf, a slate floor. Warm firelight is the only
> light source, falling off quickly into darkness at the edges. A single small window
> letting in cold blue morning light from outside, contrasting with the fire. Lived
> in and clean, not staged, not rustic-chic. No people, no faces, no modern
> appliances, no decorative styling.

### `permits.jpg` — 1600 × 1067 (3:2)

> A remote mountain checkpost on a high Himalayan road. A simple painted barrier
> across a narrow single-lane road cut into a rock face, a small concrete hut beside
> it. Overcast flat light, cold and undramatic. A steep drop on one side. Utilitarian
> and unglamorous, the way an administrative checkpoint actually looks. No signage
> text, no people, no vehicles, no flags.

### `journeys/adi-kailash-om-parvat.jpg` — 1600 × 1067 (3:2)

Note the constraint: this is the flagship card, and it must not be a synthetic Om
Parvat. An unnamed high ridge does the same job honestly.

> A narrow unpaved mountain road cutting across a vast bare rock face high in the
> Himalaya, seen from a distance so the road is a thin line and the scale of the
> mountain dominates. Deep valley below filled with shadow. Cold morning light. No
> vehicles, no people, no snow peaks identifiable as any specific mountain.

### `journeys/adi-kailash-om-parvat-detail.jpg` — 1600 × 1200 (4:3)

> A high-altitude Himalayan valley above the treeline, brown and grey scree slopes
> rising on both sides, a braided glacial stream running through the flat valley
> floor. Thin cold air, flat overcast light, no vegetation but low scrub. Empty and
> severe. No people, no structures, no prayer flags.

### `journeys/kumaon-spiritual-circuit.jpg` — 1600 × 1067 (3:2)

> An ancient stone temple complex in the lower Kumaon Himalaya, surrounded by tall
> deodar cedar forest. Weathered grey stone shikhara spires, moss in the joints,
> worn stone steps. Soft misty morning light filtering through the trees. Quiet and
> old. No people, no bright cloth, no marigold decoration, no crowds.

### `journeys/kumaon-spiritual-circuit-detail.jpg` — 1600 × 1200 (4:3)

> A stone temple courtyard at dawn in the Kumaon hills. Worn flagstones still wet,
> a low stone wall, forested ridges visible beyond and below. Mist sitting in the
> valley. First warm light just reaching the top of the far ridge. No people, no
> offerings, no text carved or painted.

### `journeys/homestay-immersion.jpg` — 1600 × 1067 (3:2)

> A small Kumaoni village on a terraced hillside in Uttarakhand. Traditional houses
> with grey slate roofs and carved wooden window frames, stepped agricultural
> terraces falling away below, forested ridges behind. Late afternoon light. Ordinary
> and inhabited, not picturesque. No people, no laundry lines, no satellite dishes.

### `journeys/homestay-immersion-detail.jpg` — 1600 × 1200 (4:3)

> The stone courtyard of a traditional Kumaoni house. A carved wooden door frame,
> slate paving, a low wall with copper vessels drying on it, a wooden bench. Warm
> low afternoon light raking across the stone. Quiet domestic detail. No people, no
> faces.

### `journeys/default.jpg` — 1600 × 1067 (3:2)

Used by any journey added later that has no image of its own.

> Layered Himalayan ridge lines receding into blue haze, seen from high altitude.
> Simple, calm, no distinguishing features. No people, no structures, no road.

---

## Ornament and texture

These are the assets where generation is unambiguously the right tool, and they do
more for a premium feel than any photograph.

### Aipan border — the highest-value asset here

Aipan is the Kumaoni folk art the women in these villages actually paint at
festivals. It is the correct ornament for a Pithoragarh company, it is honestly
decorative, and nobody else in this market is using it.

> A single horizontal border ornament in the Kumaoni Aipan folk-art tradition of
> Uttarakhand: fine continuous white line-work on deep midnight blue #0b1d2d, lines
> in warm off-white #f7f6f2. Geometric and rhythmic, built from repeating dots,
> interlocking triangles, lotus-petal arcs and a continuous unbroken outline, the way
> Aipan is painted by hand with a fingertip. Symmetrical, tileable left to right,
> 1600 by 200 pixels. Flat, no gradients, no shading, no 3D. Hand-painted quality
> with slight natural irregularity in line weight, not vector-perfect. No text, no
> figures, no deities.

Ask for three: a narrow divider, a wider header band, and a corner unit. Then a
second pass in `#a86632` on `#f7f6f2` for light sections.

### Topographic contour texture

> A seamless tileable background texture of topographic contour lines, as on a survey
> map of steep Himalayan terrain. Thin single-weight lines in #1b2638 on #0b1d2d,
> extremely low contrast, like a watermark. Dense irregular closed contours
> suggesting ridges and river valleys. No labels, no numbers, no legend, no colour
> fill. Flat vector look. 2048 by 2048, tiles seamlessly on all four edges.

### Paper grain overlay

> A subtle paper grain texture: fine irregular fibre noise, like handmade Himalayan
> lokta paper held to the light. Neutral grey, very low contrast, for overlay at 4
> percent opacity in multiply mode. Seamlessly tileable, 1024 by 1024. No visible
> seams, no colour cast, no text.

### Open Graph card — `public/og/default.jpg`, 1200 × 630

Every WhatsApp forward of a link shows this.

> A 1200 by 630 social share card background. Deep midnight blue #0b1d2d ground. In
> the lower third, a flat solid silhouette of an asymmetric Himalayan ridge line in
> darker blue #071624. Across the upper area a very faint topographic contour texture
> at low opacity. A single small eight-pointed star in gold #c89a4e upper right.
> Generous empty space in the upper left for typography added later. Flat, restrained,
> editorial. No text, no logo, no people, no lens flare.

### Brand mark

The current mark is in `apps/web/components/site-chrome.tsx`. Worth exploring before
committing.

> A minimal logo mark: three overlapping mountain peaks reduced to clean straight
> lines, with a small eight-pointed guiding star just above and right of the tallest
> peak. Single-weight stroke, no fill, gold #c89a4e on transparent. Geometric, calm,
> balanced in a square. Legible at 16 pixels. Flat vector, no gradient, no shadow, no
> text, no circular badge.

Ask for six variations on one sheet, then pick. Trace the winner by hand so the
header and favicon stay sharp.

---

## Before the site goes public

The field-trip shot list. Each of these replaces the file of the same name:

- The range from the road, at the hour it actually looks like that
- The road itself, including the bad sections
- Host families and their kitchens, with recorded consent (see `/policies/consent`)
- Gunji, Nabhidhang, Kalapani, Budhi as they actually look
- The checkpost, so people know what to expect
- The three of you, so the About page has real faces on it

Then add each filename to `public/scenes/REAL.txt` and `bun run check:imagery` passes.
