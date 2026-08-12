"""Feedback, the complaint gate, and referrals (Phase 4, doc 07).

Doc 07 lists the review flow as five numbered steps, and the order is the whole
design:

    1. Collect private operational feedback
    2. Identify and resolve material complaints
    3. Ask satisfied travellers for an honest public review
    4. Provide a direct link without scripting false praise
    5. Request separate permission for images, video or story reuse

Step 2 sits before step 3 on purpose. **The gate here enforces that ordering in
code rather than trusting a coordinator to remember it.** Asking somebody for a
public review while their unresolved complaint is still open is how a business
converts a private, fixable problem into a permanent public one — and it is exactly
what a well-meaning automated "how did we do?" mail does by default.

So `review_request_blockers()` returns reasons, and the endpoint refuses while any
remain. There is no override flag. If the complaint is genuinely resolved, somebody
records the resolution — which is the work we wanted done anyway.

Nothing in this module knows about the database. Feedback arrives as a value object
and the answers come back as data, so the gate is testable against a season's worth
of awkward cases without a session.
"""

from __future__ import annotations

import enum
import re
import secrets
from dataclasses import dataclass, field

#: Ratings are 1-5. Doc 05 lists the dimensions; they are fixed rather than
#: configurable because a changing question set makes a season's answers
#: incomparable, and comparability is the only reason to collect ratings at all.
DIMENSIONS: tuple[tuple[str, str], ...] = (
    ("sales_promise_accuracy", "Did we deliver what we said we would?"),
    ("preparation", "Were you prepared for what the journey actually asked of you?"),
    ("pickup_and_transport", "Pickup, vehicles and the driving"),
    ("accommodation", "Where you stayed"),
    ("coordinator_support", "The coordinator who travelled with you"),
    ("route_communication", "How we told you about route and schedule changes"),
    ("spiritual_and_cultural", "The experience itself"),
)

#: At or below this, a dimension counts as a material complaint. Set at 2 rather
#: than 3: a 3 out of 5 is a real signal and belongs in the operations review, but
#: it is not the kind of thing that should block a company from ever asking for a
#: review. A 2 is somebody telling us something went wrong.
COMPLAINT_THRESHOLD = 2

#: Below this on the 0-10 recommendation question, do not ask for a public review
#: at all — not because the review would be bad, but because asking somebody who
#: is unhappy to go and write in public is a tone-deaf thing to do to a person.
RECOMMEND_ASK_THRESHOLD = 8


class ResolutionState(enum.StrEnum):
    OPEN = "open"
    #: Somebody looked into it and wrote down what was done. Not "we replied".
    RESOLVED = "resolved"
    #: Looked into, and the honest answer is that we would not change anything.
    #: Still counts as handled: the point is that a human considered it.
    ACKNOWLEDGED = "acknowledged"


@dataclass(frozen=True, slots=True)
class Complaint:
    """One thing a traveller said went wrong."""

    dimension: str
    #: None for a free-text complaint with no rating behind it.
    rating: int | None
    detail: str | None
    state: ResolutionState = ResolutionState.OPEN

    @property
    def is_open(self) -> bool:
        return self.state is ResolutionState.OPEN


@dataclass(frozen=True, slots=True)
class Feedback:
    """A completed private feedback form.

    `ratings` maps a dimension key to 1-5. Missing keys are unanswered, which is
    different from a low score and must never be counted as one.
    """

    ratings: dict[str, int] = field(default_factory=dict)
    #: 0-10, "would you recommend us". None when unanswered.
    recommend_score: int | None = None
    #: Free text. The most useful field on the form and the least structured.
    what_went_wrong: str | None = None
    what_went_well: str | None = None
    #: Explicitly raised by the traveller or logged by a coordinator afterwards.
    extra_complaints: tuple[Complaint, ...] = ()

    def __post_init__(self) -> None:
        for key, value in self.ratings.items():
            if not 1 <= value <= 5:
                raise ValueError(f"Rating for {key} must be 1-5, got {value}")
        if self.recommend_score is not None and not 0 <= self.recommend_score <= 10:
            raise ValueError("recommend_score must be 0-10")


def material_complaints(feedback: Feedback) -> list[Complaint]:
    """Everything that needs a human before we ask for anything.

    A low rating counts even with no comment attached. Somebody giving
    accommodation a 1 and writing nothing has still told us something, and
    requiring an explanation before we take it seriously gets the incentive
    backwards.
    """
    found = [
        Complaint(dimension=key, rating=value, detail=None)
        for key, value in sorted(feedback.ratings.items())
        if value <= COMPLAINT_THRESHOLD
    ]

    # Free text saying something went wrong is a complaint even when every rating
    # is high — people are generous with stars and honest in the comment box.
    if feedback.what_went_wrong and feedback.what_went_wrong.strip():
        found.append(
            Complaint(
                dimension="what_went_wrong",
                rating=None,
                detail=feedback.what_went_wrong.strip(),
            )
        )

    found.extend(feedback.extra_complaints)
    return found


def open_complaints(complaints: list[Complaint]) -> list[Complaint]:
    return [c for c in complaints if c.is_open]


def review_request_blockers(
    feedback: Feedback | None,
    complaints: list[Complaint] | None = None,
    *,
    already_asked: bool = False,
) -> list[str]:
    """Why we may not ask this traveller for a public review yet.

    Returns every reason rather than the first. A coordinator looking at this wants
    the whole list, and one-reason-at-a-time turns resolving it into several trips
    back to the same screen.
    """
    reasons: list[str] = []

    if feedback is None:
        reasons.append(
            "No private feedback yet. Doc 07 puts the private form first, so we hear"
            " about a problem before we invite somebody to publish one."
        )
        return reasons

    if already_asked:
        reasons.append(
            "We have already asked once. Asking again is pestering somebody who"
            " has done nothing wrong."
        )

    still_open = open_complaints(
        complaints if complaints is not None else material_complaints(feedback)
    )
    if still_open:
        listed = ", ".join(sorted({c.dimension for c in still_open}))
        reasons.append(
            f"{len(still_open)} unresolved complaint(s) to settle first: {listed}."
            " Resolve or acknowledge each one, recording what was actually done."
        )

    if feedback.recommend_score is None:
        reasons.append("The recommendation question is unanswered.")
    elif feedback.recommend_score < RECOMMEND_ASK_THRESHOLD:
        reasons.append(
            f"Recommendation is {feedback.recommend_score}/10. Below"
            f" {RECOMMEND_ASK_THRESHOLD} we do not ask for a public review — the"
            " right follow-up is a phone call, not a review link."
        )

    return reasons


def may_request_review(
    feedback: Feedback | None,
    complaints: list[Complaint] | None = None,
    *,
    already_asked: bool = False,
) -> bool:
    return not review_request_blockers(feedback, complaints, already_asked=already_asked)


# ------------------------------------------------------------------- referrals


#: Ambiguous glyphs removed. These get read aloud over a phone, written on paper
#: and typed by somebody's father; 0/O and 1/I/L cost more in support than the
#: extra entropy is worth.
_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"
_CODE_PATTERN = re.compile(r"^[A-Z0-9]{4,16}$")


def generate_referral_code(name: str | None = None, *, length: int = 6) -> str:
    """A short human-speakable code, prefixed with the referrer's initials.

    Doc 07 asks for "attribution to the referring traveller". A code that starts
    with `MEE-` is attribution the person can see, which matters more than it
    sounds: it is what makes them comfortable passing it on.
    """
    body = "".join(secrets.choice(_CODE_ALPHABET) for _ in range(length))
    initials = ""
    if name:
        initials = "".join(part[0] for part in name.split()[:2] if part).upper()
        initials = "".join(ch for ch in initials if ch.isalpha())
    return f"{initials}-{body}" if initials else body


def normalise_code(code: str) -> str:
    """What somebody typed, turned into what we stored.

    Case, spaces and the hyphen are all things people get wrong when reading a code
    off a WhatsApp message, and none of them should produce "invalid code".
    """
    return re.sub(r"[^A-Z0-9]", "", code.strip().upper())


def code_looks_valid(code: str) -> bool:
    return bool(_CODE_PATTERN.match(normalise_code(code)))


@dataclass(frozen=True, slots=True)
class ReferralTerms:
    """What a referral actually promises. Deliberately modest.

    Doc 07: "The most powerful referral message is reliable delivery, not a large
    discount." A big discount also selects for the wrong referrals — somebody
    forwarding a link for money, to people who did not ask.

    `benefit` is nullable and defaults to nothing. A referral programme that
    recognises people without paying them is a legitimate design, and it is the one
    we start with until the founders decide otherwise.
    """

    version: str
    benefit: str | None = None
    #: Doc 07: "No pressure on spiritual communities." Recorded next to the terms
    #: so it is read by whoever writes the referral copy.
    restrictions: tuple[str, ...] = (
        "Not to be used to solicit within temples, ashrams, yatra groups or any"
        " spiritual community gathering.",
        "No claim may be made on our behalf that we have not published ourselves.",
    )

    @property
    def is_monetary(self) -> bool:
        return self.benefit is not None


#: The terms in force. Versioned because somebody who referred under v1 is owed
#: what v1 said, not what today's page says.
CURRENT_TERMS = ReferralTerms(version="2026-08-referral-v1", benefit=None)
