"""Supplier economics, rooming and incident invariants (Phase 3).

Two rules carry most of the weight here.

`test_over_capacity_is_detected` is the one that matters operationally: putting more
people in a household than it can take is what strands a family at 3,500 metres at
nine at night, and it is the failure a rooming screen exists to prevent.

`test_margin_uses_agreed_revenue_not_received` guards a subtler mistake. Margin
computed from cash received makes a departure look loss-making purely because a
transfer has not cleared, and somebody cancels a trip that was always profitable.
"""

from __future__ import annotations

from datetime import UTC, date, datetime, timedelta
from decimal import Decimal

import pytest

from api.domain.incidents import (
    IncidentSeverity,
    IncidentStatus,
    requires_founder_attention,
    review_window,
)
from api.domain.supply import (
    Bed,
    BookingCost,
    BookingState,
    DepartureEconomics,
    RoomingPlan,
    SupplierKind,
)


def cost(**overrides) -> BookingCost:
    base = dict(
        reference="1",
        supplier_name="Negi Travels",
        kind=SupplierKind.TRANSPORT,
        state=BookingState.CONFIRMED,
        agreed_cost=Decimal("40000"),
        paid=Decimal("0"),
    )
    base.update(overrides)
    return BookingCost(**base)


# ------------------------------------------------------------------- economics


def test_margin_uses_agreed_revenue_not_received():
    """Cash in transit must not make a profitable departure look loss-making.

    The question a coordinator is asking is whether this trip is worth running, and
    a transfer that has not cleared does not change the answer.
    """
    economics = DepartureEconomics(
        bookings=(cost(agreed_cost=Decimal("40000")),),
        customer_revenue_agreed=Decimal("100000"),
        customer_revenue_received=Decimal("0"),
    )
    assert economics.margin == Decimal("60000")
    assert not economics.is_loss_making
    assert economics.margin_percent == Decimal("60.0")


def test_cancelled_supplier_bookings_are_not_a_cost():
    economics = DepartureEconomics(
        bookings=(
            cost(agreed_cost=Decimal("40000")),
            cost(reference="2", state=BookingState.CANCELLED, agreed_cost=Decimal("99999")),
        ),
        customer_revenue_agreed=Decimal("100000"),
    )
    assert economics.committed_cost == Decimal("40000")


def test_enquired_supplier_is_not_yet_a_commitment():
    """Asking a driver for a price is not a cost. Only a confirmed booking is."""
    economics = DepartureEconomics(
        bookings=(cost(state=BookingState.ENQUIRED, agreed_cost=Decimal("40000")),),
        customer_revenue_agreed=Decimal("100000"),
    )
    assert economics.committed_cost == Decimal("0")
    assert economics.owed_to_suppliers == Decimal("0")


def test_loss_making_departure_is_flagged():
    economics = DepartureEconomics(
        bookings=(cost(agreed_cost=Decimal("120000")),),
        customer_revenue_agreed=Decimal("100000"),
    )
    assert economics.is_loss_making
    assert economics.margin == Decimal("-20000")


def test_margin_percent_is_rounded():
    """Decimal division yields 28 significant figures. A margin is not known to
    that precision and printing it that way looks broken."""
    economics = DepartureEconomics(
        bookings=(cost(agreed_cost=Decimal("40000")),),
        customer_revenue_agreed=Decimal("150000"),
    )
    assert economics.margin_percent == Decimal("73.3")


def test_margin_percent_is_none_with_no_revenue():
    """A departure with nothing sold has no margin, rather than a divide by zero or
    a misleading -100%."""
    economics = DepartureEconomics(bookings=(cost(),))
    assert economics.margin_percent is None
    assert not economics.is_loss_making


def test_owed_to_suppliers_counts_only_committed_and_unpaid():
    economics = DepartureEconomics(
        bookings=(
            cost(agreed_cost=Decimal("40000"), paid=Decimal("15000")),
            cost(reference="2", agreed_cost=Decimal("20000"), paid=Decimal("20000")),
        ),
        customer_revenue_agreed=Decimal("100000"),
    )
    assert economics.owed_to_suppliers == Decimal("25000")
    assert economics.paid_to_suppliers == Decimal("35000")


def test_overpaying_a_supplier_is_surfaced_not_clamped():
    """Either a variation nobody recorded or a mistake. Both need a human."""
    booking = cost(agreed_cost=Decimal("40000"), paid=Decimal("45000"))
    assert booking.is_overpaid
    assert booking.outstanding == Decimal("0")


# --------------------------------------------------------------------- rooming


NIGHTS = (date(2027, 5, 20), date(2027, 5, 21))


def bed(traveller_id: int, name: str, night: date, capacity: int | None = 4) -> Bed:
    return Bed(
        traveller_id=traveller_id,
        traveller_name=name,
        stay_id=1,
        stay_name="Negi household, Gunji",
        night=night,
        stay_capacity=capacity,
    )


def test_over_capacity_is_detected():
    """The failure that strands a family at altitude at night."""
    plan = RoomingPlan(
        beds=tuple(bed(i, f"Traveller {i}", NIGHTS[0], capacity=2) for i in range(1, 4)),
        expected=tuple((i, f"Traveller {i}") for i in range(1, 4)),
        nights=(NIGHTS[0],),
    )
    assert plan.over_capacity
    assert "3 people assigned, 2 can be taken" in plan.over_capacity[0]
    assert not plan.is_complete


def test_within_capacity_is_clean():
    plan = RoomingPlan(
        beds=tuple(bed(i, f"Traveller {i}", NIGHTS[0], capacity=4) for i in range(1, 4)),
        expected=tuple((i, f"Traveller {i}") for i in range(1, 4)),
        nights=(NIGHTS[0],),
    )
    assert plan.over_capacity == []
    assert plan.is_complete


def test_unassigned_travellers_are_named_with_their_nights():
    plan = RoomingPlan(
        beds=(bed(1, "Meera Joshi", NIGHTS[0]),),
        expected=((1, "Meera Joshi"), (2, "Ramesh Joshi")),
        nights=NIGHTS,
    )
    gaps = plan.unassigned
    assert any("Ramesh Joshi" in g and "2027-05-20" in g and "2027-05-21" in g for g in gaps)
    # Meera still has no bed on the second night.
    assert any("Meera Joshi" in g and "2027-05-21" in g for g in gaps)
    assert not plan.is_complete


def test_unknown_capacity_warns_without_blocking():
    """Nobody recorded what the household can take. Worth asking, not a blocker."""
    plan = RoomingPlan(
        beds=(bed(1, "Meera Joshi", NIGHTS[0], capacity=None),),
        expected=((1, "Meera Joshi"),),
        nights=(NIGHTS[0],),
    )
    assert plan.unknown_capacity
    assert plan.over_capacity == []
    assert plan.is_complete


def test_capacity_is_counted_per_night_not_in_total():
    """The same house takes the same family two nights running. That is one bed each
    night, not two people in one bed."""
    plan = RoomingPlan(
        beds=(bed(1, "Meera", NIGHTS[0], capacity=1), bed(1, "Meera", NIGHTS[1], capacity=1)),
        expected=((1, "Meera"),),
        nights=NIGHTS,
    )
    assert plan.over_capacity == []
    assert plan.is_complete


# ------------------------------------------------------------------- incidents


def test_serious_and_critical_reach_a_founder():
    assert requires_founder_attention(IncidentSeverity.SERIOUS)
    assert requires_founder_attention(IncidentSeverity.CRITICAL)
    assert not requires_founder_attention(IncidentSeverity.MINOR)
    assert not requires_founder_attention(IncidentSeverity.NEAR_MISS)


def test_review_windows_tighten_with_severity():
    windows = [review_window(s) for s in IncidentSeverity]
    # NEAR_MISS ... CRITICAL, so the list is descending in duration.
    assert windows == sorted(windows, reverse=True)
    assert review_window(IncidentSeverity.CRITICAL) == timedelta(hours=2)


def test_open_critical_incident_goes_overdue_quickly():
    now = datetime(2027, 5, 21, 12, 0, tzinfo=UTC)
    status = IncidentStatus(
        severity=IncidentSeverity.CRITICAL,
        occurred_at=now - timedelta(hours=3),
    )
    assert status.is_open()
    assert status.is_overdue(now=now)
    assert any("review window" in o for o in status.obligations(now=now))
    assert any("founder" in o for o in status.obligations(now=now))


def test_a_recent_update_resets_the_review_clock():
    """Somebody is on it. Chasing them again is noise."""
    now = datetime(2027, 5, 21, 12, 0, tzinfo=UTC)
    status = IncidentStatus(
        severity=IncidentSeverity.CRITICAL,
        occurred_at=now - timedelta(hours=8),
        last_updated_at=now - timedelta(minutes=20),
    )
    assert not status.is_overdue(now=now)


def test_resolved_incident_is_never_overdue():
    now = datetime(2027, 5, 21, 12, 0, tzinfo=UTC)
    status = IncidentStatus(
        severity=IncidentSeverity.CRITICAL,
        occurred_at=now - timedelta(days=30),
        resolved_at=now - timedelta(days=29),
        travellers_informed=True,
    )
    assert not status.is_open()
    assert not status.is_overdue(now=now)
    assert status.obligations(now=now) == []


def test_resolved_incident_still_owes_an_explanation():
    """Operationally over and still owing somebody an explanation. Exactly what doc
    09 means by preserving a record of what customers were told."""
    now = datetime(2027, 5, 21, 12, 0, tzinfo=UTC)
    status = IncidentStatus(
        severity=IncidentSeverity.MINOR,
        occurred_at=now - timedelta(days=2),
        resolved_at=now - timedelta(days=1),
        travellers_informed=False,
    )
    assert not status.is_open()
    assert any("have not been told" in o for o in status.obligations(now=now))


@pytest.mark.parametrize("severity", list(IncidentSeverity))
def test_every_severity_has_a_review_window(severity: IncidentSeverity):
    assert review_window(severity) > timedelta(0)
