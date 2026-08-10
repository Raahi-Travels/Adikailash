"""Reservation lifecycle and the gates on confirmation.

**The rule this module exists to enforce.** From the standing constraints in
`docs/DECISIONS.md`, taken from docs 00/06/09:

    "Never present a departure as confirmed because a payment succeeded —
    confirmation requires operator, permit and minimum-group conditions to be met."

That is the single most consequential sentence in the pack, because getting it wrong
means telling a family their pilgrimage is booked when it is not. So confirmation
here is not a state a coordinator can simply select. It is computed from explicit
gates, every failing gate names itself, and money is only one of them and never
sufficient on its own.

**Decision O3, settled 10 August 2026: offline only for the first season.** No
payment is taken on the website. A coordinator records what actually arrived by bank
transfer or UPI against the reservation. `PaymentRecord` is therefore a ledger of
real-world events, not a gateway integration, and this module never talks to one.

**Decision O2, settled 10 August 2026: own tour-operator registration.** The company
contracts with the traveller directly rather than fronting a partner's licence. A
departure may still be operated with a partner on the ground, which is why
`operator_assigned` remains a gate: somebody with the right registration has to be
responsible for the inner-line segment before anyone is told they are going.

Everything here is pure. No ORM, no session, no I/O, so the rules can be tested
without a database and the same functions serve both the model and the API layer.
"""

from __future__ import annotations

import enum
from dataclasses import dataclass, field
from decimal import Decimal


class ReservationState(enum.StrEnum):
    """Doc 05's reservation lifecycle.

    Note what is absent: there is no "paid" state. Payment is a ledger fact, not a
    stage, precisely so that nobody can reach ``CONFIRMED`` by taking money.
    """

    #: A coordinator is assembling the party and the proposal. Nothing shared yet.
    DRAFT = "draft"
    #: A truthful proposal has gone to the traveller. Still no commitment either way.
    PROPOSED = "proposed"
    #: Places are held against the departure. Refundable, and explicitly not a booking.
    HELD = "held"
    #: Every gate below has passed. This is the only state that means "you are going".
    CONFIRMED = "confirmed"
    #: Confirmed and collecting documents, permits and traveller detail.
    PREPARING = "preparing"
    #: Readiness satisfied. Nothing outstanding before departure.
    READY = "ready"
    #: The journey happened.
    TRAVELLED = "travelled"
    #: The traveller withdrew.
    CANCELLED_BY_TRAVELLER = "cancelled_by_traveller"
    #: We withdrew, or the route did. Refund terms differ, hence the separate state.
    CANCELLED_BY_US = "cancelled_by_us"
    #: A hold that was never taken up. Distinct from a cancellation: nobody decided.
    LAPSED = "lapsed"


#: States in which the reservation still occupies capacity on the departure.
HOLDS_CAPACITY = frozenset(
    {
        ReservationState.HELD,
        ReservationState.CONFIRMED,
        ReservationState.PREPARING,
        ReservationState.READY,
        ReservationState.TRAVELLED,
    }
)

#: Terminal states. Nothing transitions out of these.
TERMINAL = frozenset(
    {
        ReservationState.TRAVELLED,
        ReservationState.CANCELLED_BY_TRAVELLER,
        ReservationState.CANCELLED_BY_US,
        ReservationState.LAPSED,
    }
)

_ALLOWED: dict[ReservationState, frozenset[ReservationState]] = {
    ReservationState.DRAFT: frozenset(
        {
            ReservationState.PROPOSED,
            ReservationState.HELD,
            ReservationState.CANCELLED_BY_TRAVELLER,
            ReservationState.CANCELLED_BY_US,
        }
    ),
    ReservationState.PROPOSED: frozenset(
        {
            ReservationState.HELD,
            ReservationState.LAPSED,
            ReservationState.CANCELLED_BY_TRAVELLER,
            ReservationState.CANCELLED_BY_US,
        }
    ),
    ReservationState.HELD: frozenset(
        {
            ReservationState.CONFIRMED,
            ReservationState.LAPSED,
            ReservationState.CANCELLED_BY_TRAVELLER,
            ReservationState.CANCELLED_BY_US,
        }
    ),
    ReservationState.CONFIRMED: frozenset(
        {
            ReservationState.PREPARING,
            ReservationState.CANCELLED_BY_TRAVELLER,
            ReservationState.CANCELLED_BY_US,
        }
    ),
    ReservationState.PREPARING: frozenset(
        {
            ReservationState.READY,
            ReservationState.CANCELLED_BY_TRAVELLER,
            ReservationState.CANCELLED_BY_US,
        }
    ),
    ReservationState.READY: frozenset(
        {
            ReservationState.TRAVELLED,
            # A route can close the week before. Staying honest matters more than a
            # tidy funnel, so cancellation stays reachable to the last moment.
            ReservationState.CANCELLED_BY_TRAVELLER,
            ReservationState.CANCELLED_BY_US,
        }
    ),
    ReservationState.TRAVELLED: frozenset(),
    ReservationState.CANCELLED_BY_TRAVELLER: frozenset(),
    ReservationState.CANCELLED_BY_US: frozenset(),
    ReservationState.LAPSED: frozenset(),
}


def allowed_transitions(state: ReservationState) -> frozenset[ReservationState]:
    return _ALLOWED[state]


def can_transition(current: ReservationState, target: ReservationState) -> bool:
    return target in _ALLOWED[current]


# --------------------------------------------------------------------- confirmation


@dataclass(frozen=True, slots=True)
class ConfirmationGates:
    """Everything that must be true before a party is told they are going.

    Passed in explicitly rather than read from a session, so the caller has to have
    actually established each fact. A default of ``False`` is deliberate: a gate
    nobody checked is a gate that has not passed.
    """

    #: The departure itself has reached a state that can carry confirmed travellers.
    departure_confirmed: bool = False
    #: Someone with the right registration is responsible for the inner-line segment.
    operator_assigned: bool = False
    #: The departure has the people it needs to run at all.
    minimum_group_met: bool = False
    #: Terms and cancellation policy accepted, with the version recorded.
    policy_accepted: bool = False
    #: Every traveller in the party has been named. A permit needs names.
    party_complete: bool = False
    #: A named human owns this group.
    coordinator_assigned: bool = False
    #: What the ledger says has actually arrived, against what was agreed.
    amount_due: Decimal = Decimal("0")
    amount_received: Decimal = Decimal("0")

    @property
    def balance_settled(self) -> bool:
        return self.amount_received >= self.amount_due


#: Why each gate is blocking, in words a coordinator can act on and, where it comes
#: to that, read aloud to a customer. Deliberately not error codes.
_GATE_REASONS: tuple[tuple[str, str], ...] = (
    (
        "departure_confirmed",
        "The departure itself is not confirmed yet.",
    ),
    (
        "operator_assigned",
        "No operator is assigned to this departure, so nobody is registered to run it.",
    ),
    (
        "minimum_group_met",
        "The departure has not reached its minimum group size.",
    ),
    (
        "policy_accepted",
        "The party has not accepted the terms and cancellation policy.",
    ),
    (
        "party_complete",
        "Not every traveller has been named. Permits are issued against names.",
    ),
    (
        "coordinator_assigned",
        "No coordinator owns this reservation.",
    ),
    (
        "balance_settled",
        "The agreed amount has not been fully received and recorded.",
    ),
)


def confirmation_blockers(gates: ConfirmationGates) -> list[str]:
    """Every reason this reservation cannot be confirmed. Empty means it can.

    Returns all of them rather than the first, because a coordinator chasing one
    blocker at a time across a week of phone calls is how departures slip.
    """
    return [
        reason for attribute, reason in _GATE_REASONS if not getattr(gates, attribute)
    ]


def can_confirm(gates: ConfirmationGates) -> bool:
    return not confirmation_blockers(gates)


# ------------------------------------------------------------------------ readiness


@dataclass(frozen=True, slots=True)
class Readiness:
    """What is outstanding before this group can travel.

    Separate from confirmation on purpose. Confirmation asks "may we tell them they
    are going"; readiness asks "is anything still missing", and the answer keeps
    changing right up to departure.
    """

    documents_outstanding: int = 0
    travellers_named: int = 0
    travellers_expected: int = 0
    policy_accepted: bool = False
    coordinator: str | None = None
    amount_due: Decimal = Decimal("0")
    amount_received: Decimal = Decimal("0")

    @property
    def balance_outstanding(self) -> Decimal:
        return max(Decimal("0"), self.amount_due - self.amount_received)

    @property
    def party_complete(self) -> bool:
        return (
            self.travellers_expected > 0
            and self.travellers_named >= self.travellers_expected
        )

    @property
    def is_ready(self) -> bool:
        return not self.outstanding

    @property
    def outstanding(self) -> list[str]:
        """Plain-language list of what is still missing, in the order to chase it."""
        items: list[str] = []
        if not self.coordinator:
            items.append("No coordinator assigned")
        if not self.party_complete:
            missing = max(0, self.travellers_expected - self.travellers_named)
            items.append(
                f"{missing} traveller{'s' if missing != 1 else ''} still to be named"
                if missing
                else "Party size not set"
            )
        if self.documents_outstanding:
            n = self.documents_outstanding
            items.append(f"{n} document{'s' if n != 1 else ''} outstanding")
        if not self.policy_accepted:
            items.append("Terms not accepted")
        if self.balance_outstanding > 0:
            items.append(f"₹{self.balance_outstanding:,.0f} still to be received")
        return items


# -------------------------------------------------------------------- transitioning


@dataclass(frozen=True, slots=True)
class StateChange:
    """A recorded transition. Actor and reason are required, as with departures."""

    previous_state: ReservationState
    new_state: ReservationState
    actor: str
    reason: str
    blockers_overridden: list[str] = field(default_factory=list)


class TransitionRefused(Exception):
    """Raised when a transition is not permitted, carrying every reason."""

    def __init__(self, reasons: list[str]) -> None:
        self.reasons = reasons
        super().__init__(" ".join(reasons))


def transition(
    *,
    current: ReservationState,
    target: ReservationState,
    actor: str,
    reason: str,
    gates: ConfirmationGates | None = None,
) -> StateChange:
    """Move a reservation, or refuse and say exactly why.

    Confirmation is the only transition with gates. Cancellation is deliberately
    always available: the moment we make it hard to cancel honestly, the incentive
    to keep someone in a trip they should leave starts to win.
    """
    if not actor.strip():
        raise TransitionRefused(["A transition needs an actor."])
    if not reason.strip():
        raise TransitionRefused(["A transition needs a reason."])

    if not can_transition(current, target):
        allowed = ", ".join(sorted(s.value for s in allowed_transitions(current)))
        raise TransitionRefused(
            [
                f"A {current.value} reservation cannot become {target.value}."
                + (f" Allowed: {allowed}." if allowed else " It is final.")
            ]
        )

    if target is ReservationState.CONFIRMED:
        blockers = confirmation_blockers(gates or ConfirmationGates())
        if blockers:
            raise TransitionRefused(blockers)

    return StateChange(
        previous_state=current, new_state=target, actor=actor, reason=reason
    )
