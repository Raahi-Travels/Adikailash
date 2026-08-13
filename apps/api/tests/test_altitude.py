"""Sleeping altitude, and the line this module must never cross.

One of the standing constraints is "no medical clearance, diagnosis or fitness
certification, by human or AI". `test_nothing_here_assesses_a_person` is that
constraint written down. If it ever flips, a page about altitude sickness starts
telling a 62-year-old whether they are fit to go, which is a doctor's job and a
sentence that would be read back in a coroner's court.
"""

from __future__ import annotations

from api.domain.altitude import (
    GUIDANCE_APPLIES_ABOVE_M,
    GUIDANCE_SOURCE,
    NIGHTLY_GAIN_GUIDANCE_M,
    Gain,
    Night,
    Profile,
    chart_points,
    guidance_notes,
)


def kumaon() -> Profile:
    """A realistic shape: low approach, then the climb into the Vyas valley."""
    return Profile(
        nights=[
            Night(day=1, place="Almora", altitude_m=1640),
            Night(day=2, place="Dharchula", altitude_m=940),
            Night(day=3, place="Gunji", altitude_m=3200),
            Night(day=4, place="Gunji", altitude_m=3200, is_rest_day=True),
            Night(day=5, place="Nabhidhang", altitude_m=4100),
        ]
    )


# ------------------------------------------------------------- the safety line


def test_nothing_here_assesses_a_person():
    """Every output is about the itinerary. Nothing is about the reader, and there is
    no score, traffic light or `is_safe` anywhere that could carry a verdict."""
    profile = kumaon()
    forbidden = ("is_safe", "risk", "score", "verdict", "fitness", "suitable")
    for name in forbidden:
        assert not hasattr(profile, name), f"Profile must not expose {name!r}"
        assert not hasattr(Gain, name), f"Gain must not expose {name!r}"

    text = " ".join(guidance_notes(profile)).lower()
    # Second person about the schedule ("where you sleep") is fine. A claim about the
    # reader's body is not.
    for phrase in ("you are at risk", "you will", "you should not", "unsafe", "safe for you"):
        assert phrase not in text


def test_the_guidance_is_attributed_and_says_it_is_not_medical_advice():
    assert "not medical advice" in GUIDANCE_SOURCE
    assert "doctor" in GUIDANCE_SOURCE
    # Doc 03: do not exclude or approve based on age, and fitness is not protection.
    assert "fitness is no protection" in GUIDANCE_SOURCE


def test_notes_describe_the_schedule_not_the_traveller():
    notes = guidance_notes(kumaon())
    assert any("raises where you sleep" in n for n in notes)
    assert all("your health" not in n.lower() for n in notes)


# ------------------------------------------------------------------- the maths


def test_a_gain_above_the_cited_range_is_flagged():
    profile = kumaon()
    over = [g for g in profile.gains if g.is_above_guidance]
    # Dharchula 940 -> Gunji 3200 is 2,260m, and Gunji -> Nabhidhang is 900m.
    assert {g.to_place for g in over} == {"Gunji", "Nabhidhang"}


def test_a_gain_below_the_threshold_altitude_is_not_flagged():
    """Below 3,000m the nightly-gain guidance is not what anybody is managing, so
    flagging a climb from 900m to 1,600m would be noise that teaches people to ignore
    the real flags."""
    profile = Profile(
        nights=[
            Night(day=1, place="Kathgodam", altitude_m=530),
            Night(day=2, place="Almora", altitude_m=1640),
        ]
    )
    assert [g for g in profile.gains if g.is_above_guidance] == []


def test_a_descent_is_not_a_gain():
    profile = Profile(
        nights=[
            Night(day=1, place="Nabhidhang", altitude_m=4100),
            Night(day=2, place="Dharchula", altitude_m=940),
        ]
    )
    assert profile.gains == []


def test_rest_nights_above_the_threshold_are_counted():
    assert kumaon().rest_nights_above_threshold == 1


def test_a_rest_night_low_down_does_not_count_as_acclimatisation():
    profile = Profile(
        nights=[
            Night(day=1, place="Almora", altitude_m=1640),
            Night(day=2, place="Almora", altitude_m=1640, is_rest_day=True),
        ]
    )
    assert profile.rest_nights_above_threshold == 0


def test_the_highest_sleeping_altitude_is_reported():
    assert kumaon().highest_sleeping_altitude_m == 4100


def test_too_few_rest_nights_is_stated_as_a_fact_about_the_itinerary():
    notes = guidance_notes(kumaon())
    assert any("rest night" in n for n in notes)


# ----------------------------------------------------- refusing to guess


def test_an_unknown_altitude_is_never_interpolated():
    """The guessed number would look identical to a verified one on the chart, and
    somebody is judging their fitness against it."""
    profile = Profile(
        nights=[
            Night(day=1, place="Dharchula", altitude_m=940),
            Night(day=2, place="Budhi", altitude_m=None),
            Night(day=3, place="Gunji", altitude_m=3200),
        ]
    )
    assert profile.unknown_places == ["Budhi"]
    assert not profile.is_complete
    assert [p["place"] for p in chart_points(profile)] == ["Dharchula", "Gunji"]


def test_a_gap_breaks_the_gain_chain_rather_than_spanning_it():
    """Computing Dharchula to Gunji across an unrecorded night at Budhi would invent
    a single 2,260m jump that nobody is actually making in one night."""
    profile = Profile(
        nights=[
            Night(day=1, place="Dharchula", altitude_m=940),
            Night(day=2, place="Budhi", altitude_m=None),
            Night(day=3, place="Gunji", altitude_m=3200),
        ]
    )
    assert profile.gains == []


def test_the_missing_places_are_named_in_the_notes():
    """A chart with two of three points plotted reads as the whole journey, and the
    missing one is the high one somebody wants to know about."""
    profile = Profile(
        nights=[
            Night(day=1, place="Dharchula", altitude_m=940),
            Night(day=2, place="Budhi", altitude_m=None),
            Night(day=3, place="Gunji", altitude_m=3200),
        ]
    )
    notes = " ".join(guidance_notes(profile))
    assert "Budhi" in notes
    assert "rather leave a gap" in notes


# --------------------------------------------------------------- the chart


def test_no_chart_below_two_known_points():
    """One dot is not a profile, and an empty axis suggests we lost the data rather
    than never having published it."""
    assert chart_points(Profile(nights=[Night(day=1, place="Gunji", altitude_m=3200)])) == []
    assert chart_points(Profile()) == []


def test_the_highest_point_sits_above_the_lowest_on_the_canvas():
    """SVG y grows downward, so the summit must have the *smaller* y. Getting this
    backwards draws the mountain upside down and nobody notices in a code review."""
    points = chart_points(kumaon())
    highest = min(points, key=lambda p: p["y"])
    lowest = max(points, key=lambda p: p["y"])
    assert highest["place"] == "Nabhidhang"
    assert lowest["place"] == "Dharchula"


def test_points_are_spread_across_the_full_width():
    points = chart_points(kumaon(), width=640)
    assert points[0]["x"] == 20.0
    assert points[-1]["x"] == 620.0


def test_a_flat_profile_does_not_divide_by_zero():
    points = chart_points(
        Profile(
            nights=[
                Night(day=1, place="Gunji", altitude_m=3200),
                Night(day=2, place="Gunji", altitude_m=3200),
            ]
        )
    )
    assert len(points) == 2
    assert all(p["y"] == points[0]["y"] for p in points)


def test_the_guidance_range_is_a_range_not_a_single_number():
    """The literature says 300-500m depending on who is citing it. Presenting one
    number as settled would be exactly the false precision this codebase avoids."""
    assert NIGHTLY_GAIN_GUIDANCE_M == (300, 500)
    assert GUIDANCE_APPLIES_ABOVE_M == 3000
