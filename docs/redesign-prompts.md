# GPT Image 2 prompts for the redesign

Paste one block at a time. Each is self-contained: it repeats the palette and the
"flat mockup, not a photo of a screen" framing, because image models forget context
between generations.

**Aspect ratios.** GPT Image 2 takes 1536x1024 (landscape), 1024x1536 (portrait),
1024x1024 (square). Desktop mockups use landscape, mobile uses portrait. The ratio is
stated in each prompt; also set it in the UI if the tool exposes it.

**Palette, repeated in every prompt so the mockups stay comparable:**

| Role | Hex |
|---|---|
| Deep navy ground | `#0B1D2D` |
| Secondary navy surface | `#1B2638` |
| Antique gold accent | `#C89A4E` |
| Warm off-white | `#F7F6F2` |
| Open / verified | `#2D5D5F` |
| Limited / caution | `#A86632` |
| Unknown / stale | `#5A6770` |
| Closed | `#8C2F2F` |

**Keep the text short.** Every prompt names at most four exact strings. Image models
garble long copy; four is about the ceiling for clean rendering. Everything else is
described structurally so the model draws convincing shapes without trying to spell.

---

## Part 1: three whole-page directions

Generate P1, P2 and P3, then pick. They are genuinely different bets, not variations.

---

### P1 - "The Elevation Line" (recommended)

The route as a topographic instrument. Scroll is the climb.

```
A flat, high-fidelity website UI design mockup, rendered as a clean digital
screenshot. Landscape 3:2. No browser chrome, no address bar, no device frame, no
mouse cursor, no watermark, no signature, no photograph of a monitor.

Subject: the homepage of a Himalayan pilgrimage travel company.

Background: a deep navy field, hex #0B1D2D, darkening to near-black at the top edge.

Lower 55% of the frame: a three-dimensional wireframe terrain model of a Himalayan
mountain range, seen from a low angle, drawn only as thin luminous contour lines in
antique gold hex #C89A4E at low opacity, like a LIDAR elevation scan or a
topographic survey model. The ridgeline is jagged and asymmetric with one dominant
peak right of centre. Horizontal elevation contour bands run across the slopes.
Lines are hairline-thin and precise, not glowing or neon. A faint gold vertical
marker rises from one point on the ridge.

Text, all left-aligned in the upper-left third, generous margin:
- Very large two-line headline in a high-contrast transitional serif with fine
  hairline strokes, warm off-white hex #F7F6F2, reading exactly:
  "Some journeys begin with a plan. Others begin with a calling."
- Beneath it, one line of small clean grotesque sans-serif at reduced opacity,
  reading exactly: "Adi Kailash and Om Parvat, from Pithoragarh."
- Beneath that, two pill-shaped buttons side by side: a solid antique gold pill
  with dark navy text reading "Explore the journeys", and a pill with only a thin
  off-white outline and off-white text reading "Talk to a guide".

Top edge: a slim 64px navigation bar, transparent over the navy, a small
geometric line-art mark of three mountain peaks in gold at the far left beside a
small serif wordmark, and a row of five short sans-serif navigation labels at the
right in off-white at reduced opacity.

Bottom edge, overlapping the terrain: a single full-width horizontal strip, one
thin hairline rule above it, no box and no card. Along the strip sit six small
station dots connected by a thin line, each dot a different colour: teal #2D5D5F,
teal, burnt orange #A86632, grey #5A6770, teal, grey. Under each dot, tiny
sans-serif place labels and a small number.

Mood: reverent, precise, instrumented. Like a scientific survey document made
beautiful. Restrained, generous negative space, no clutter.

Avoid: purple, neon glow, glassmorphism, frosted panels, drop shadows, rounded
card grids, stock-photo mountains, lens flare, 3D bevels, gradient text, emoji.
```

---

### P2 - "Photograph First"

The canonical image-led travel move, executed properly. The photograph is the design
and type gets out of its way.

```
A flat, high-fidelity website UI design mockup, rendered as a clean digital
screenshot. Landscape 3:2. No browser chrome, no address bar, no device frame, no
mouse cursor, no watermark, no signature.

Subject: the homepage of a Himalayan pilgrimage travel company.

The entire frame is a single full-bleed photograph: first light striking a high
Himalayan snow peak at dawn, seen across a deep shadowed valley, cold blue shadow
in the foreground and warm amber light on the summit snow only. Vast sky. Shot on
medium format, natural light, no filter, no HDR, no oversaturation. The valley
floor stays dark enough to carry text.

A soft vertical gradient scrim, deep navy hex #0B1D2D, sits over the lower third
and the top edge, so the photograph is untouched through the middle.

Text, all in the lower-left quadrant over the scrim:
- Large two-line headline in a high-contrast transitional serif with fine hairline
  strokes, warm off-white hex #F7F6F2, reading exactly:
  "Some journeys begin with a plan. Others begin with a calling."
- Beneath it, a single solid antique gold hex #C89A4E pill button with dark navy
  text reading "Explore the journeys".

Top edge: a slim 64px navigation bar, fully transparent, a small geometric
line-art mark of three mountain peaks in gold at the far left beside a small serif
wordmark, and a row of five short sans-serif navigation labels at the right in
off-white.

Bottom edge, spanning the full width: a slim horizontal bar of the navy at high
opacity, containing a single row of four small status readouts separated only by
thin vertical hairlines, no boxes. Each has a tiny uppercase label and a short
value; one carries a small teal #2D5D5F dot, one a small burnt orange #A86632 dot.

Mood: cinematic, still, awed. The photograph carries everything. Typography is
quiet and confident.

Avoid: purple, neon, glassmorphism, frosted panels, heavy drop shadows, rounded
card grids, centred hero text, lens flare, HDR crunch, gradient text, emoji,
busy overlays.
```

---

### P3 - "The Ledger"

Light ground, not navy. Every yatra site in India is navy plus gold plus a mountain
photo. This one looks like an honest almanac instead, and puts the verified-status
board where the brochure hero usually goes. Highest-risk, highest-differentiation.

```
A flat, high-fidelity website UI design mockup, rendered as a clean digital
screenshot. Landscape 3:2. No browser chrome, no address bar, no device frame, no
mouse cursor, no watermark, no signature.

Subject: the homepage of a Himalayan pilgrimage travel company that competes on
honesty about road and permit conditions.

Background: a warm off-white ground, hex #F7F6F2, with generous margins. Text is a
very dark ink, hex #16202A. The layout is an asymmetric two-column editorial grid:
a wide left column and a narrower right column, separated by a single hairline
vertical rule in warm grey.

Left column, top: a large three-line headline in a high-contrast transitional
serif with fine hairlines, dark ink, reading exactly:
"The road to Adi Kailash, exactly as we last saw it."

Beneath the headline, a small square photograph, about a third of the column
width, of a narrow mountain road cut into a steep Himalayan cliff face, cold
daylight, documentary style.

Right column: a vertical list of six route segments, each one line, separated only
by thin hairline rules, no boxes and no cards. Each row has a place name in small
sans-serif on the left, a small coloured dot and a one-word state in the middle,
and a small grey timestamp on the right. Dot colours vary down the list: teal
#2D5D5F, teal, burnt orange #A86632, grey #5A6770, teal, burnt orange.

Below the two columns, spanning full width: a single solid antique gold hex
#C89A4E pill button with dark navy text reading "Explore the journeys", sitting in
open space with a lot of air around it.

Top edge: a slim 64px navigation bar on the off-white ground, a small geometric
line-art mark of three mountain peaks in dark ink at the far left beside a small
serif wordmark, a row of five short sans-serif navigation labels at the right.

Mood: an almanac, a tide table, a well-set field guide. Precise, calm,
information-first, unmistakably not a brochure. Print-quality typographic
craft, high contrast, lots of white space.

Avoid: purple, neon, glassmorphism, drop shadows, rounded card grids, beige or
cream backgrounds, stock-photo collages, gradient text, emoji, dashboard widgets,
chart junk, progress bars with filled tracks.
```

---

## Part 2: the component that matters most

The current live-status block is a four-cell table with visible borders. It is the
single most differentiated thing the business has and it renders like a spreadsheet.
These two prompts replace it.

---

### P4 - The route ribbon, desktop

```
A flat UI component design mockup, rendered as a clean digital screenshot.
Landscape 3:2. No browser chrome, no device frame, no cursor, no watermark.

Subject: a single horizontal "route status ribbon" component for a Himalayan
travel website, shown alone and centred with generous empty space around it.

Background: deep navy hex #0B1D2D.

The component is one wide horizontal band, no outer box, no border, no card. It
contains a single thin horizontal line running left to right in warm grey. Along
the line sit six station markers at uneven intervals, closer together at the left
and further apart at the right.

Each station marker is a small filled circle with a thin ring, and above it a
short vertical tick. Circle colours from left to right: teal #2D5D5F, teal
#2D5D5F, burnt orange #A86632, grey #5A6770, teal #2D5D5F, grey #5A6770.

Above the line, at each station, a small warm off-white hex #F7F6F2 sans-serif
place name and directly beneath it a smaller grey number with a lowercase "m".

Below the line, a second thinner line traces the same path but rises steeply from
left to right, forming a filled area beneath it in antique gold hex #C89A4E at
very low opacity, like an elevation profile chart. The rise is gentle at the left
and steep at the right.

Beneath everything, a single line of small grey sans-serif text reading exactly:
"Last checked 3 hours ago by our Dharchula coordinator."

Mood: an instrument panel from a scientific expedition. Precise, hairline-thin,
no chrome, no boxes, no shadows.

Avoid: cards, panels, rounded rectangles, borders around the component, drop
shadows, glassmorphism, gauge dials, progress bars with grey filled tracks, neon
glow, purple, emoji, chart gridlines.
```

---

### P5 - Mobile, hero plus status

Most of the audience arrives on a phone on patchy data. Mock it directly rather than
assuming the desktop scales.

```
A flat mobile website UI design mockup, rendered as a clean digital screenshot of
the screen content only. Portrait 2:3. No phone frame, no device bezel, no hand,
no browser chrome, no status bar icons, no watermark.

Subject: the mobile homepage of a Himalayan pilgrimage travel company.

Background: deep navy hex #0B1D2D.

Top: a compact navigation row, a small geometric line-art mark of three mountain
peaks in antique gold hex #C89A4E at the left beside a short serif wordmark, and a
single small solid gold pill button at the right with dark navy text reading
"Enquire".

Upper middle: a large three-line headline in a high-contrast transitional serif
with fine hairlines, warm off-white hex #F7F6F2, reading exactly:
"Some journeys begin with a calling."

Beneath it: one solid antique gold pill button, full width minus margins, dark
navy text, reading exactly "Explore the journeys".

Middle: a wireframe terrain silhouette of a Himalayan ridgeline drawn only in
thin gold hairlines at low opacity against the navy, spanning the full width,
about a fifth of the frame height.

Lower half: a vertical stack of four route status rows, separated only by thin
hairline rules, no boxes and no cards. Each row has a small coloured dot at the
left, a place name in off-white sans-serif, and a small grey timestamp
right-aligned. Dot colours top to bottom: teal #2D5D5F, burnt orange #A86632,
grey #5A6770, teal #2D5D5F.

Bottom: one line of small grey sans-serif text, and beneath it a thin hairline
rule.

Mood: calm, legible, generous touch targets, high contrast, built for an older
reader on a bright hillside.

Avoid: cards, rounded panels, drop shadows, glassmorphism, tiny text, cramped
spacing, bottom tab bars, purple, neon, emoji, decorative icons above headings.
```

---

### P6 - Journeys section, rhythm not a card grid

```
A flat website UI design mockup of one page section, rendered as a clean digital
screenshot. Landscape 3:2. No browser chrome, no device frame, no cursor, no
watermark.

Subject: the "journeys" section of a Himalayan pilgrimage travel website.

Background: deep navy hex #0B1D2D.

At the top left, a section heading in a high-contrast transitional serif, warm
off-white hex #F7F6F2, reading exactly: "Three ways into the sacred Kumaon".

Below it, three journey entries arranged asymmetrically rather than as an equal
three-column grid: the first is wide and tall on the left occupying roughly half
the width, the second is narrower and sits higher on the right, the third is
narrower and sits lower on the right, offset downward so the three do not align.

Each entry is a photograph with text directly beneath it on the navy, with no
card, no border, no panel and no shadow. The photographs are documentary
Himalayan travel images: a snow peak at dawn, a stone village house with a slate
roof, a narrow mountain road above a river gorge. Under each photograph, a short
serif title in off-white, a single line of small grey sans-serif detail, and a
small gold text link with a thin right-pointing arrow.

Generous vertical space between the heading and the entries.

Mood: an exhibition wall, not a product grid. Confident asymmetry, air, restraint.

Avoid: equal-sized cards, rounded card containers, borders, drop shadows,
glassmorphism, badges or pills overlaid on the photographs, price tags, star
ratings, purple, neon, emoji, uppercase tracked labels above the heading.
```

---

## Part 3: photographic slots

The site has ten scene images, all currently generated placeholders. Under the
imagery rule, the four "claim" slots (`hero`, `homestay-kitchen`, `permits`, and each
journey card) should end up as real photographs from the region, since a viewer reads
them as the actual place. Generated images are fine everywhere else, and fine in
these slots while you are still testing layout. These prompts fill the gap in the
meantime and give the mockups above something honest to sit on.

---

### P7 - Hero backdrop

```
A photograph, 3:2 landscape. First light on a high Himalayan snow peak at dawn,
seen from across a deep shadowed valley in the Kumaon region of Uttarakhand.
Cold blue shadow fills the foreground ridges; warm amber light touches only the
summit snowfields. A vast clear pre-sunrise sky, graduating from deep indigo at
the top to pale gold at the horizon. Medium format, natural light, long lens
compression, fine grain, muted natural colour.

The lower third of the frame must stay dark and low in detail so that text can be
placed over it.

Avoid: people, prayer flags, tents, vehicles, buildings, lens flare, HDR,
oversaturation, heavy vignette, watermark, text, high-contrast filters,
teal-and-orange grading.
```

---

### P8 - Homestay kitchen

```
A photograph, 3:2 landscape. The interior of a traditional Kumaoni village
homestay kitchen in Uttarakhand at dusk. Blackened stone and mud-plastered walls,
a wood-fired chulha stove with a low flame, brass and steel vessels stacked on a
wooden shelf, a single small window with cold blue evening light entering from
the left while the fire casts warm light from below right. Worn wooden floor.
Real, lived-in, slightly untidy.

Documentary reportage style, available light only, natural colour, fine grain,
35mm lens, slight shadow noise.

Avoid: styled food photography, staged props, people looking at the camera,
studio lighting, wide-angle distortion, HDR, oversaturation, watermark, text,
polished or renovated surfaces, decorative styling.
```

---

### P9 - The road

```
A photograph, 3:2 landscape. A narrow single-lane mountain road cut into a near
vertical rock face high above a river gorge in the Kumaon Himalaya, Uttarakhand.
Loose scree on the uphill side, no barrier on the downhill side, the river a thin
pale line far below. Overcast flat daylight, low contrast, grey rock and dusty
brown earth, a few hardy conifers clinging to the slope.

Documentary reportage style, available light, natural muted colour, fine grain,
shot from a viewpoint further along the road so the road curves away into the
frame.

Avoid: vehicles, people, guardrails, road signs, tarmac in good condition, blue
sky, HDR, oversaturation, drone-style overhead angle, lens flare, watermark,
text, dramatic grading.
```

---

## After the mockups come back

Send them back and I will pick a direction, then build it. The technical plan is
already scoped: a WebGL terrain layer isolated in a client leaf, GSAP ScrollTrigger
for the climb sequence, both behind `prefers-reduced-motion`, and none of it on the
status, trip or planning pages where somebody is looking up whether a road is open.
