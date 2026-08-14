"""Route history, and the refusal to draw a pattern from four readings.

`test_a_thinly_observed_week_gets_no_verdict` is the one that matters. Somebody books
flights against "usually open in late May". If that phrase can be produced by four
observations from one unusual year, this feature is worse than not having it.
"""

from __future__ import annotations

from datetime import date, datetime, timezone

import pytest

from api.domain.route_history import (
    MIN_OBSERVATIONS,
    MIN_SEASONS,
    MIN_TOTAL_OBSERVATIONS,
    Observation,
    build_pattern,
    week_starting,
)
from api.domain.status import Access


def obs(year: int, iso_week: int, access: Access, *, weekday: int = 1) -> Observation:
    """One reading, placed in a specific ISO week.

    Built with `fromisocalendar` rather than a calendar date: 20 May falls in ISO
    week 20 one year and week 21 the next, so a fixture pinned to a date silently
    spreads across two buckets and every assertion about "week 21" fails for reasons
    that have nothing to do with the code.
    """
    when = date.fromisocalendar(year, iso_week, weekday)
    return Observation(
        verified_at=datetime(when.year, when.month, when.day, 9, tzinfo=timezone.utc),
        access=access,
    )


def week_of(pattern, iso_week: int):
    return next(w for w in pattern.weeks if w.iso_week == iso_week)


def many(access: Access, count: int, *, iso_week: int = 21, year: int = 2027):
    """`count` readings in one ISO week, spread across two seasons."""
    return [
        obs(year + (i % 2), iso_week, access, weekday=(i % 7) + 1)
        for i in range(count)
    ]


# ------------------------------------------------------------- refusing to guess


def test_a_thinly_observed_week_gets_no_verdict():
    """Three readings is not a week we have seen."""
    pattern = build_pattern("gunji", "Gunji", many(Access.OPEN, 3))
    week = week_of(pattern, 21)
    assert week.observations == 3
    assert not week.has_enough
    assert week.verdict is None
    assert "too few to say anything" in week.description


def test_readings_from_a_single_season_get_no_verdict_however_many():
    """The rule that matters. Eight readings from one May is still one May, and a
    raw count threshold would have called it "usually open"."""
    readings = [obs(2027, 21, Access.OPEN, weekday=(i % 7) + 1) for i in range(8)]
    pattern = build_pattern("gunji", "Gunji", readings)
    week = week_of(pattern, 21)
    assert week.observations == 8
    assert week.seasons == 1
    assert week.verdict is None
    assert "one unusual year would be the whole picture" in week.description


def test_a_verdict_appears_once_the_week_has_been_seen_enough():
    pattern = build_pattern("gunji", "Gunji", many(Access.OPEN, MIN_OBSERVATIONS))
    assert week_of(pattern, 21).verdict == "usually open"


def test_a_segment_with_little_history_is_not_summarised_at_all():
    """A scatter of readings across forty weeks tells you nothing about any of them."""
    pattern = build_pattern("gunji", "Gunji", many(Access.OPEN, 5))
    assert not pattern.is_reportable
    assert any("not drawing a pattern" in c for c in pattern.caveats)


def test_a_segment_becomes_reportable_with_enough_history():
    pattern = build_pattern("gunji", "Gunji", many(Access.OPEN, MIN_TOTAL_OBSERVATIONS))
    assert pattern.is_reportable


def test_one_season_of_history_is_called_out():
    readings = [obs(2027, 21, Access.OPEN, weekday=(i % 7) + 1) for i in range(MIN_TOTAL_OBSERVATIONS)]
    pattern = build_pattern("gunji", "Gunji", readings)
    assert pattern.seasons_observed == 1
    assert any("one unusual year" in c.lower() or "One unusual year" in c for c in pattern.caveats)


# ------------------------------------------------------------------- verdicts


def test_a_mostly_shut_week_says_so():
    pattern = build_pattern("gunji", "Gunji", many(Access.CLOSED, MIN_OBSERVATIONS))
    assert week_of(pattern, 21).verdict == "usually shut"


def test_a_suspended_week_counts_as_blocked():
    """Suspended and closed are different operationally and identical to somebody
    trying to drive through."""
    pattern = build_pattern("gunji", "Gunji", many(Access.SUSPENDED, MIN_OBSERVATIONS))
    assert week_of(pattern, 21).blocked_share == 1.0
    assert week_of(pattern, 21).verdict == "usually shut"


def test_a_genuinely_mixed_week_is_called_mixed_rather_than_rounded():
    readings = many(Access.OPEN, 4) + many(Access.CLOSED, 4)
    pattern = build_pattern("gunji", "Gunji", readings)
    assert week_of(pattern, 21).verdict == "mixed"


def test_limited_is_neither_open_nor_blocked():
    """A single lane past a slide is passable and is not "open". Counting it either
    way would misrepresent the week."""
    pattern = build_pattern("gunji", "Gunji", many(Access.LIMITED, MIN_OBSERVATIONS))
    week = week_of(pattern, 21)
    assert week.open_share == 0.0
    assert week.blocked_share == 0.0
    assert week.verdict == "more often shut than open"


# ---------------------------------------------------------------- the wording


def test_every_description_is_past_tense_and_observational():
    """The moment this reads as a prediction it becomes a promise about a road nobody
    controls."""
    pattern = build_pattern("gunji", "Gunji", many(Access.OPEN, MIN_TOTAL_OBSERVATIONS))
    for week in pattern.weeks:
        lowered = week.description.lower()
        for forecast in ("will be", "should be", "expect", "likely", "predict"):
            assert forecast not in lowered


def test_the_caveats_always_say_this_is_not_a_forecast():
    pattern = build_pattern("gunji", "Gunji", many(Access.OPEN, MIN_TOTAL_OBSERVATIONS))
    assert any("not a forecast" in c for c in pattern.caveats)


def test_the_description_reports_the_count_and_the_span():
    pattern = build_pattern("gunji", "Gunji", many(Access.OPEN, MIN_OBSERVATIONS))
    description = week_of(pattern, 21).description
    assert f"of {MIN_OBSERVATIONS} times" in description
    assert "season" in description


# ------------------------------------------------------------------- ranking


def test_best_weeks_prefer_more_observations_when_the_share_is_equal():
    """A week seen twenty times outranks an equally good week seen six."""
    readings = many(Access.OPEN, 20) + many(Access.OPEN, MIN_OBSERVATIONS, iso_week=24)
    pattern = build_pattern("gunji", "Gunji", readings)
    best = pattern.best_weeks
    assert best[0].observations == 20


def test_best_weeks_exclude_the_thinly_observed():
    readings = many(Access.OPEN, MIN_OBSERVATIONS) + many(Access.OPEN, 2, iso_week=24)
    pattern = build_pattern("gunji", "Gunji", readings)
    assert all(w.has_enough for w in pattern.best_weeks)


def test_empty_history_produces_an_empty_but_valid_pattern():
    pattern = build_pattern("gunji", "Gunji", [])
    assert pattern.weeks == []
    assert not pattern.is_reportable
    assert pattern.seasons_observed == 0


# --------------------------------------------------------------- presentation


def test_a_week_number_can_be_shown_as_a_date():
    """"Week 21" means nothing to somebody choosing when to travel."""
    assert week_starting(21, 2027).isoformat() == "2027-05-24"


@pytest.mark.parametrize("access", list(Access))
def test_every_access_value_is_countable(access: Access):
    pattern = build_pattern("gunji", "Gunji", many(access, MIN_OBSERVATIONS))
    assert week_of(pattern, 21).observations == MIN_OBSERVATIONS
