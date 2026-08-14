"""Vendor performance after a departure (doc 06, Phase 4).

Doc 06 lists ten things to record after each departure, then adds the sentence that
decides how this module is shaped:

    "A future vendor score may assist planning, but serious incidents and manual
    judgement must remain visible rather than hidden in an average."

`assess()` returns evidence first — a headline sentence, the concerns that must be
read, the ratings where there are enough of them to mean anything, and the incidents,
which are never averaged away.

It also returns a `reliability_score`, because doc 06 permits one and the founders
asked for it. The condition in that same sentence is met **in the arithmetic rather
than in the layout**: a blocking concern caps the score at
`SCORE_CEILING_WITH_CONCERN`, so a vendor with an open serious incident cannot reach
a number anybody would read as fine, however many perfect reviews follow. Printing
the incident next to a 4.2 and hoping somebody reads it does not work — the number is
what gets sorted on and remembered. Capping it means the score *reports* the incident
in the only language a score has.

Three deliberate separations:

**The coordinator's review and the travellers' ratings are different evidence, kept
apart.** The coordinator chose this vendor and may have to defend that choice; the
traveller has no such stake. When the two disagree that is the most informative thing
on the page, and averaging them together destroys exactly that signal.

**`would_use_again` is the headline, not the mean of seven dimensions.** It is the
judgement a person actually made, and it is the question a coordinator planning next
season is really asking. A mean of seven dimensions is mush, and mush ranks well.

**A serious incident is a fact about the vendor, not a data point.** It appears in
`blocking_concerns` regardless of how good the ratings are, and no amount of
subsequent good service removes it — it can only be answered, in writing, by somebody
deciding to use them again anyway.
"""

from __future__ import annotations

import enum
from dataclasses import dataclass, field
from decimal import Decimal

from api.domain.incidents import IncidentSeverity

#: Doc 06's list, minus the three that are computed rather than rated: traveller
#: feedback comes from the feedback table, cost variance from the ledger, and
#: willingness to use again is its own judgement rather than a score out of five.
DIMENSIONS: tuple[tuple[str, str], ...] = (
    ("confirmation_reliability", "Did they confirm when they said they would?"),
    ("punctuality", "Pickup and service on time"),
    ("accuracy_against_promise", "Was it what they told us it would be?"),
    ("cleanliness_and_condition", "Cleanliness and condition"),
    ("staff_behaviour", "How their people treated travellers"),
    ("communication", "Reachable, and straight with us"),
    ("issue_resolution", "What they did when something went wrong"),
)

#: Below this many reviews, no rating is reported at all. Two stays is an anecdote,
#: and a vendor list sorted by an anecdote sends next season's bookings at whoever
#: happened to have a good week.
MIN_REVIEWS_FOR_RATING = 3

#: Severities that can never be averaged away. `NEAR_MISS` is deliberately excluded:
#: doc 06's incident model treats it as the most valuable row in the table precisely
#: because nothing happened, and treating it as a black mark would teach coordinators
#: to stop recording them.
BLOCKING_SEVERITIES = frozenset(
    {IncidentSeverity.SERIOUS, IncidentSeverity.CRITICAL}
)

#: A cost overrun past this fraction of the agreed price is reported as a concern.
#: Doc 06 wants "variance and reason" — this is the point at which the reason stops
#: being optional.
COST_VARIANCE_CONCERN = Decimal("0.10")

# --------------------------------------------------------------- the score
#
# Doc 06 permits one — "A future vendor score may assist planning" — with a condition
# attached in the same sentence: "but serious incidents and manual judgement must
# remain visible rather than hidden in an average."
#
# The usual way to honour that is to print the incidents next to the number and hope
# somebody reads them. They do not: the number is what gets sorted on, pasted into a
# message and remembered. So the condition is enforced in the arithmetic instead.
#
# `SCORE_CEILING_WITH_CONCERN` caps the score while any blocking concern is open. A
# vendor with a serious incident cannot reach a good score no matter how many perfect
# reviews follow it, so the number *cannot* hide the incident — it reports it, in the
# only language a score has. When the concern is resolved the cap lifts.

#: Highest score obtainable while a blocking concern is open. Below every threshold
#: anybody would read as "fine", which is the point.
SCORE_CEILING_WITH_CONCERN = 40

#: Weights, summing to 1. Coordinator ratings carry the most because they are the
#: most specific; `would_use_again` carries real weight because it is the judgement
#: somebody actually made; traveller ratings are third and independent of both.
WEIGHT_RATINGS = Decimal("0.45")
WEIGHT_WOULD_USE_AGAIN = Decimal("0.35")
WEIGHT_TRAVELLERS = Decimal("0.20")


class Recommendation(enum.StrEnum):
    """What to do with this vendor next season."""

    #: Enough good evidence, nothing outstanding.
    USE_AGAIN = "use_again"
    #: Nothing wrong, not enough evidence to say anything. The honest default.
    TOO_EARLY_TO_SAY = "too_early_to_say"
    #: Somebody has to read the detail before booking them again.
    REVIEW_BEFORE_REBOOKING = "review_before_rebooking"
    #: A person decided not to. Recorded as a decision, with its reason.
    DO_NOT_USE = "do_not_use"


@dataclass(frozen=True, slots=True)
class Review:
    """One coordinator's assessment of one vendor on one departure."""

    departure_id: int
    ratings: dict[str, int] = field(default_factory=dict)
    #: The headline judgement. `None` means the reviewer would not commit either way,
    #: which is different from "no" and must not be counted as one.
    would_use_again: bool | None = None
    note: str | None = None
    reviewed_by: str | None = None

    def __post_init__(self) -> None:
        for key, value in self.ratings.items():
            if not 1 <= value <= 5:
                raise ValueError(f"Rating for {key} must be 1-5, got {value}")


@dataclass(frozen=True, slots=True)
class IncidentSummary:
    """An incident involving this vendor, kept whole."""

    incident_id: int
    severity: IncidentSeverity
    observed: str
    outcome: str | None
    is_resolved: bool

    @property
    def is_blocking(self) -> bool:
        return self.severity in BLOCKING_SEVERITIES


@dataclass(frozen=True, slots=True)
class TravellerSignal:
    """What travellers said, from the private post-trip form.

    Kept separate from `Review` on purpose. This is the half with no stake in the
    booking decision, and the disagreement between the two is the signal.
    """

    #: The feedback dimension this vendor is answerable for — `accommodation` for a
    #: stay, `pickup_and_transport` for a vehicle. Matching every vendor to every
    #: dimension would credit a driver for a good homestay.
    dimension: str
    ratings: tuple[int, ...] = ()

    @property
    def count(self) -> int:
        return len(self.ratings)

    @property
    def average(self) -> Decimal | None:
        if self.count < MIN_REVIEWS_FOR_RATING:
            return None
        return (Decimal(sum(self.ratings)) / Decimal(self.count)).quantize(
            Decimal("0.1")
        )


@dataclass(frozen=True, slots=True)
class CostVariance:
    """Agreed against actually paid.

    Doc 06: "No customer-facing claim should be changed because an internal supplier
    cost increased without an approved commercial decision." This is where that
    increase becomes visible rather than quietly absorbed into a departure's margin.
    """

    agreed: Decimal = Decimal("0")
    paid: Decimal = Decimal("0")

    @property
    def variance(self) -> Decimal:
        return self.paid - self.agreed

    @property
    def outstanding(self) -> Decimal:
        """Agreed but not yet paid. Never negative."""
        return max(self.agreed - self.paid, Decimal("0"))

    @property
    def is_settled(self) -> bool:
        """Everything agreed has been paid.

        The distinction that makes `variance` mean anything. A vendor we simply have
        not paid yet shows `paid` of zero and a large negative variance, which reads
        on a screen as "we spent three lakh less than agreed" — an unpaid invoice
        wearing the clothes of a saving. Until a booking is settled the variance is
        not a performance signal about the vendor, it is a fact about our ledger.
        """
        return self.agreed > 0 and self.paid >= self.agreed

    @property
    def variance_fraction(self) -> Decimal | None:
        """None while unsettled, rather than a misleading negative."""
        if self.agreed <= 0 or not self.is_settled:
            return None
        return (self.variance / self.agreed).quantize(Decimal("0.001"))

    @property
    def is_concerning(self) -> bool:
        fraction = self.variance_fraction
        return fraction is not None and fraction > COST_VARIANCE_CONCERN


@dataclass(slots=True)
class VendorRecord:
    """Everything known about one vendor, before any judgement is applied."""

    supplier_id: int
    name: str
    kind: str
    reviews: list[Review] = field(default_factory=list)
    incidents: list[IncidentSummary] = field(default_factory=list)
    traveller_signal: TravellerSignal | None = None
    cost: CostVariance = field(default_factory=CostVariance)
    #: A human decision that overrides everything computed. Doc 06 wants manual
    #: judgement visible, and this is where it lives.
    manual_hold_reason: str | None = None

    @property
    def review_count(self) -> int:
        return len(self.reviews)

    @property
    def blocking_incidents(self) -> list[IncidentSummary]:
        return [i for i in self.incidents if i.is_blocking]

    @property
    def unresolved_incidents(self) -> list[IncidentSummary]:
        return [i for i in self.incidents if not i.is_resolved]

    @property
    def would_use_again_count(self) -> int:
        return sum(1 for r in self.reviews if r.would_use_again is True)

    @property
    def would_not_use_again_count(self) -> int:
        return sum(1 for r in self.reviews if r.would_use_again is False)

    def rating(self, dimension: str) -> Decimal | None:
        """Mean for one dimension, or None below the sample threshold.

        Withheld rather than shown with a caveat: a number on a screen gets read and
        remembered, and the caveat beside it does not.
        """
        values = [
            r.ratings[dimension] for r in self.reviews if dimension in r.ratings
        ]
        if len(values) < MIN_REVIEWS_FOR_RATING:
            return None
        return (Decimal(sum(values)) / Decimal(len(values))).quantize(Decimal("0.1"))

    @property
    def ratings(self) -> dict[str, Decimal | None]:
        return {key: self.rating(key) for key, _ in DIMENSIONS}


@dataclass(frozen=True, slots=True)
class VendorAssessment:
    """The answer: a sentence, the concerns, and the evidence behind both.

    Deliberately not a score. See the module docstring — doc 06 requires that serious
    incidents and manual judgement stay visible rather than being folded into an
    average, and the only reliable way to guarantee that is not to produce an average
    that could carry the whole answer.
    """

    supplier_id: int
    name: str
    recommendation: Recommendation
    headline: str
    #: Must be read before rebooking. Never empty when `recommendation` is
    #: `REVIEW_BEFORE_REBOOKING` or `DO_NOT_USE`.
    blocking_concerns: list[str] = field(default_factory=list)
    #: Worth knowing, not disqualifying.
    notes: list[str] = field(default_factory=list)
    ratings: dict[str, Decimal | None] = field(default_factory=dict)
    traveller_average: Decimal | None = None
    traveller_count: int = 0
    review_count: int = 0
    incident_count: int = 0
    #: Meaningful only once `cost_settled` is true — see `CostVariance.is_settled`.
    cost_variance: Decimal = Decimal("0")
    cost_outstanding: Decimal = Decimal("0")
    cost_settled: bool = False

    #: 0-100, or None when there is not enough evidence to compute one.
    #:
    #: Capped at `SCORE_CEILING_WITH_CONCERN` while any blocking concern is open, so
    #: it cannot read as "fine" over the top of a serious incident. Never returned
    #: without `blocking_concerns` beside it — they are fields of the same object,
    #: which is the closest the type system gets to insisting they travel together.
    reliability_score: int | None = None
    #: Why the score is what it is, including the cap when it applied. Doc 06 wants
    #: judgement visible; an unexplained number is the opposite of that.
    score_explanation: list[str] = field(default_factory=list)

    @property
    def is_rateable(self) -> bool:
        return self.review_count >= MIN_REVIEWS_FOR_RATING

    @property
    def is_score_capped(self) -> bool:
        return (
            self.reliability_score is not None
            and bool(self.blocking_concerns)
            and self.reliability_score <= SCORE_CEILING_WITH_CONCERN
        )


def _score_components(record: VendorRecord) -> tuple[Decimal | None, list[str]]:
    """The uncapped score and the reasons for it, or None with too little evidence.

    Each component is a 0-1 proportion so the weights mean what they say. A component
    with no data is dropped and the remaining weights are renormalised, rather than
    being scored as zero — a vendor nobody rated on cleanliness has not scored badly
    on cleanliness.
    """
    parts: list[tuple[Decimal, Decimal, str]] = []

    rated = [v for v in record.ratings.values() if v is not None]
    if rated:
        # 1-5 mapped onto 0-1: a 1 is the floor, not a quarter of the way up.
        mean = sum(rated, Decimal("0")) / Decimal(len(rated))
        parts.append(
            (
                (mean - 1) / 4,
                WEIGHT_RATINGS,
                f"coordinator ratings average {mean.quantize(Decimal('0.1'))}/5",
            )
        )

    decided = record.would_use_again_count + record.would_not_use_again_count
    if decided:
        share = Decimal(record.would_use_again_count) / Decimal(decided)
        parts.append(
            (
                share,
                WEIGHT_WOULD_USE_AGAIN,
                f"{record.would_use_again_count} of {decided} reviewers would use"
                " them again",
            )
        )

    traveller = record.traveller_signal.average if record.traveller_signal else None
    if traveller is not None:
        parts.append(
            (
                (traveller - 1) / 4,
                WEIGHT_TRAVELLERS,
                f"travellers rate them {traveller}/5",
            )
        )

    if not parts:
        return None, []

    total_weight = sum(w for _, w, _ in parts)
    raw = sum(value * weight for value, weight, _ in parts) / total_weight
    return raw * 100, [reason for _, _, reason in parts]


def assess(record: VendorRecord) -> VendorAssessment:
    """Turn a vendor's record into a recommendation, the reasons, and a score."""
    blocking: list[str] = []
    notes: list[str] = []

    # Manual judgement first, because doc 06 says it must not be buried and because
    # a person who wrote this down outranks anything computed below it.
    if record.manual_hold_reason:
        blocking.append(f"Held by a person: {record.manual_hold_reason}")

    for incident in record.blocking_incidents:
        state = "resolved" if incident.is_resolved else "STILL OPEN"
        blocking.append(
            f"{incident.severity.value.replace('_', ' ').title()} incident"
            f" ({state}): {incident.observed}"
        )

    if record.would_not_use_again_count:
        blocking.append(
            f"{record.would_not_use_again_count} coordinator(s) said they would not"
            " use this vendor again."
        )

    for incident in record.unresolved_incidents:
        if not incident.is_blocking:
            notes.append(f"Open incident: {incident.observed}")

    if record.cost.is_concerning:
        notes.append(
            f"Paid {record.cost.variance} more than agreed"
            f" ({record.cost.variance_fraction:.1%} over). Doc 06 wants the reason"
            " recorded, not absorbed into the departure's margin."
        )
    elif record.cost.outstanding > 0:
        # Reported as a debt, not as a variance. An unpaid supplier is not a saving,
        # and a negative variance on a screen reads exactly like one.
        notes.append(
            f"{record.cost.outstanding} of {record.cost.agreed} agreed is still"
            " unpaid, so there is no cost variance to judge them on yet."
        )

    # The disagreement between the two kinds of evidence is the most informative
    # thing here, so it is called out rather than left for somebody to notice.
    signal = record.traveller_signal
    traveller_average = signal.average if signal else None
    if traveller_average is not None:
        coordinator_view = record.rating(
            "accuracy_against_promise"
            if signal and signal.dimension == "accommodation"
            else "punctuality"
        )
        if coordinator_view is not None and coordinator_view - traveller_average >= 1:
            notes.append(
                f"Coordinators rate this vendor {coordinator_view} where travellers"
                f" rate it {traveller_average}. The travellers have no stake in the"
                " booking decision."
            )

    if blocking:
        recommendation = (
            Recommendation.DO_NOT_USE
            if record.manual_hold_reason
            else Recommendation.REVIEW_BEFORE_REBOOKING
        )
        headline = (
            f"{record.name}: {len(blocking)} thing(s) to settle before using them"
            " again."
        )
    elif record.review_count < MIN_REVIEWS_FOR_RATING:
        recommendation = Recommendation.TOO_EARLY_TO_SAY
        headline = (
            f"{record.name}: {record.review_count} departure(s) so far — not enough"
            " to say anything about them yet."
        )
        notes.append(
            f"Ratings are withheld until {MIN_REVIEWS_FOR_RATING} departures have"
            " been reviewed."
        )
    else:
        recommendation = Recommendation.USE_AGAIN
        headline = (
            f"{record.name}: {record.would_use_again_count} of"
            f" {record.review_count} reviews would use them again, nothing"
            " outstanding."
        )

    raw_score, score_reasons = _score_components(record)
    score: int | None = None
    explanation: list[str] = []
    if raw_score is not None and record.review_count >= MIN_REVIEWS_FOR_RATING:
        score = int(raw_score.to_integral_value())
        explanation = list(score_reasons)
        if blocking:
            # The condition doc 06 attaches to permitting a score at all. Enforced
            # here rather than left to whoever renders it.
            if score > SCORE_CEILING_WITH_CONCERN:
                explanation.append(
                    f"Capped at {SCORE_CEILING_WITH_CONCERN} from {score} because"
                    f" {len(blocking)} concern(s) are unresolved. The cap lifts when"
                    " they are settled, not when more good reviews arrive."
                )
                score = SCORE_CEILING_WITH_CONCERN
            else:
                explanation.append(
                    f"{len(blocking)} unresolved concern(s); the score is already"
                    f" below the {SCORE_CEILING_WITH_CONCERN} ceiling that applies"
                    " while any remain."
                )
    elif raw_score is not None:
        explanation.append(
            f"No score until {MIN_REVIEWS_FOR_RATING} departures have been reviewed."
            " Two is an anecdote and a list sorted by an anecdote sends next"
            " season's bookings at whoever had a good week."
        )

    return VendorAssessment(
        reliability_score=score,
        score_explanation=explanation,
        supplier_id=record.supplier_id,
        name=record.name,
        recommendation=recommendation,
        headline=headline,
        blocking_concerns=blocking,
        notes=notes,
        ratings=record.ratings,
        traveller_average=traveller_average,
        traveller_count=signal.count if signal else 0,
        review_count=record.review_count,
        incident_count=len(record.incidents),
        cost_variance=record.cost.variance if record.cost.is_settled else Decimal("0"),
        cost_outstanding=record.cost.outstanding,
        cost_settled=record.cost.is_settled,
    )


#: Which feedback dimension a vendor of each kind is answerable for. A driver should
#: not be credited for a good homestay, and a host should not carry a late vehicle.
#: Kinds absent from this map have no traveller signal, which is honest — nothing on
#: the traveller form asks about a permit agent.
FEEDBACK_DIMENSION_BY_KIND: dict[str, str] = {
    "stay": "accommodation",
    "transport": "pickup_and_transport",
}
