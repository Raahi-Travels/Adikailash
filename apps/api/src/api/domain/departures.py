"""Departure lifecycle.

Doc 06 defines the states; doc 08 adds the invariant that makes them load-bearing:

    "Public departure state must be compatible with payment action."
    "No single payment webhook should automatically confirm the entire departure."

This module is the only place that decides whether a departure may take money or
advance. Route handlers and UI must ask it rather than re-deriving the rule, because
a departure that looks bookable while suspended is a severity-one trust defect
(doc 09), not a cosmetic bug.
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import StrEnum


class DepartureState(StrEnum):
    """Doc 06, "Departure lifecycle"."""

    DRAFT = "draft"
    FEASIBILITY_REVIEW = "feasibility_review"
    PROPOSED = "proposed"
    WAITLIST_OPEN = "waitlist_open"
    CONDITIONAL_RESERVATION = "conditional_reservation"
    OPEN_FOR_BOOKING = "open_for_booking"
    MINIMUM_GROUP_PENDING = "minimum_group_pending"
    CONFIRMED = "confirmed"
    PREPARATION = "preparation"
    READY_TO_DEPART = "ready_to_depart"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    SUSPENDED = "suspended"
    RESCHEDULED = "rescheduled"
    CANCELLED = "cancelled"


#: States a departure may be interrupted into from most of the live lifecycle.
#: Mountain conditions make these normal, not exceptional (doc 01 principle 10).
_INTERRUPTIONS = frozenset(
    {
        DepartureState.SUSPENDED,
        DepartureState.RESCHEDULED,
        DepartureState.CANCELLED,
    }
)

#: States from which an interruption is possible: anything publicly visible and
#: not already terminal.
_INTERRUPTIBLE = frozenset(
    {
        DepartureState.WAITLIST_OPEN,
        DepartureState.CONDITIONAL_RESERVATION,
        DepartureState.OPEN_FOR_BOOKING,
        DepartureState.MINIMUM_GROUP_PENDING,
        DepartureState.CONFIRMED,
        DepartureState.PREPARATION,
        DepartureState.READY_TO_DEPART,
    }
)

_FORWARD: dict[DepartureState, frozenset[DepartureState]] = {
    DepartureState.DRAFT: frozenset({DepartureState.FEASIBILITY_REVIEW, DepartureState.CANCELLED}),
    DepartureState.FEASIBILITY_REVIEW: frozenset(
        {DepartureState.PROPOSED, DepartureState.DRAFT, DepartureState.CANCELLED}
    ),
    DepartureState.PROPOSED: frozenset(
        {
            DepartureState.WAITLIST_OPEN,
            DepartureState.CONDITIONAL_RESERVATION,
            DepartureState.OPEN_FOR_BOOKING,
            DepartureState.FEASIBILITY_REVIEW,
            DepartureState.CANCELLED,
        }
    ),
    DepartureState.WAITLIST_OPEN: frozenset(
        {DepartureState.CONDITIONAL_RESERVATION, DepartureState.OPEN_FOR_BOOKING}
    ),
    DepartureState.CONDITIONAL_RESERVATION: frozenset(
        {DepartureState.OPEN_FOR_BOOKING, DepartureState.MINIMUM_GROUP_PENDING}
    ),
    DepartureState.OPEN_FOR_BOOKING: frozenset(
        {DepartureState.MINIMUM_GROUP_PENDING, DepartureState.CONFIRMED}
    ),
    DepartureState.MINIMUM_GROUP_PENDING: frozenset(
        {DepartureState.CONFIRMED, DepartureState.OPEN_FOR_BOOKING}
    ),
    DepartureState.CONFIRMED: frozenset({DepartureState.PREPARATION}),
    DepartureState.PREPARATION: frozenset({DepartureState.READY_TO_DEPART}),
    DepartureState.READY_TO_DEPART: frozenset({DepartureState.IN_PROGRESS}),
    DepartureState.IN_PROGRESS: frozenset({DepartureState.COMPLETED}),
    DepartureState.COMPLETED: frozenset(),
    # A suspension resolves either by resuming or by ending the departure.
    DepartureState.SUSPENDED: frozenset(
        {
            DepartureState.WAITLIST_OPEN,
            DepartureState.CONDITIONAL_RESERVATION,
            DepartureState.OPEN_FOR_BOOKING,
            DepartureState.MINIMUM_GROUP_PENDING,
            DepartureState.CONFIRMED,
            DepartureState.RESCHEDULED,
            DepartureState.CANCELLED,
        }
    ),
    # A reschedule is accepted onto a new date, or the traveller declines and it ends.
    DepartureState.RESCHEDULED: frozenset(
        {DepartureState.OPEN_FOR_BOOKING, DepartureState.CONFIRMED, DepartureState.CANCELLED}
    ),
    DepartureState.CANCELLED: frozenset(),
}


def allowed_transitions(state: DepartureState) -> frozenset[DepartureState]:
    """Every state reachable from ``state`` in one authorised step."""
    forward = _FORWARD[state]
    if state in _INTERRUPTIBLE:
        return forward | _INTERRUPTIONS
    return forward


class IllegalTransition(ValueError):
    """Raised when a caller attempts a transition the lifecycle does not permit."""


@dataclass(frozen=True, slots=True)
class StateChange:
    """An auditable transition.

    Doc 06: "Changing a public departure state should require an authorised role and
    record a reason." Doc 09: "High-stakes state changes and waivers are attributable."
    Both `actor` and `reason` are mandatory — there is no convenience overload.
    """

    departure_id: str
    previous: DepartureState
    current: DepartureState
    actor: str
    reason: str


def transition(
    *,
    departure_id: str,
    current: DepartureState,
    target: DepartureState,
    actor: str,
    reason: str,
) -> StateChange:
    """Validate and describe a state change. Raises :class:`IllegalTransition`."""
    if not actor.strip():
        raise IllegalTransition("A state change requires an accountable actor.")
    if not reason.strip():
        raise IllegalTransition("A state change requires a recorded reason.")
    if target not in allowed_transitions(current):
        raise IllegalTransition(
            f"Departure {departure_id} cannot move from {current} to {target}. "
            f"Permitted: {sorted(allowed_transitions(current))}"
        )
    return StateChange(
        departure_id=departure_id,
        previous=current,
        current=target,
        actor=actor,
        reason=reason,
    )


class PaymentAction(StrEnum):
    """What kind of money movement a state permits.

    Doc 04 requires the system to know, before inviting payment, "whether the action
    is a protected reservation, waitlist payment, deposit or confirmed booking".
    """

    NONE = "none"
    PROTECTED_RESERVATION = "protected_reservation"
    DEPOSIT = "deposit"
    BALANCE = "balance"


_PAYMENT_BY_STATE: dict[DepartureState, PaymentAction] = {
    DepartureState.DRAFT: PaymentAction.NONE,
    DepartureState.FEASIBILITY_REVIEW: PaymentAction.NONE,
    DepartureState.PROPOSED: PaymentAction.NONE,
    # Waitlist collects priority, not a seat (doc 03). Whether a *waitlist payment*
    # is ever taken is decision O3; until it is approved this stays NONE.
    DepartureState.WAITLIST_OPEN: PaymentAction.NONE,
    DepartureState.CONDITIONAL_RESERVATION: PaymentAction.PROTECTED_RESERVATION,
    DepartureState.OPEN_FOR_BOOKING: PaymentAction.DEPOSIT,
    DepartureState.MINIMUM_GROUP_PENDING: PaymentAction.PROTECTED_RESERVATION,
    DepartureState.CONFIRMED: PaymentAction.BALANCE,
    DepartureState.PREPARATION: PaymentAction.BALANCE,
    DepartureState.READY_TO_DEPART: PaymentAction.BALANCE,
    DepartureState.IN_PROGRESS: PaymentAction.NONE,
    DepartureState.COMPLETED: PaymentAction.NONE,
    DepartureState.SUSPENDED: PaymentAction.NONE,
    DepartureState.RESCHEDULED: PaymentAction.NONE,
    DepartureState.CANCELLED: PaymentAction.NONE,
}


def permitted_payment_action(
    state: DepartureState, *, payments_enabled: bool
) -> PaymentAction:
    """The payment action this departure state permits.

    ``payments_enabled`` is the global gate: until decisions O2 (operator), O3
    (deposit rules) and O4 (refund policy) are approved, the platform takes no money
    at all regardless of departure state. Callers pass the configured value rather
    than this module reading config, so the gate stays visible at the call site.
    """
    if not payments_enabled:
        return PaymentAction.NONE
    return _PAYMENT_BY_STATE[state]


def is_publicly_listable(state: DepartureState) -> bool:
    """Whether a departure may appear in public listings at all.

    Doc 03: "Do not display unlaunched journeys as purchasable." Draft and
    feasibility departures are internal; proposed may support register-interest.
    """
    return state not in {DepartureState.DRAFT, DepartureState.FEASIBILITY_REVIEW}
