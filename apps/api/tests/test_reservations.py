"""Reservation invariants.

As with `test_domain.py`, these are not coverage exercises. Each one corresponds to a
line in the handoff pack that says a customer must never be told something untrue.

The one that matters most is `test_money_alone_cannot_confirm`. If that ever goes
green with a weaker assertion, the product has started telling families their
pilgrimage is booked because their payment cleared.
"""

from __future__ import annotations

from decimal import Decimal

import pytest

from api.domain.reservations import (
    ConfirmationGates,
    format_inr,
    Readiness,
    ReservationState,
    TransitionRefused,
    allowed_transitions,
    can_confirm,
    can_transition,
    confirmation_blockers,
    transition,
)


def _all_gates_passing(**overrides) -> ConfirmationGates:
    base = dict(
        departure_confirmed=True,
        operator_assigned=True,
        minimum_group_met=True,
        policy_accepted=True,
        party_complete=True,
        coordinator_assigned=True,
        amount_due=Decimal("50000"),
        amount_received=Decimal("50000"),
    )
    base.update(overrides)
    return ConfirmationGates(**base)


# ------------------------------------------------------------------- the hard rule


def test_money_alone_cannot_confirm():
    """Docs 00/06/09: "Never present a departure as confirmed because a payment
    succeeded — confirmation requires operator, permit and minimum-group conditions
    to be met."

    A fully paid reservation with nothing else in place must be refused, and must
    say why.
    """
    paid_and_nothing_else = ConfirmationGates(
        amount_due=Decimal("50000"), amount_received=Decimal("50000")
    )

    assert not can_confirm(paid_and_nothing_else)

    blockers = confirmation_blockers(paid_and_nothing_else)
    assert "The departure itself is not confirmed yet." in blockers
    assert any("operator" in b for b in blockers)
    assert any("minimum group" in b for b in blockers)
    # And the money must NOT appear as a blocker, because it is settled.
    assert not any("received and recorded" in b for b in blockers)


def test_confirm_transition_refuses_and_lists_every_blocker():
    """A coordinator chasing one blocker at a time is how departures slip, so the
    refusal names all of them at once.

    An amount is set deliberately: with nothing agreed the balance is already
    settled, so a bare `ConfirmationGates()` fails six gates rather than seven.
    """
    nothing_in_place = ConfirmationGates(
        amount_due=Decimal("50000"), amount_received=Decimal("0")
    )
    with pytest.raises(TransitionRefused) as caught:
        transition(
            current=ReservationState.HELD,
            target=ReservationState.CONFIRMED,
            actor="Ops",
            reason="Group is ready",
            gates=nothing_in_place,
        )
    assert len(caught.value.reasons) == 7


def test_all_gates_passing_allows_confirmation():
    assert can_confirm(_all_gates_passing())
    change = transition(
        current=ReservationState.HELD,
        target=ReservationState.CONFIRMED,
        actor="Ops",
        reason="Every gate passed",
        gates=_all_gates_passing(),
    )
    assert change.new_state is ReservationState.CONFIRMED


@pytest.mark.parametrize(
    "gate",
    [
        "departure_confirmed",
        "operator_assigned",
        "minimum_group_met",
        "policy_accepted",
        "party_complete",
        "coordinator_assigned",
    ],
)
def test_every_gate_is_individually_blocking(gate: str):
    """No gate is decorative. Removing any single one must refuse confirmation."""
    assert not can_confirm(_all_gates_passing(**{gate: False}))


def test_underpayment_blocks_confirmation():
    gates = _all_gates_passing(amount_received=Decimal("49999.99"))
    assert not can_confirm(gates)
    assert any("received and recorded" in b for b in confirmation_blockers(gates))


def test_overpayment_does_not_block():
    """Someone rounding up a UPI transfer should not stall their own confirmation."""
    assert can_confirm(_all_gates_passing(amount_received=Decimal("50001")))


def test_zero_cost_reservation_is_settled():
    """A hosted or comped place has nothing due, which is settled, not unpaid."""
    gates = _all_gates_passing(
        amount_due=Decimal("0"), amount_received=Decimal("0")
    )
    assert gates.balance_settled
    assert can_confirm(gates)


# ------------------------------------------------------------------- the lifecycle


def test_cannot_skip_from_draft_to_confirmed():
    """Confirmation is reachable only from a held reservation. A draft has not even
    been offered to anyone."""
    assert not can_transition(ReservationState.DRAFT, ReservationState.CONFIRMED)


def test_cancellation_is_always_reachable_until_travelled():
    """The moment cancelling honestly becomes hard, the incentive to keep someone in
    a trip they should leave starts to win."""
    for state in (
        ReservationState.DRAFT,
        ReservationState.PROPOSED,
        ReservationState.HELD,
        ReservationState.CONFIRMED,
        ReservationState.PREPARING,
        ReservationState.READY,
    ):
        assert can_transition(state, ReservationState.CANCELLED_BY_US), state
        assert can_transition(state, ReservationState.CANCELLED_BY_TRAVELLER), state


def test_terminal_states_are_terminal():
    for state in (
        ReservationState.TRAVELLED,
        ReservationState.CANCELLED_BY_US,
        ReservationState.CANCELLED_BY_TRAVELLER,
        ReservationState.LAPSED,
    ):
        assert allowed_transitions(state) == frozenset(), state


def test_transition_requires_actor_and_reason():
    """Doc 09: high-stakes state changes are attributable."""
    with pytest.raises(TransitionRefused):
        transition(
            current=ReservationState.DRAFT,
            target=ReservationState.HELD,
            actor="   ",
            reason="Holding places",
        )
    with pytest.raises(TransitionRefused):
        transition(
            current=ReservationState.DRAFT,
            target=ReservationState.HELD,
            actor="Ops",
            reason="",
        )


def test_illegal_transition_names_what_is_allowed():
    with pytest.raises(TransitionRefused) as caught:
        transition(
            current=ReservationState.TRAVELLED,
            target=ReservationState.HELD,
            actor="Ops",
            reason="Mistake",
        )
    assert "final" in caught.value.reasons[0]


# --------------------------------------------------------------------- readiness


def test_readiness_lists_everything_outstanding_in_chase_order():
    readiness = Readiness(
        documents_outstanding=3,
        travellers_named=2,
        travellers_expected=4,
        policy_accepted=False,
        coordinator=None,
        amount_due=Decimal("50000"),
        amount_received=Decimal("20000"),
    )
    outstanding = readiness.outstanding

    assert not readiness.is_ready
    assert outstanding[0] == "No coordinator assigned"
    assert "2 travellers still to be named" in outstanding
    assert "3 documents outstanding" in outstanding
    assert "Terms not accepted" in outstanding
    assert readiness.balance_outstanding == Decimal("30000")


def test_readiness_is_ready_when_nothing_outstanding():
    readiness = Readiness(
        documents_outstanding=0,
        travellers_named=2,
        travellers_expected=2,
        policy_accepted=True,
        coordinator="Harshit",
        amount_due=Decimal("50000"),
        amount_received=Decimal("50000"),
    )
    assert readiness.is_ready
    assert readiness.outstanding == []


def test_readiness_singular_plural():
    """Small thing, but "1 documents outstanding" on a customer-adjacent screen is
    the kind of detail that quietly costs trust."""
    one = Readiness(
        documents_outstanding=1,
        travellers_named=2,
        travellers_expected=3,
        policy_accepted=True,
        coordinator="Ops",
    )
    assert "1 document outstanding" in one.outstanding
    assert "1 traveller still to be named" in one.outstanding


@pytest.mark.parametrize(
    ("amount", "expected"),
    [
        ("0", "₹0"),
        ("999", "₹999"),
        ("1000", "₹1,000"),
        ("150000", "₹1,50,000"),
        ("1500000", "₹15,00,000"),
        ("12345678", "₹1,23,45,678"),
    ],
)
def test_indian_digit_grouping(amount: str, expected: str):
    """Lakh grouping, not thousands. The web app formats with en-IN, so Python's
    default `:,` would print the same number two different ways on one screen."""
    assert format_inr(Decimal(amount)) == expected


def test_readiness_balance_uses_indian_grouping():
    readiness = Readiness(
        travellers_named=2,
        travellers_expected=2,
        policy_accepted=True,
        coordinator="Ops",
        amount_due=Decimal("150000"),
        amount_received=Decimal("0"),
    )
    assert "₹1,50,000 still to be received" in readiness.outstanding


def test_party_size_of_zero_is_not_complete():
    """An unset party size must not read as a complete party."""
    readiness = Readiness(travellers_named=0, travellers_expected=0)
    assert not readiness.party_complete
    assert "Party size not set" in readiness.outstanding
