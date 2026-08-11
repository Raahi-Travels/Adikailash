"""Departure readiness invariants.

The distinction under test is the one that decides whether the readiness screen is
useful or noise: a blocker stops the departure, a warning does not. Get it wrong in
either direction and the screen fails. Too strict and a convoy is held at Dharchula
over an insurance copy; too loose and somebody reaches a checkpost without a permit.
"""

from __future__ import annotations

import pytest

from api.domain.manifest import DepartureReadiness, PartyReadiness


def party(**overrides) -> PartyReadiness:
    base = dict(
        reference="AK-2027-0001",
        group_lead="Meera Joshi",
        travellers_named=3,
        travellers_expected=3,
        documents_outstanding=0,
        permit_documents_outstanding=0,
        policy_accepted=True,
        is_confirmed=True,
        balance_outstanding=False,
    )
    base.update(overrides)
    return PartyReadiness(**base)


def ready(**overrides) -> DepartureReadiness:
    base = dict(operator_assigned=True, route_clear=True, parties=(party(),))
    base.update(overrides)
    return DepartureReadiness(**base)


# ------------------------------------------------------------------ what blocks


def test_a_fully_prepared_departure_can_leave():
    assert ready().can_depart
    assert ready().blockers == []


def test_no_operator_blocks():
    readiness = ready(operator_assigned=False)
    assert not readiness.can_depart
    assert any("registered to run" in b for b in readiness.blockers)


def test_closed_route_blocks_and_carries_the_reason():
    readiness = ready(route_clear=False, route_note="Segment is closed after a landslide.")
    assert not readiness.can_depart
    assert "Segment is closed after a landslide." in readiness.blockers


def test_unnamed_traveller_blocks():
    """Permits are issued against names. An unnamed person cannot pass a checkpost."""
    readiness = ready(parties=(party(travellers_named=2, travellers_expected=4),))
    assert not readiness.can_depart
    assert any("2 travellers still unnamed" in b for b in readiness.blockers)


def test_outstanding_permit_document_blocks():
    readiness = ready(
        parties=(party(documents_outstanding=2, permit_documents_outstanding=2),)
    )
    assert not readiness.can_depart
    assert any("permit documents" in b for b in readiness.blockers)


def test_unaccepted_terms_block():
    readiness = ready(parties=(party(policy_accepted=False),))
    assert not readiness.can_depart


def test_a_departure_with_nobody_confirmed_blocks():
    """An empty convoy is not ready, it is pointless. Worth saying out loud rather
    than reporting no blockers and letting somebody drive to Dharchula."""
    readiness = ready(parties=(party(is_confirmed=False),))
    assert not readiness.can_depart
    assert "No confirmed reservations. There is nobody to take." in readiness.blockers


# ---------------------------------------------------------------- what does not


def test_non_permit_documents_warn_but_do_not_block():
    """Travel insurance is strongly recommended and is not checked at the barrier."""
    readiness = ready(
        parties=(party(documents_outstanding=2, permit_documents_outstanding=0),)
    )
    assert readiness.can_depart
    assert any("2 other documents outstanding" in w for w in readiness.warnings)


def test_outstanding_balance_warns_but_does_not_block():
    """A confirmed traveller who still owes money is a finance matter. Refusing to
    run the convoy over it punishes the other families in the vehicle."""
    readiness = ready(parties=(party(balance_outstanding=True),))
    assert readiness.can_depart
    assert any("finance matter" in w for w in readiness.warnings)


def test_unresolved_holds_warn_but_do_not_block():
    readiness = ready(unresolved_holds=2)
    assert readiness.can_depart
    assert any("2 holds still occupying capacity" in w for w in readiness.warnings)


def test_unconfirmed_parties_are_ignored_for_blocking():
    """A hold that never converted must not stop the people who did confirm."""
    readiness = ready(
        parties=(
            party(),
            party(
                reference="AK-2027-0002",
                is_confirmed=False,
                travellers_named=0,
                travellers_expected=4,
                permit_documents_outstanding=9,
                policy_accepted=False,
            ),
        )
    )
    assert readiness.can_depart
    assert not any("AK-2027-0002" in b for b in readiness.blockers)


# ------------------------------------------------------------------- counting


def test_counts_only_confirmed_travellers():
    readiness = ready(
        parties=(
            party(travellers_named=3, travellers_expected=3),
            party(reference="AK-2027-0002", travellers_named=2, travellers_expected=2,
                  is_confirmed=False),
        )
    )
    assert readiness.travellers_named == 3
    assert readiness.travellers_expected == 3


def test_every_blocker_is_reported_not_just_the_first():
    readiness = ready(
        operator_assigned=False,
        route_clear=False,
        parties=(party(travellers_named=1, travellers_expected=3, policy_accepted=False),),
    )
    assert len(readiness.blockers) >= 3


@pytest.mark.parametrize("count,expected", [(1, "1 traveller still unnamed"),
                                            (2, "2 travellers still unnamed")])
def test_blocker_singular_plural(count: int, expected: str):
    readiness = ready(
        parties=(party(travellers_named=3 - count, travellers_expected=3),)
    )
    assert any(expected in b for b in readiness.blockers)
