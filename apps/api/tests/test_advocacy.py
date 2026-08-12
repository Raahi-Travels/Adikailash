"""The review gate, and the rules that decide when we may ask somebody for a review.

`test_open_complaint_blocks_the_review_request` is the one that matters. If it flips,
we start emailing "how did we do?" links to people whose complaint is still sitting
unresolved in a queue — which is the single most reliable way to convert a private,
fixable problem into a permanent public one.
"""

from __future__ import annotations

import pytest

from api.domain.advocacy import (
    COMPLAINT_THRESHOLD,
    CURRENT_TERMS,
    Complaint,
    Feedback,
    ResolutionState,
    code_looks_valid,
    generate_referral_code,
    material_complaints,
    may_request_review,
    normalise_code,
    review_request_blockers,
)


def happy() -> Feedback:
    return Feedback(
        ratings={
            "sales_promise_accuracy": 5,
            "preparation": 4,
            "pickup_and_transport": 5,
            "accommodation": 4,
            "coordinator_support": 5,
            "route_communication": 5,
            "spiritual_and_cultural": 5,
        },
        recommend_score=10,
        what_went_well="The coordinator was extraordinary.",
    )


# ------------------------------------------------------------------ materiality


def test_a_low_rating_is_a_complaint_even_with_no_comment():
    """Somebody giving accommodation a 1 and writing nothing has still told us
    something. Requiring an explanation before we take it seriously gets the
    incentive exactly backwards."""
    fb = Feedback(ratings={"accommodation": 1}, recommend_score=9)
    found = material_complaints(fb)
    assert [c.dimension for c in found] == ["accommodation"]
    assert found[0].detail is None


def test_free_text_is_a_complaint_even_when_every_star_is_high():
    """People are generous with stars and honest in the comment box."""
    fb = Feedback(
        ratings={"accommodation": 5},
        recommend_score=10,
        what_went_wrong="The second vehicle was two hours late and nobody called.",
    )
    assert [c.dimension for c in material_complaints(fb)] == ["what_went_wrong"]


def test_whitespace_is_not_a_complaint():
    fb = Feedback(ratings={"accommodation": 5}, recommend_score=10, what_went_wrong="   ")
    assert material_complaints(fb) == []


def test_an_unanswered_question_is_not_a_low_score():
    """A missing key means unanswered. If a skipped control were read as a 1, every
    partly-filled form would open seven complaints nobody made."""
    fb = Feedback(ratings={}, recommend_score=10)
    assert material_complaints(fb) == []


@pytest.mark.parametrize("rating", [1, 2])
def test_at_or_below_the_threshold_is_material(rating: int):
    assert rating <= COMPLAINT_THRESHOLD
    fb = Feedback(ratings={"preparation": rating}, recommend_score=10)
    assert len(material_complaints(fb)) == 1


def test_a_middling_three_is_signal_but_not_a_blocker():
    """A 3 belongs in the operations review. It is not the kind of thing that should
    stop a company ever asking for a review."""
    fb = Feedback(ratings={"preparation": 3}, recommend_score=9)
    assert material_complaints(fb) == []


def test_rating_outside_one_to_five_is_rejected_at_construction():
    with pytest.raises(ValueError):
        Feedback(ratings={"preparation": 0})


# -------------------------------------------------------------------- the gate


def test_a_happy_traveller_may_be_asked():
    assert may_request_review(happy())
    assert review_request_blockers(happy()) == []


def test_open_complaint_blocks_the_review_request():
    """Doc 07 puts "resolve material complaints" at step 2 and "ask for a public
    review" at step 3. This is that ordering, in code."""
    fb = Feedback(
        ratings={"accommodation": 1},
        recommend_score=10,
    )
    blockers = review_request_blockers(fb)
    assert blockers
    assert "accommodation" in blockers[0]


def test_resolving_the_complaint_opens_the_gate():
    fb = Feedback(ratings={"accommodation": 1}, recommend_score=10)
    resolved = [
        Complaint(
            dimension="accommodation",
            rating=1,
            detail=None,
            state=ResolutionState.RESOLVED,
        )
    ]
    assert may_request_review(fb, resolved)


def test_acknowledging_also_opens_the_gate():
    """Looked into, and the honest answer is that we would not change anything. That
    is a handled complaint: the point is that a human considered it."""
    fb = Feedback(ratings={"accommodation": 2}, recommend_score=9)
    acked = [
        Complaint(
            dimension="accommodation",
            rating=2,
            detail=None,
            state=ResolutionState.ACKNOWLEDGED,
        )
    ]
    assert may_request_review(fb, acked)


def test_no_feedback_at_all_blocks_the_ask():
    """Step 1 before step 3: hear about a problem before inviting somebody to
    publish one."""
    assert not may_request_review(None)


def test_an_unhappy_traveller_is_not_asked_even_with_nothing_open():
    """Nothing is unresolved because nothing was specific enough to resolve — they
    simply did not enjoy it. Sending that person a review link is tone-deaf; the
    right follow-up is a phone call."""
    fb = Feedback(ratings={"preparation": 4}, recommend_score=5)
    blockers = review_request_blockers(fb)
    assert any("5/10" in b for b in blockers)


def test_asking_twice_is_blocked():
    assert not may_request_review(happy(), already_asked=True)


def test_every_reason_is_returned_not_just_the_first():
    """A coordinator wants the whole list. One-reason-at-a-time turns resolving it
    into several trips back to the same screen."""
    fb = Feedback(ratings={"accommodation": 1}, recommend_score=4)
    assert len(review_request_blockers(fb, already_asked=True)) == 3


def test_unanswered_recommendation_blocks():
    fb = Feedback(ratings={"preparation": 5}, recommend_score=None)
    assert not may_request_review(fb)


# ------------------------------------------------------------------- referrals


def test_code_carries_the_referrers_initials():
    """Doc 07 wants attribution to the referring traveller, and a code starting with
    their initials is attribution they can see — which is what makes them
    comfortable passing it on."""
    assert generate_referral_code("Meera Bisht").startswith("MB-")


def test_code_without_a_name_still_works():
    code = generate_referral_code(None)
    assert "-" not in code
    assert code_looks_valid(code)


def test_code_alphabet_excludes_ambiguous_glyphs():
    """These get read aloud over a phone and typed by somebody's father. 0/O and
    1/I/L cost more in support than the entropy is worth."""
    codes = "".join(generate_referral_code(None, length=16) for _ in range(50))
    assert not set(codes) & set("O0I1L")


@pytest.mark.parametrize(
    "typed", ["mee-k4t9p2", "MEE K4T9P2", " MEE-K4T9P2 ", "meek4t9p2"]
)
def test_normalisation_forgives_how_people_read_a_code_aloud(typed: str):
    assert normalise_code(typed) == "MEEK4T9P2"


def test_launch_terms_promise_no_money():
    """Doc 07: "The most powerful referral message is reliable delivery, not a large
    discount." A big discount also selects for the wrong referrals."""
    assert CURRENT_TERMS.benefit is None
    assert not CURRENT_TERMS.is_monetary


def test_terms_restrict_pressure_on_spiritual_communities():
    """Doc 07 says this explicitly, and it is the restriction most likely to be
    forgotten by whoever writes the referral copy."""
    joined = " ".join(CURRENT_TERMS.restrictions).lower()
    assert "spiritual" in joined
    assert "temple" in joined or "ashram" in joined
