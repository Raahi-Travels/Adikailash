"""Sleeping altitude across an itinerary, checked against published guidance.

Doc 01 puts altitude awareness at the centre of this business, and doc 03 asks for
"altitude transition where useful" as structured content. Phase 5 lists an
"interactive 3D terrain and altitude experience"; this is the half of that which is
actually useful to a 62-year-old deciding whether to go, and doc 03's non-goals rule
out the other half — "a cinematic 3D homepage that delays essential information".

**Two things this module will not do, and the second is the important one.**

It will not interpolate a missing altitude. A village with no recorded elevation stays
unknown rather than being guessed from its neighbours, because the number would look
identical to a verified one on the chart and somebody is judging their fitness against
it.

**It will never assess a person.** One of the standing constraints is "no medical
clearance, diagnosis or fitness certification, by human or AI", and every output here
is a statement about the *itinerary* measured against *published general guidance*,
never about the reader. "Night 4 gains 900m of sleeping altitude, where the commonly
cited guidance above 3,000m is 300-500m" is a fact about a schedule. "You are at risk
of AMS" is a diagnosis, and no function here can produce one — there is no risk score,
no traffic light, and no `is_safe` anywhere in this file.

The distinction is not pedantry. A green tick on a page like this is the thing that
persuades somebody with a heart condition to skip the doctor's appointment.
"""

from __future__ import annotations

from dataclasses import dataclass, field

#: Above this, sleeping-altitude guidance starts to apply. Commonly cited threshold
#: in the general mountaineering literature; below it, gain per night is not the
#: thing anybody is managing.
GUIDANCE_APPLIES_ABOVE_M = 3000

#: The commonly cited ceiling for a night-on-night increase in *sleeping* altitude
#: above the threshold. Deliberately stored as a range: the literature says 300-500m
#: depending on who is citing it, and presenting a single number as if it were settled
#: would be a false precision of exactly the kind this codebase avoids elsewhere.
NIGHTLY_GAIN_GUIDANCE_M = (300, 500)

#: A rest night is commonly advised every this many metres of cumulative gain above
#: the threshold.
REST_NIGHT_EVERY_M = 1000

#: Attribution shown wherever the guidance is invoked. The numbers are general
#: mountaineering guidance, not our medical opinion, and the page has to say so — the
#: alternative is a reader taking it as advice from us about them.
GUIDANCE_SOURCE = (
    "General mountaineering guidance on gradual ascent. This is not medical advice"
    " and not specific to you; altitude affects individuals very differently and"
    " fitness is no protection. Please speak to a doctor."
)


@dataclass(frozen=True, slots=True)
class Night:
    """Where the group sleeps on one night of the itinerary."""

    day: int
    place: str
    #: None when no verified figure has been published for this place. Never guessed.
    altitude_m: int | None = None
    #: A day with no travel between sleeping points — the itinerary's own rest day.
    is_rest_day: bool = False


@dataclass(frozen=True, slots=True)
class Gain:
    """The change in sleeping altitude between two consecutive nights."""

    from_day: int
    to_day: int
    from_place: str
    to_place: str
    metres: int
    #: The altitude being slept at after the gain — what the guidance is about.
    to_altitude_m: int

    @property
    def is_above_guidance(self) -> bool:
        """Above the threshold, and gaining more than the cited upper bound.

        A statement about the itinerary. Whether it matters to a particular person is
        a question for their doctor, and this module does not pretend to answer it.
        """
        return (
            self.to_altitude_m > GUIDANCE_APPLIES_ABOVE_M
            and self.metres > NIGHTLY_GAIN_GUIDANCE_M[1]
        )

    @property
    def is_at_upper_end(self) -> bool:
        return (
            self.to_altitude_m > GUIDANCE_APPLIES_ABOVE_M
            and NIGHTLY_GAIN_GUIDANCE_M[0] < self.metres <= NIGHTLY_GAIN_GUIDANCE_M[1]
        )


@dataclass(slots=True)
class Profile:
    """An itinerary's sleeping altitudes, and how they compare with the guidance."""

    nights: list[Night] = field(default_factory=list)

    @property
    def known_nights(self) -> list[Night]:
        return [n for n in self.nights if n.altitude_m is not None]

    @property
    def unknown_places(self) -> list[str]:
        """Places with no published altitude, named so the gap is visible.

        Listed rather than hidden: a chart with three of nine points plotted and no
        explanation reads as a chart of the whole journey, and the missing points are
        exactly the high ones somebody wants to know about.
        """
        seen: list[str] = []
        for night in self.nights:
            if night.altitude_m is None and night.place not in seen:
                seen.append(night.place)
        return seen

    @property
    def is_complete(self) -> bool:
        return bool(self.nights) and not self.unknown_places

    @property
    def highest_sleeping_altitude_m(self) -> int | None:
        known = self.known_nights
        return max(n.altitude_m for n in known) if known else None  # type: ignore[type-var]

    @property
    def gains(self) -> list[Gain]:
        """Night-on-night increases, computed only between consecutive *known* points.

        A gap in the data breaks the chain rather than spanning it: computing the gain
        from Dharchula to Nabhidhang across an unrecorded night at Gunji would invent
        a single 2,000m jump that nobody is actually making.
        """
        result: list[Gain] = []
        for previous, current in zip(self.nights, self.nights[1:], strict=False):
            if previous.altitude_m is None or current.altitude_m is None:
                continue
            change = current.altitude_m - previous.altitude_m
            if change <= 0:
                continue
            result.append(
                Gain(
                    from_day=previous.day,
                    to_day=current.day,
                    from_place=previous.place,
                    to_place=current.place,
                    metres=change,
                    to_altitude_m=current.altitude_m,
                )
            )
        return result

    @property
    def total_gain_above_threshold_m(self) -> int:
        return sum(g.metres for g in self.gains if g.to_altitude_m > GUIDANCE_APPLIES_ABOVE_M)

    @property
    def rest_nights_above_threshold(self) -> int:
        return sum(
            1
            for n in self.nights
            if n.is_rest_day
            and n.altitude_m is not None
            and n.altitude_m > GUIDANCE_APPLIES_ABOVE_M
        )


def _nights(count: int) -> str:
    """"1 rest night", not "1 rest night(s)". These sentences are read by somebody
    deciding whether they can physically do this, and a page that cannot pluralise
    reads as one nobody checked."""
    return f"{count} rest night" if count == 1 else f"{count} rest nights"


def guidance_notes(profile: Profile) -> list[str]:
    """How this itinerary compares with published general guidance.

    Every sentence is about the schedule. None is about the reader, and none says
    whether they should go — that is a conversation with a doctor and with us, which
    is what the page directs people to.
    """
    notes: list[str] = []

    for gain in profile.gains:
        if gain.is_above_guidance:
            notes.append(
                f"Day {gain.to_day} raises where you sleep by {gain.metres}m, from"
                f" {gain.from_place} to {gain.to_place} at {gain.to_altitude_m}m."
                f" Commonly cited guidance above {GUIDANCE_APPLIES_ABOVE_M:,}m is"
                f" {NIGHTLY_GAIN_GUIDANCE_M[0]}-{NIGHTLY_GAIN_GUIDANCE_M[1]}m a night."
            )

    total = profile.total_gain_above_threshold_m
    if total >= REST_NIGHT_EVERY_M:
        expected = total // REST_NIGHT_EVERY_M
        actual = profile.rest_nights_above_threshold
        climbs = (
            f"This itinerary climbs {total:,}m above {GUIDANCE_APPLIES_ABOVE_M:,}m"
        )
        if actual < expected:
            notes.append(
                f"{climbs} with {_nights(actual)} up there. A rest night for every"
                f" {REST_NIGHT_EVERY_M:,}m gained is the usual advice, which would"
                f" mean {expected} here."
            )
        else:
            notes.append(f"{climbs} and includes {_nights(actual)} up there.")

    if profile.unknown_places:
        notes.append(
            "We have not published a verified altitude for "
            + ", ".join(profile.unknown_places)
            + ", so those nights are not plotted. We would rather leave a gap than"
            " put a number on this page that somebody judges their fitness against."
        )

    return notes


def chart_points(profile: Profile, *, width: int = 640, height: int = 180) -> list[dict]:
    """Coordinates for an inline SVG profile.

    Computed server-side so the chart is in the HTML: it renders with no JavaScript on
    a mid-range Android on mobile data, which doc 02 names as the audience, and it is
    readable by an answer engine, which doc 07 treats as a first-class channel. A
    canvas chart is invisible to both.

    Only known points are returned. The caller draws gaps as gaps.
    """
    known = profile.known_nights
    if len(known) < 2:
        return []

    altitudes = [n.altitude_m for n in known]
    lowest, highest = min(altitudes), max(altitudes)  # type: ignore[type-var]
    span = max(highest - lowest, 1)

    # Padded so the highest point is not flush against the top edge, where it reads
    # as clipped rather than as the summit.
    top, bottom = 12, height - 28
    usable = bottom - top

    points: list[dict] = []
    for index, night in enumerate(known):
        x = round((index / (len(known) - 1)) * (width - 40) + 20, 1)
        y = round(bottom - ((night.altitude_m - lowest) / span) * usable, 1)  # type: ignore[operator]
        points.append(
            {
                "day": night.day,
                "place": night.place,
                "altitude_m": night.altitude_m,
                "x": x,
                "y": y,
                "is_rest_day": night.is_rest_day,
            }
        )
    return points
