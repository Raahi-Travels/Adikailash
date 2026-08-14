"""Vendor assessment, and the one rule doc 06 states outright.

    "A future vendor score may assist planning, but serious incidents and manual
    judgement must remain visible rather than hidden in an average."

`test_a_serious_incident_survives_a_wall_of_good_reviews` is that rule. If it flips,
a homestay where somebody was left outside at night at altitude ends up rated 4.6 and
booked again next May because the number looked fine.
"""

from __future__ import annotations

from decimal import Decimal

import pytest

from api.domain.incidents import IncidentSeverity
from api.domain.vendors import (
    DIMENSIONS,
    SCORE_CEILING_WITH_CONCERN,
    MIN_REVIEWS_FOR_RATING,
    CostVariance,
    IncidentSummary,
    Recommendation,
    Review,
    TravellerSignal,
    VendorRecord,
    assess,
)


def good_review(departure_id: int = 1, **kw) -> Review:
    return Review(
        departure_id=departure_id,
        ratings={key: 5 for key, _ in DIMENSIONS},
        would_use_again=True,
        **kw,
    )


def record(**kw) -> VendorRecord:
    base = {"supplier_id": 1, "name": "Bisht Homestay", "kind": "stay"}
    return VendorRecord(**{**base, **kw})


# ------------------------------------------------------------- the headline rule


def test_a_serious_incident_survives_a_wall_of_good_reviews():
    """The rule doc 06 states outright, and the reason this returns evidence rather
    than a score."""
    r = record(
        reviews=[good_review(i) for i in range(10)],
        incidents=[
            IncidentSummary(
                incident_id=1,
                severity=IncidentSeverity.SERIOUS,
                observed="Party arrived to no rooms; slept in the vehicle.",
                outcome="Moved to another house next morning.",
                is_resolved=True,
            )
        ],
    )
    result = assess(r)
    assert result.recommendation is Recommendation.REVIEW_BEFORE_REBOOKING
    assert any("Serious incident" in c for c in result.blocking_concerns)
    assert "slept in the vehicle" in " ".join(result.blocking_concerns)


def test_an_unresolved_serious_incident_says_it_is_still_open():
    r = record(
        reviews=[good_review(i) for i in range(5)],
        incidents=[
            IncidentSummary(
                incident_id=1,
                severity=IncidentSeverity.CRITICAL,
                observed="Vehicle brake failure on the descent.",
                outcome=None,
                is_resolved=False,
            )
        ],
    )
    assert "STILL OPEN" in " ".join(assess(r).blocking_concerns)


def test_a_near_miss_is_not_treated_as_a_black_mark():
    """Doc 06's incident model calls a near miss the most valuable row in the table.
    Counting it against a vendor teaches coordinators to stop recording them, which
    costs far more than it saves."""
    r = record(
        reviews=[good_review(i) for i in range(MIN_REVIEWS_FOR_RATING)],
        incidents=[
            IncidentSummary(
                incident_id=1,
                severity=IncidentSeverity.NEAR_MISS,
                observed="Vehicle slid on the approach and stopped safely.",
                outcome="Driver briefed; route timing changed.",
                is_resolved=True,
            )
        ],
    )
    result = assess(r)
    assert result.recommendation is Recommendation.USE_AGAIN
    assert result.blocking_concerns == []


def test_a_manual_hold_outranks_everything_computed():
    """Doc 06 wants manual judgement visible. A person who wrote this down outranks
    any number, and no run of good reviews clears it."""
    r = record(
        reviews=[good_review(i) for i in range(10)],
        manual_hold_reason="Owner asked our travellers for money directly.",
    )
    result = assess(r)
    assert result.recommendation is Recommendation.DO_NOT_USE
    assert "asked our travellers for money" in " ".join(result.blocking_concerns)


def test_a_single_refusal_blocks_regardless_of_the_others():
    r = record(
        reviews=[
            *[good_review(i) for i in range(5)],
            Review(departure_id=99, would_use_again=False, note="Never again."),
        ]
    )
    result = assess(r)
    assert result.recommendation is Recommendation.REVIEW_BEFORE_REBOOKING
    assert any("would not use" in c for c in result.blocking_concerns)


# ----------------------------------------------------------- refusing precision


def test_no_rating_is_reported_below_the_sample_threshold():
    """Two stays is an anecdote. A vendor list sorted by an anecdote sends next
    season's bookings at whoever happened to have a good week."""
    r = record(reviews=[good_review(1), good_review(2)])
    result = assess(r)
    assert result.recommendation is Recommendation.TOO_EARLY_TO_SAY
    assert all(v is None for v in result.ratings.values())
    assert not result.is_rateable


def test_ratings_appear_once_there_are_enough_of_them():
    r = record(reviews=[good_review(i) for i in range(MIN_REVIEWS_FOR_RATING)])
    result = assess(r)
    assert result.is_rateable
    assert result.ratings["punctuality"] == Decimal("5.0")


def test_an_unanswered_dimension_is_not_counted_as_a_low_score():
    r = record(
        reviews=[
            Review(departure_id=i, ratings={"punctuality": 5}, would_use_again=True)
            for i in range(MIN_REVIEWS_FOR_RATING)
        ]
    )
    result = assess(r)
    assert result.ratings["punctuality"] == Decimal("5.0")
    assert result.ratings["cleanliness_and_condition"] is None


def test_undecided_is_not_counted_as_a_refusal():
    """`None` is a reviewer who would not commit. Turning that into "no" is unfair to
    the vendor and a worse record."""
    r = record(
        reviews=[Review(departure_id=i) for i in range(MIN_REVIEWS_FOR_RATING)]
    )
    result = assess(r)
    assert result.blocking_concerns == []
    assert r.would_not_use_again_count == 0


def test_a_rating_outside_one_to_five_is_rejected_at_construction():
    with pytest.raises(ValueError):
        Review(departure_id=1, ratings={"punctuality": 0})


# ------------------------------------------------- travellers versus coordinators


def test_traveller_ratings_are_kept_separate_from_coordinator_ratings():
    """The coordinator chose this vendor and may have to defend that choice. The
    traveller has no such stake, so the two are never averaged together."""
    r = record(
        reviews=[good_review(i) for i in range(MIN_REVIEWS_FOR_RATING)],
        traveller_signal=TravellerSignal(dimension="accommodation", ratings=(2, 2, 3)),
    )
    result = assess(r)
    assert result.ratings["accuracy_against_promise"] == Decimal("5.0")
    assert result.traveller_average == Decimal("2.3")


def test_a_disagreement_between_the_two_is_called_out():
    """The most informative thing on the page, and the thing averaging would destroy."""
    r = record(
        reviews=[good_review(i) for i in range(MIN_REVIEWS_FOR_RATING)],
        traveller_signal=TravellerSignal(dimension="accommodation", ratings=(2, 2, 3)),
    )
    assert any("travellers rate it" in n for n in assess(r).notes)


def test_too_few_traveller_ratings_report_nothing():
    signal = TravellerSignal(dimension="accommodation", ratings=(1,))
    assert signal.count == 1
    assert signal.average is None


# ------------------------------------------------------------------- cost


def test_a_cost_overrun_is_surfaced_rather_than_absorbed():
    """Doc 06: no customer-facing claim changes because an internal cost rose. This
    is where the rise becomes visible instead of quietly eating a departure's margin."""
    r = record(
        reviews=[good_review(i) for i in range(MIN_REVIEWS_FOR_RATING)],
        cost=CostVariance(agreed=Decimal("100000"), paid=Decimal("125000")),
    )
    result = assess(r)
    assert result.cost_variance == Decimal("25000")
    assert any("more than agreed" in n for n in result.notes)


def test_paying_what_was_agreed_raises_nothing():
    cost = CostVariance(agreed=Decimal("100000"), paid=Decimal("100000"))
    assert not cost.is_concerning
    assert cost.variance == Decimal("0")


def test_variance_fraction_is_none_rather_than_a_divide_by_zero():
    assert CostVariance(agreed=Decimal("0"), paid=Decimal("5000")).variance_fraction is None


# -------------------------------------------------------------- the good case


def test_a_clean_vendor_with_enough_history_is_recommended():
    r = record(reviews=[good_review(i) for i in range(MIN_REVIEWS_FOR_RATING)])
    result = assess(r)
    assert result.recommendation is Recommendation.USE_AGAIN
    assert result.blocking_concerns == []
    assert "would use them again" in result.headline


def test_the_headline_is_a_sentence_not_a_number():
    """Doc 06 forbids the answer being an average. A sentence cannot be sorted on,
    which is the point — it has to be read."""
    result = assess(record(reviews=[good_review(i) for i in range(4)]))
    assert not hasattr(result, "score")
    assert result.name in result.headline
    assert len(result.headline.split()) > 4


def test_an_unpaid_vendor_is_a_debt_not_a_saving():
    """The bug the first real run exposed. A vendor with 3,00,000 agreed and nothing
    paid showed a variance of -3,00,000, which reads on a screen as spending three
    lakh less than agreed. It is an unpaid invoice wearing the clothes of a saving."""
    cost = CostVariance(agreed=Decimal("300000"), paid=Decimal("0"))
    assert not cost.is_settled
    assert cost.outstanding == Decimal("300000")
    assert cost.variance_fraction is None

    result = assess(record(reviews=[good_review(i) for i in range(3)], cost=cost))
    assert result.cost_variance == Decimal("0")
    assert result.cost_outstanding == Decimal("300000")
    assert not result.cost_settled
    assert any("still" in n and "unpaid" in n for n in result.notes)


def test_a_partly_paid_vendor_is_also_unsettled():
    cost = CostVariance(agreed=Decimal("100000"), paid=Decimal("60000"))
    assert not cost.is_settled
    assert cost.outstanding == Decimal("40000")
    assert cost.variance_fraction is None


def test_variance_is_judged_only_once_the_booking_is_settled():
    cost = CostVariance(agreed=Decimal("100000"), paid=Decimal("125000"))
    assert cost.is_settled
    assert cost.outstanding == Decimal("0")
    assert cost.is_concerning


# ------------------------------------------------------------------- the score


def test_a_serious_incident_caps_the_score_however_good_the_reviews():
    """Doc 06 permits a score "to assist planning" on the condition that serious
    incidents stay visible rather than hidden in an average. Printing the incident
    beside a 100 and hoping somebody reads it does not meet that condition — the
    number is what gets sorted on and remembered. So the cap is arithmetic."""
    r = record(
        reviews=[good_review(i) for i in range(10)],
        incidents=[
            IncidentSummary(
                incident_id=1,
                severity=IncidentSeverity.SERIOUS,
                observed="Party arrived to no rooms; slept in the vehicle.",
                outcome="Moved to another house next morning.",
                is_resolved=True,
            )
        ],
    )
    result = assess(r)
    assert result.reliability_score == SCORE_CEILING_WITH_CONCERN
    assert result.is_score_capped
    assert any("Capped at" in e for e in result.score_explanation)


def test_more_good_reviews_do_not_lift_the_cap():
    """The cap lifts when the concern is settled, not when the average improves."""
    with_concern = record(
        reviews=[good_review(i) for i in range(30)],
        manual_hold_reason="Owner asked our travellers for money directly.",
    )
    assert assess(with_concern).reliability_score == SCORE_CEILING_WITH_CONCERN


def test_resolving_the_concern_lifts_the_cap():
    clean = record(reviews=[good_review(i) for i in range(10)])
    assert assess(clean).reliability_score == 100
    assert not assess(clean).is_score_capped


def test_a_perfect_vendor_scores_100_and_a_poor_one_scores_low():
    perfect = record(reviews=[good_review(i) for i in range(4)])
    assert assess(perfect).reliability_score == 100

    poor = record(
        reviews=[
            Review(
                departure_id=i,
                ratings={key: 1 for key, _ in DIMENSIONS},
                would_use_again=None,
            )
            for i in range(4)
        ]
    )
    assert assess(poor).reliability_score == 0


def test_no_score_below_the_review_threshold():
    """Same discipline as the ratings. A number computed from two departures is the
    anecdote this module refuses everywhere else."""
    result = assess(record(reviews=[good_review(1), good_review(2)]))
    assert result.reliability_score is None
    assert any("No score until" in e for e in result.score_explanation)


def test_an_unrated_dimension_is_dropped_rather_than_scored_zero():
    """A vendor nobody rated on cleanliness has not scored badly on cleanliness."""
    partial = record(
        reviews=[
            Review(departure_id=i, ratings={"punctuality": 5}, would_use_again=True)
            for i in range(4)
        ]
    )
    assert assess(partial).reliability_score == 100


def test_the_score_never_travels_without_its_concerns():
    """Fields of the same object, which is as close as the type system gets to
    insisting they are read together."""
    from api.domain.vendors import VendorAssessment

    assert "reliability_score" in VendorAssessment.__dataclass_fields__
    assert "blocking_concerns" in VendorAssessment.__dataclass_fields__


def test_the_score_is_explained():
    result = assess(record(reviews=[good_review(i) for i in range(4)]))
    joined = " ".join(result.score_explanation)
    assert "coordinator ratings average" in joined
    assert "would use them again" in joined
