"""Tests for the invariants the pack treats as severity-one.

These are not coverage exercises. Each one corresponds to a specific line in the
handoff documents that says a customer must never see a particular thing.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

import pytest

from api.domain.departures import (
    DepartureState,
    IllegalTransition,
    PaymentAction,
    is_publicly_listable,
    permitted_payment_action,
    transition,
)
from api.domain.status import (
    Access,
    Freshness,
    PublicationStage,
    SourceType,
    StatusUpdate,
    blocks_sale,
    outranks,
)

NOW = datetime(2026, 10, 1, 9, 0, tzinfo=UTC)


def _status(
    *,
    access: Access = Access.OPEN,
    stage: PublicationStage = PublicationStage.PUBLISHED,
    verified_at: datetime = NOW,
    due_in: timedelta = timedelta(hours=12),
    source: SourceType = SourceType.FIELD_COORDINATOR,
) -> StatusUpdate:
    return StatusUpdate(
        segment_id="dharchula-gunji",
        access=access,
        stage=stage,
        source=source,
        verified_by="ops.coordinator",
        verified_at=verified_at,
        next_verification_due=verified_at + due_in,
        summary="Road open to Gunji; single-lane sections near Malpa.",
    )


# --- Departures ------------------------------------------------------------------
# Doc 08: "Public departure state must be compatible with payment action."


def test_suspended_departure_cannot_take_money() -> None:
    assert (
        permitted_payment_action(DepartureState.SUSPENDED, payments_enabled=True)
        is PaymentAction.NONE
    )


def test_waitlist_does_not_claim_a_seat() -> None:
    """Doc 03: waitlist collects priority "without claiming a seat"."""
    assert (
        permitted_payment_action(DepartureState.WAITLIST_OPEN, payments_enabled=True)
        is PaymentAction.NONE
    )


@pytest.mark.parametrize("state", list(DepartureState))
def test_no_state_takes_money_while_payments_are_gated(state: DepartureState) -> None:
    """Until O2-O4 are approved the platform takes nothing, whatever the state."""
    assert permitted_payment_action(state, payments_enabled=False) is PaymentAction.NONE


def test_draft_departures_are_not_publicly_listable() -> None:
    assert not is_publicly_listable(DepartureState.DRAFT)
    assert not is_publicly_listable(DepartureState.FEASIBILITY_REVIEW)
    assert is_publicly_listable(DepartureState.WAITLIST_OPEN)


def test_payment_alone_cannot_confirm_a_departure() -> None:
    """Doc 08: "No single payment webhook should automatically confirm the entire
    departure." A departure cannot jump from open straight past minimum-group and
    operator checks without an authorised actor performing the transition."""
    with pytest.raises(IllegalTransition):
        transition(
            departure_id="d-1",
            current=DepartureState.PROPOSED,
            target=DepartureState.CONFIRMED,
            actor="payment-webhook",
            reason="payment received",
        )


def test_state_change_requires_actor_and_reason() -> None:
    for actor, reason in (("", "route reopened"), ("ops.lead", "  ")):
        with pytest.raises(IllegalTransition):
            transition(
                departure_id="d-1",
                current=DepartureState.OPEN_FOR_BOOKING,
                target=DepartureState.SUSPENDED,
                actor=actor,
                reason=reason,
            )


def test_suspension_is_reachable_from_a_confirmed_departure() -> None:
    change = transition(
        departure_id="d-1",
        current=DepartureState.CONFIRMED,
        target=DepartureState.SUSPENDED,
        actor="ops.lead",
        reason="Permit issuance paused pending district notice.",
    )
    assert change.previous is DepartureState.CONFIRMED
    assert change.current is DepartureState.SUSPENDED


def test_completed_departure_is_terminal() -> None:
    with pytest.raises(IllegalTransition):
        transition(
            departure_id="d-1",
            current=DepartureState.COMPLETED,
            target=DepartureState.OPEN_FOR_BOOKING,
            actor="ops.lead",
            reason="reopen",
        )


# --- Status ----------------------------------------------------------------------
# Doc 08 acceptance #6: stale status must become *visibly* stale.


def test_fresh_status_reads_as_verified() -> None:
    assert _status().freshness(now=NOW + timedelta(hours=1)) is Freshness.VERIFIED


def test_overdue_status_becomes_due_then_stale() -> None:
    s = _status(due_in=timedelta(hours=12))
    assert s.freshness(now=NOW + timedelta(hours=13)) is Freshness.DUE_FOR_CHECK
    assert s.freshness(now=NOW + timedelta(hours=40)) is Freshness.STALE


def test_stale_status_is_labelled_as_not_recently_verified() -> None:
    label = _status().public_label(now=NOW + timedelta(days=5))
    assert "not recently verified" in label
    # The label must carry meaning on its own — colour is not enough (doc 02).
    assert label != ""


def test_stale_open_route_still_blocks_sale() -> None:
    """An 'open' reading from five days ago is not a green light."""
    s = _status(access=Access.OPEN)
    assert not blocks_sale(s, now=NOW + timedelta(hours=1))
    assert blocks_sale(s, now=NOW + timedelta(days=5))


def test_suspended_route_blocks_sale_even_when_freshly_verified() -> None:
    assert blocks_sale(_status(access=Access.SUSPENDED), now=NOW + timedelta(hours=1))


def test_unpublished_status_is_never_publicly_trustworthy() -> None:
    s = _status(stage=PublicationStage.UNVERIFIED_NOTE)
    assert not s.is_publicly_trustworthy(now=NOW)
    assert s.public_label(now=NOW) == "Not verified"


def test_published_status_requires_a_named_verifier() -> None:
    with pytest.raises(ValueError):
        StatusUpdate(
            segment_id="s",
            access=Access.OPEN,
            stage=PublicationStage.PUBLISHED,
            source=SourceType.FIELD_COORDINATOR,
            verified_by="",
            verified_at=NOW,
            next_verification_due=NOW + timedelta(hours=6),
            summary="Open.",
        )


def test_official_notice_outranks_field_intelligence() -> None:
    assert outranks(SourceType.OFFICIAL_NOTICE, SourceType.SUPPLIER_OBSERVATION)
    assert not outranks(SourceType.SUPPLIER_OBSERVATION, SourceType.OFFICIAL_NOTICE)
