# Design prompts for Claude Design

Six art directions, written to be pasted one at a time. They are deliberately
*different directions*, not six variations of the same layout: the point is to find
out what this brand should look like before committing, and you cannot learn that
from six near-identical greys.

## How to get good output

Four things matter more than prompt length:

1. **Give it real content.** Every prompt below carries the actual headline, the
   actual status strip, the actual journey names. A mockup full of placeholder text
   tells you nothing about whether the design survives the sentence "Open, not
   recently verified".
2. **One screen at a time.** Ask for the home page, look at it, then ask for the
   journey detail in the same direction. Asking for five screens at once gets five
   mediocre ones.
3. **Say what to avoid.** Travel-site defaults (booking widget on the hero, star
   ratings, "Book Now" everywhere) will show up unless you rule them out.
4. **Keep the constraints block.** Paste Section 0 above every prompt so the palette
   and type do not drift between directions, otherwise you are comparing colour
   choices instead of layouts.

---

## Section 0 · Shared context block

**Paste this at the top of every prompt below.**

> I am designing a website for a small pilgrimage travel company in Pithoragarh,
> Uttarakhand, India. Three brothers run it. They take people to Adi Kailash and Om
> Parvat, a high-altitude Hindu pilgrimage in the Kumaon Himalaya, on a road that is
> genuinely difficult and often closed.
>
> The audience is Indian families, frequently travelling with parents in their
> sixties and seventies, plus some solo travellers in their thirties. Most will see
> this on a mid-range Android phone. Many will read Hindi more comfortably than
> English, and the site is bilingual, so the design must hold with Devanagari text
> that runs roughly 20% longer and has taller line boxes.
>
> The single differentiator is honesty. Competitors publish glossy brochures and
> promise things nobody controls: clear views of the peak, guaranteed road access,
> "luxury" hotels that do not exist above Dharchula. This company publishes what its
> coordinators have actually verified, with the timestamp and the person's role
> attached, and marks everything else as unknown. The second differentiator is that
> travellers stay with host families rather than in hotels, and the money stays in
> the household.
>
> Colour palette, use these exact values:
> - Midnight `#0b1d2d` — primary dark ground
> - Himalayan `#1b2638` — secondary dark surface
> - Snow `#f7f6f2` — light ground
> - Gold `#c89a4e` — one accent, used to guide the eye, never to coat the interface
> - Saffron `#a86632` — devotional and caution accent, sparing
> - Teal `#2d5d5f` — informational
>
> Typography: a high-contrast serif for headlines, a clean humanist sans for
> interface and body. Body text must be comfortable for a 70-year-old: no 14px grey
> on grey.
>
> Do not include: star ratings, review scores, countdown timers, "only 2 seats
> left" urgency, a booking widget on the hero, stock-photo smiling couples, price
> comparison tables, or any claim of a guaranteed view of the peak.

---

## Direction 1 · Editorial journal

The safest strong option. Treats the company as a publication rather than a shop.

> Using the context above, design the **home page** as an editorial journal, in the
> spirit of a printed travel quarterly rather than a travel agency.
>
> Structure:
> - A typographic hero with no background image. The headline carries the page:
>   "Some journeys begin with a plan. Others begin with a calling." Set large, in the
>   serif, on Midnight. Below it one line: "Answer the call of Adi Kailash through a
>   carefully guided journey rooted in the Himalaya." Two actions: "Explore the
>   journey" as a filled gold pill, "Speak to a Journey Guide" as an outlined pill.
> - Immediately under the hero, a horizontal **verified-status strip** in four cells:
>   Route "Open, not recently verified"; Permits "Permit pending, re-check due";
>   Weather "-6° to 1°C, Adi Kailash, not recently checked"; Last verified "8 Aug
>   2026, 11:28 pm IST". This strip is the most important element on the page. It is
>   the proof of the whole proposition, so it must feel like a masthead or a stock
>   ticker, not like a widget.
> - Three journeys in an asymmetric row, not three equal cards: "Adi Kailash & Om
>   Parvat" (flagship), "Kumaon Spiritual Circuit", "Kumaon Homestay Immersion". Each
>   shows nights, starting gateway, highest point. Some values read "To be confirmed"
>   and that must look deliberate rather than broken.
> - A two-column homestay section, headline "The room is the point, not the
>   compromise", with one photograph of a village kitchen.
> - A permit checklist section listing: government photo ID, Aadhaar card,
>   passport-size photographs, medical fitness certificate.
>
> Use hairline rules, generous margins, a strong baseline rhythm, and a clear
> asymmetric grid. Let whitespace do the work. Imagery is supporting, never
> full-bleed.

## Direction 2 · Cinematic

The obvious luxury-travel move. Worth testing precisely because it is the
convention, so you learn whether breaking it is a gain or a loss.

> Using the context above, design the **home page** as a cinematic, image-led
> experience.
>
> Full-viewport-height sections, each anchored by one large photograph of high
> Himalayan terrain, with a heavy dark scrim so the type stays legible. Slow, spacious
> pacing: one idea per screen. Minimal chrome, a thin transparent header that gains a
> background on scroll.
>
> Same content as Direction 1 (hero line, verified-status strip, three journeys,
> homestay section, permit checklist), but the composition leads with the image and
> the type sits inside it.
>
> The hard problem to solve, and the one I want to see your answer to: the
> verified-status strip carries "Open, not recently verified" and "Permit pending".
> Those are cautious, unglamorous words. Show me how they live inside a cinematic
> layout without either being buried or wrecking the mood. Do not soften the wording.

## Direction 3 · Field document

The most differentiated direction, and the one that takes the honesty proposition
literally. High risk, high ceiling.

> Using the context above, design the **home page** as if it were a field survey
> document or an expedition logbook that happens to be a website.
>
> Visual language: topographic contour lines as a background texture, hairline grids,
> a monospace or tabular face for timestamps, altitudes and verification data, small
> label-and-value pairs, section numbering, margin annotations. The serif still
> carries the headlines so it stays warm rather than clinical.
>
> The verified-status strip becomes the organising idea of the whole page rather than
> a component in it: treat the site as a live document with a revision history.
> Show "Verified by our field coordinator, 8 Aug 2026, 11:28 pm IST" as a first-class
> element, and show a "next check due" time.
>
> Include an at-a-glance data block for the flagship journey: 9 nights, gateway
> Kathgodam / Pithoragarh, highest point "To be confirmed", inner-line permit
> required.
>
> Keep it beautiful, not bureaucratic. The reference is a well-set scientific
> monograph or an Ordnance Survey map, not an enterprise dashboard.

## Direction 4 · The household

Inverts the whole thing: leads with the family you stay with rather than the
mountain. Directly expresses the actual differentiator.

> Using the context above, design the **home page** so that it leads with the host
> families rather than the landscape.
>
> The hero is a warm interior, a village kitchen with firelight, not a summit. Shift
> the palette warmer within the same set: Snow `#f7f6f2` as the dominant ground with
> Saffron `#a86632` and Gold `#c89a4e`, using Midnight `#0b1d2d` only for text and
> for one or two anchoring sections. This is the one direction that is mostly light
> rather than mostly dark.
>
> Headline to use: "The room is the point, not the compromise." Supporting copy:
> "Most operators apologise for the accommodation above Dharchula. There are no
> luxury hotels on this road, and anyone who tells you otherwise has not been. We
> built a journey around that instead."
>
> Design a component for a single stay that states plainly what it has and does not
> have: hot water, heating, mobile network, shared bathroom, whether meals are eaten
> with the family. Absences must read as honesty, not as a downgrade. That component
> is the centrepiece of this direction.
>
> Still include the verified-status strip and the three journeys, but lower down.

## Direction 5 · Devotional restraint

For the pilgrim rather than the tourist. Slow, spare, reverent.

> Using the context above, design the **home page** with maximum restraint, for
> someone making this journey as a religious act rather than a holiday.
>
> Very few elements per screen. Long vertical rhythm. Type does almost all the work.
> Gold used as a single thin line or a small eight-pointed star, never as a fill
> beyond one button.
>
> Incorporate **Aipan**, the Kumaoni folk line-work that women in these villages paint
> at festivals: fine white geometric line ornament, dots, interlocking triangles,
> lotus-petal arcs, used as a section divider and a corner motif. It should feel
> local and hand-drawn, not like a generic mandala. Never use it as a background
> pattern behind text.
>
> Set the Hindi headline "कुछ यात्राएँ योजना से शुरू होती हैं। कुछ बुलावे से।" alongside
> the English one and give the Devanagari equal weight and equal size, not a smaller
> subtitle.
>
> Avoid: deity imagery, Om symbols used decoratively, orange-saffron gradients,
> devotional-poster collage. The reverence should come from space and restraint.

## Direction 6 · Modern and young

The founders are in their twenties and want the site to feel like it was made now.
This direction tests whether that can coexist with a 70-year-old reading it.

> Using the context above, design the **home page** to feel contemporary and
> confident, made by people in their twenties, without becoming a startup landing
> page.
>
> Bigger type, tighter tracking, higher contrast, a bolder grid. Status states become
> distinct chips with clear typographic hierarchy. Consider a subtle grain or noise
> texture over the dark grounds instead of flat colour. Motion is implied through
> layout, not through animation.
>
> Constraints that must survive the enthusiasm: body copy stays at least 17px, tap
> targets stay large, contrast stays high, and nothing depends on hover. The parents
> travelling on this trip are reading it too.
>
> Avoid: glassmorphism, purple-to-blue gradients, floating 3D shapes, emoji, and the
> generic SaaS look. Modern here should mean confident and well-set, not trendy.

---

## After the six

Once you have picked a direction, run these follow-ups **inside that direction** so
the details stay consistent:

**Journey detail page.**

> In the direction we chose, design the journey detail page for "Adi Kailash & Om
> Parvat". It must include: an at-a-glance block (9 nights, Kathgodam / Pithoragarh,
> highest point to be confirmed, service tiers Comfort / Private / Standard), a
> day-by-day itinerary that is currently unpublished and says so honestly, a
> comparison of the three service tiers where several rows read "To be confirmed",
> and a "before you decide" section about altitude risk that does not soften the
> warning. This is the page that has to convert, and it has to do it by being
> trusted rather than by being exciting.

**Departure dates.**

> In the direction we chose, design a departures page. Dates are grouped by month.
> Each departure carries a lifecycle state, and the state decides what the visitor is
> offered: "Open for booking" invites an enquiry, "Waitlist open" offers only a
> waitlist, "Minimum group pending" says the trip runs only if more people join,
> "Suspended" offers nothing. No payment is taken on the site at all. Show me how to
> make four different states legible at a glance without colour alone doing the work.

**Mobile.**

> Show the chosen direction at 390px wide. Most of this audience is on a mid-range
> Android phone on mobile data. The verified-status strip and the primary action must
> both work without scrolling. Hindi text runs about 20% longer than English, so show
> me the Hindi version too and make sure nothing breaks.

**Admin.**

> In the same visual language, design the internal screen where a coordinator
> publishes a route status. It has a route segment, an access state, a source, a
> summary in English and Hindi, and a required "valid for N hours" commitment that
> forces a re-check. The person using this is standing in a cold place on a phone.

---

## Bringing a direction back

When you have one you like, export or share the design and I will implement it. The
palette tokens, the type scale and the status system already exist in
`apps/web/app/globals.css`, so a direction that stays inside the palette above will
land quickly. A direction that changes the palette is fine too, it just means
updating the tokens first.

Related: [docs/IMAGE-FOLLOWUP.md](IMAGE-FOLLOWUP.md) for the artwork these will need,
and `/en/lab/backgrounds` in development for the background treatments.
