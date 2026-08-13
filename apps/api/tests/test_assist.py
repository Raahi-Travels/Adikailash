"""The assistant's refusal gate, which runs before any model is called.

`test_a_medical_question_never_reaches_the_model` is the one that matters. Doc 04
says AI may not "provide medical clearance or diagnosis" and a standing constraint
forbids fitness certification "by human or AI". Here that is a pure function over the
question text, not a paragraph of system prompt — a model having a bad day cannot be
talked around a branch it is never given.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest

from api.domain.assist import (
    MIN_RETRIEVAL_SCORE,
    REFUSAL_GUIDANCE,
    STATUS_QUOTABLE_WITHIN,
    SYSTEM_CONTRACT,
    Passage,
    Refusal,
    StatusFact,
    build_prompt,
    ground,
    is_status_question,
    refusal_for,
)

NOW = datetime(2027, 5, 20, 12, 0, tzinfo=timezone.utc)


def passage(score: float = 0.5, **kw) -> Passage:
    base = {
        "kind": "guide",
        "title": "Inner line permits",
        "text": "The inner line permit is issued at Dharchula.",
        "source_ref": "guide:inner-line-permit",
    }
    return Passage(**{**base, **kw, "score": score})


def status(hours_old: int = 2, access: str = "open") -> StatusFact:
    return StatusFact(
        segment_name="Dharchula to Gunji",
        access=access,
        summary="Single lane past the slide.",
        verified_at=NOW - timedelta(hours=hours_old),
        verified_by="Field Coordinator",
        source="field_coordinator",
    )


# ------------------------------------------------------------ the refusal gate


@pytest.mark.parametrize(
    "question",
    [
        "Am I fit enough for this trek?",
        "My father has a heart condition, can he come?",
        "Will I get AMS at Gunji?",
        "Is it safe for me with high blood pressure?",
        "Should I take Diamox?",
        "My mother is 71, is there an age limit?",
        "Is she medically fit to do this?",
        "Can my wife manage the walk after her surgery?",
    ],
)
def test_a_medical_question_never_reaches_the_model(question: str):
    """No fitness judgement, no diagnosis, not even a reassuring one — and the
    decision is made here rather than by a prompt the model may be argued out of."""
    assert refusal_for(question) is Refusal.MEDICAL
    result = ground(question, [passage()], status=status(), now=NOW)
    assert result.refusal is Refusal.MEDICAL
    assert not result.may_answer
    # Nothing to build a prompt from: the evidence is not even attached.
    assert result.passages == ()


def test_medical_wins_over_a_commercial_question_in_the_same_sentence():
    """"Can I get a refund, my father has a heart condition" must route to a person
    who reads the whole sentence, not to a policy quote."""
    q = "Can I get a refund? My father has a heart condition."
    assert refusal_for(q) is Refusal.MEDICAL


@pytest.mark.parametrize(
    "question",
    [
        "Can you give me a discount for six people?",
        "What is your best price?",
        "Can you waive the cancellation fee?",
        "Can you change the itinerary for us?",
    ],
)
def test_commercial_commitments_are_refused(question: str):
    assert refusal_for(question) is Refusal.COMMERCIAL


@pytest.mark.parametrize(
    "question",
    [
        "Will I definitely see Om Parvat?",
        "Can you guarantee darshan?",
        "Which exact hotel will we stay in?",
        "Will the weather be clear in May?",
    ],
)
def test_promises_are_refused(question: str):
    assert refusal_for(question) is Refusal.PROMISE


@pytest.mark.parametrize(
    "question",
    ["This is unacceptable, I want compensation.", "I was misled about the rooms."],
)
def test_complaints_go_to_a_human(question: str):
    assert refusal_for(question) is Refusal.COMPLAINT


def test_an_ordinary_question_is_not_refused():
    """The gate is broad on purpose, but it must not swallow the questions the
    assistant exists to answer."""
    assert refusal_for("Where is the inner line permit issued?") is None
    assert refusal_for("How many nights is the Adi Kailash journey?") is None
    assert refusal_for("What is the gateway for the Kumaon circuit?") is None


def test_every_refusal_has_guidance_for_the_coordinator():
    for refusal in Refusal:
        assert REFUSAL_GUIDANCE[refusal].strip()


# ---------------------------------------------------------------- route status


def test_a_status_question_is_recognised():
    assert is_status_question("Is the road to Gunji open?")
    assert is_status_question("Any landslide on the route right now?")
    assert not is_status_question("How many nights is the journey?")


@pytest.mark.parametrize(
    "question",
    [
        "Where is the inner line permit issued?",
        "How do I apply for the inner line permit?",
        "What documents does the permit need?",
    ],
)
def test_a_process_question_about_permits_is_not_a_status_question(question: str):
    """An early version matched `permit issued` and swallowed "Where is the inner
    line permit issued?", refusing a perfectly answerable content question for want
    of a live road record. A status question asks what is true *now*; where and how
    are asking about a process that does not change day to day."""
    assert not is_status_question(question)
    result = ground(question, [passage(score=0.6)], status=None, now=NOW)
    assert result.may_answer


def test_fresh_status_is_quoted_with_its_timestamp_and_verifier():
    """Doc 04 forbids confirming status "without an approved current source". This is
    the approved source, and its provenance is welded into the sentence so it cannot
    be dropped in the interest of a smoother reply."""
    result = ground("Is the road open?", [], status=status(hours_old=3), now=NOW)
    assert result.may_answer
    sentence = result.status.as_sentence(now=NOW)
    assert "3 hours ago" in sentence
    assert "Field Coordinator" in sentence
    assert "not a forecast" in sentence


def test_stale_status_is_refused_rather_than_repeated():
    """An assistant repeating a four-day-old "open" with confidence is worse than one
    that says it does not know."""
    old = status(hours_old=int(STATUS_QUOTABLE_WITHIN.total_seconds() // 3600) + 1)
    result = ground("Is the road open?", [passage()], status=old, now=NOW)
    assert result.refusal is Refusal.STATUS_STALE


def test_a_status_question_with_no_record_is_refused():
    result = ground("Is the road open?", [passage()], status=None, now=NOW)
    assert result.refusal is Refusal.NO_GROUNDING


def test_a_closed_road_reads_as_closed_not_as_a_forecast():
    fact = status(hours_old=1, access="closed")
    assert "recorded as closed" in fact.as_sentence(now=NOW)


# ------------------------------------------------------------------- grounding


def test_no_matching_content_refuses_rather_than_improvising():
    """Doc 08 requires uncertainty handling. A plausible invented answer about a
    permit is how somebody ends up stranded at a checkpost."""
    result = ground("What is the wifi password?", [], now=NOW)
    assert result.refusal is Refusal.NO_GROUNDING


def test_weak_matches_are_discarded_before_they_become_evidence():
    weak = passage(score=MIN_RETRIEVAL_SCORE / 2)
    result = ground("Where is the permit issued?", [weak], now=NOW)
    assert result.refusal is Refusal.NO_GROUNDING


def test_a_good_match_is_answerable_and_carries_its_citation():
    result = ground("Where is the permit issued?", [passage(score=0.6)], now=NOW)
    assert result.may_answer
    assert result.citations == ["guide:inner-line-permit"]


# --------------------------------------------------------------- the contract


def test_the_prompt_contains_only_the_question_and_the_evidence():
    """No conversation history, no traveller record. Doc 08 requires restricted
    access to sensitive traveller data, and the simplest way to honour that is for
    the assistant never to receive any."""
    result = ground("Where is the permit issued?", [passage(score=0.6)], now=NOW)
    prompt = build_prompt(result, now=NOW)
    assert "Where is the permit issued?" in prompt
    assert "guide:inner-line-permit" in prompt
    assert "issued at Dharchula" in prompt
    for leak in ("phone", "@", "reservation", "lead_id", "payment"):
        assert leak not in prompt.lower()


def test_the_status_sentence_is_prebuilt_rather_than_left_to_the_model():
    result = ground("Is the road open?", [], status=status(hours_old=2), now=NOW)
    prompt = build_prompt(result, now=NOW)
    assert "VERIFIED ROUTE STATUS" in prompt
    assert "Field Coordinator" in prompt
    assert "2 hours ago" in prompt


def test_the_contract_forbids_what_doc_04_forbids():
    # Whitespace-normalised: the contract is wrapped for reading, so a rule can span
    # a line break and a naive substring check would silently stop asserting it.
    lowered = " ".join(SYSTEM_CONTRACT.lower().split())
    assert "never assess anybody's health" in lowered
    assert "never commit to a price" in lowered
    assert "no urgency, no scarcity, no social proof" in lowered
    assert "never fill a gap from general knowledge" in lowered


def test_the_contract_is_versioned():
    """A silent prompt change would make every previous evaluation run meaningless,
    which is the opposite of what doc 08's logging requirement is for."""
    from api.domain.assist import CONTRACT_VERSION

    assert CONTRACT_VERSION


# ------------------------------------------------------------ public attribution


def test_a_quoted_status_names_the_verifier_without_their_email():
    """Doc 02 wants a *named* verifier so the claim is somebody's responsibility. An
    email address adds nothing to that and puts a staff inbox into a sentence that
    gets pasted into WhatsApp.

    Found the way these things usually are: the assistant quoted a status to a
    coordinator with an email in the middle of it, which meant the public /status
    endpoint had been returning one all along."""
    fact = StatusFact(
        segment_name="Dharchula to Gunji",
        access="open",
        summary=None,
        verified_at=NOW - timedelta(hours=2),
        verified_by="Field Coordinator <ops@example.invalid>",
        source="field_coordinator",
    )
    sentence = fact.as_sentence(now=NOW)
    assert "Field Coordinator" in sentence
    assert "@" not in sentence
    assert "<" not in sentence


def test_a_single_strong_term_is_enough_to_ground_an_answer():
    """`ts_rank` returns about 0.03 for one matching term on these guide lengths. An
    earlier threshold of 0.05 silently demanded two, and dropped "What should I bring
    for the cold?" against a packing guide that says "cold"."""
    result = ground("What should I bring for the cold?", [passage(score=0.030)], now=NOW)
    assert result.may_answer
