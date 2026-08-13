"""Contribution by source, and the three things doc 07 forbids leaving out.

Doc 07: "Do not report return on ad spend using gross booking value alone when
supplier costs, refunds and conditional reservations materially affect the business."

`test_a_high_revenue_source_can_lose_to_a_lower_revenue_one` is the test that
justifies the whole module. If it flips, the report starts ranking by gross and the
founders pour a season's effort into the channel that books the most and earns the
least.
"""

from __future__ import annotations

from decimal import Decimal

import pytest

from api.domain.attribution import (
    MIN_SAMPLE_FOR_CONFIDENCE,
    UNATTRIBUTED,
    ContributionReport,
    ReservationContribution,
    SourcePerformance,
    apportioned_cost,
)
from api.domain.reservations import ReservationState


def reservation(
    state: ReservationState = ReservationState.CONFIRMED,
    *,
    agreed: str = "185000",
    cost: str = "0",
    received: str = "0",
    refunded: str = "0",
    party: int = 2,
    source: str = "organic",
) -> ReservationContribution:
    return ReservationContribution(
        reservation_id=1,
        reference="AK-2027-0001",
        state=state,
        party_size=party,
        source=source,
        campaign=None,
        landing_page=None,
        agreed_amount=Decimal(agreed),
        received=Decimal(received),
        refunded=Decimal(refunded),
        apportioned_supplier_cost=Decimal(cost),
    )


# --------------------------------------------------------------- apportionment


def test_supplier_cost_is_apportioned_per_traveller():
    """Vehicles, permits and beds are bought per departure and consumed per head."""
    assert apportioned_cost(Decimal("300000"), 10, 2) == Decimal("60000.00")


def test_apportionment_by_head_not_by_revenue_share():
    """Apportioning by revenue would make a discounted party look cheaper to serve,
    which is exactly backwards — they occupy the same seat and the same bed."""
    cheap = apportioned_cost(Decimal("300000"), 10, 2)
    expensive = apportioned_cost(Decimal("300000"), 10, 2)
    assert cheap == expensive


def test_a_departure_with_nobody_on_it_apportions_nothing():
    """Committed cost and no travellers is a real and serious situation, but it is a
    departure-level problem. Attributing it to whichever source happens to be on file
    would invent a number."""
    assert apportioned_cost(Decimal("300000"), 0, 2) == Decimal("0")


def test_a_zero_party_apportions_nothing():
    assert apportioned_cost(Decimal("300000"), 10, 0) == Decimal("0")


# ----------------------------------------------------------------- the rules


def test_a_held_reservation_contributes_nothing():
    """Doc 05: a hold is "refundable, and explicitly not a booking". A source whose
    leads all sit on holds that lapse looks excellent until the season ends."""
    row = reservation(ReservationState.HELD)
    assert row.is_conditional
    assert not row.is_earning
    assert row.contribution == Decimal("0")


def test_a_proposed_reservation_contributes_nothing():
    assert reservation(ReservationState.PROPOSED).contribution == Decimal("0")


@pytest.mark.parametrize(
    "state",
    [
        ReservationState.CANCELLED_BY_TRAVELLER,
        ReservationState.CANCELLED_BY_US,
        ReservationState.DRAFT,
    ],
)
def test_cancelled_and_draft_are_neither_earning_nor_conditional(state):
    row = reservation(state)
    assert not row.is_earning
    assert not row.is_conditional


def test_contribution_subtracts_supplier_cost():
    row = reservation(agreed="185000", cost="140000")
    assert row.contribution == Decimal("45000")


def test_refunds_are_subtracted_not_netted_into_revenue():
    """Both the gross and the reversal are facts. Hiding one inside the other is how
    a refund-heavy channel passes for a good one."""
    source = SourcePerformance(source="instagram")
    source.add(reservation(agreed="185000", cost="140000", received="185000", refunded="30000"))
    assert source.gross_agreed == Decimal("185000")
    assert source.refunded == Decimal("30000")
    assert source.contribution == Decimal("15000")


def test_a_refund_larger_than_the_receipt_does_not_go_negative_at_row_level():
    """A ledger entered wrong should not silently subtract from every other source in
    the roll-up. The bad row stays visible in the ledger, which is where it is fixed."""
    row = reservation(received="10000", refunded="50000")
    assert row.net_received == Decimal("0")


# --------------------------------------------------------------- the headline


def test_a_high_revenue_source_can_lose_to_a_lower_revenue_one():
    """The reason this module exists.

    Ten thin bookings against four good ones: gross says the first source is 2.3x
    better, contribution says it is worse. Ranking on gross would send a season's
    effort at the wrong channel.
    """
    volume = SourcePerformance(source="discount-listing")
    for _ in range(10):
        volume.add(reservation(agreed="100000", cost="92000"))

    quality = SourcePerformance(source="guides")
    for _ in range(4):
        quality.add(reservation(agreed="240000", cost="140000"))

    assert volume.gross_agreed > quality.gross_agreed  # 10L vs 9.6L
    assert volume.contribution < quality.contribution  # 80k vs 4L

    report = ContributionReport(sources=[volume, quality])
    assert report.ranked()[0].source == "guides"


def test_conditional_value_is_reported_beside_contribution_never_inside_it():
    source = SourcePerformance(source="organic")
    source.add(reservation(ReservationState.CONFIRMED, agreed="185000", cost="140000"))
    source.add(reservation(ReservationState.HELD, agreed="500000"))
    assert source.contribution == Decimal("45000")
    assert source.conditional_value == Decimal("500000")
    assert source.conditional_reservations == 1


# ------------------------------------------------------- absent, not zero


def test_cost_per_lead_is_unknown_rather_than_zero_when_no_spend_is_recorded():
    """Zero reads as "free". A channel with no recorded spend is one we have not
    measured, and the two render identically in a table unless the type forbids it."""
    source = SourcePerformance(source="organic", leads=50)
    assert source.spend is None
    assert source.cost_per_qualified_lead is None


def test_cost_per_lead_is_computed_once_spend_exists():
    source = SourcePerformance(source="instagram", leads=50, spend=Decimal("25000"))
    assert source.cost_per_qualified_lead == Decimal("500.00")


def test_acquisition_share_of_contribution_rather_than_roas():
    """Doc 07 asks for this rather than return on ad spend, and the difference is the
    point: a channel can look profitable against gross and be losing money once the
    vehicles and beds are paid for."""
    source = SourcePerformance(source="instagram", leads=50, spend=Decimal("25000"))
    source.add(reservation(agreed="185000", cost="135000"))
    assert source.contribution == Decimal("50000")
    assert source.acquisition_share_of_contribution == Decimal("50.0")


def test_margin_percent_is_none_rather_than_a_divide_by_zero():
    assert SourcePerformance(source="x").contribution_margin_percent is None


def test_conversion_is_none_with_no_leads():
    assert SourcePerformance(source="x").lead_to_reservation_percent is None


# ------------------------------------------------------------- honest framing


def test_a_source_with_too_few_bookings_is_flagged_and_ranked_last():
    """One lucky booking would otherwise top the table, and the first row of a report
    is the one that gets acted on."""
    lucky = SourcePerformance(source="one-off")
    lucky.add(reservation(agreed="900000", cost="100000"))

    steady = SourcePerformance(source="organic")
    for _ in range(MIN_SAMPLE_FOR_CONFIDENCE):
        steady.add(reservation(agreed="185000", cost="140000"))

    assert lucky.contribution > steady.contribution
    assert lucky.is_low_confidence
    assert not steady.is_low_confidence
    assert ContributionReport(sources=[lucky, steady]).ranked()[0].source == "organic"


def test_caveats_travel_with_the_numbers_as_text():
    """Returned as text rather than left to the UI, so the warning survives being
    screenshotted or pasted into a message to somebody who was not in the room."""
    source = SourcePerformance(source="instagram", leads=10)
    source.add(reservation(ReservationState.HELD, agreed="500000"))
    joined = " ".join(source.caveats)
    assert "too few" in joined
    assert "NOT" in joined and "contribution" in joined
    assert "No acquisition spend recorded" in joined


def test_missing_supplier_cost_is_called_out_rather_than_flattering_the_source():
    """Contribution with no cost deducted is just revenue. Saying so stops the number
    being quoted as a margin."""
    source = SourcePerformance(source="organic")
    source.add(reservation(agreed="185000", cost="0"))
    assert any("gross revenue" in c for c in source.caveats)


def test_unattributed_lead_share_is_computed_across_the_whole_report():
    known = SourcePerformance(source="organic", leads=60)
    unknown = SourcePerformance(source=UNATTRIBUTED, leads=40)
    assert ContributionReport(
        sources=[known, unknown]
    ).unattributed_lead_share_percent == Decimal("40.0")


def test_a_walk_in_shows_as_unattributed_contribution_despite_having_no_lead():
    """The bug the first real run of this report exposed.

    A booking taken over the phone has no lead row, so the lead-based share reported
    nought percent unattributed while that booking was quietly the best-margin
    business in the table. Money is what is being attributed, so money is what the
    share has to be taken over."""
    known = SourcePerformance(source="organic", leads=10)
    known.add(reservation(agreed="100000", cost="50000"))

    walk_in = SourcePerformance(source=UNATTRIBUTED, leads=0)
    walk_in.add(reservation(agreed="100000", cost="50000"))

    report = ContributionReport(sources=[known, walk_in])
    assert report.unattributed_lead_share_percent == Decimal("0.0")
    assert report.unattributed_contribution_share_percent == Decimal("50.0")


def test_unattributed_shares_are_none_rather_than_zero_with_nothing_to_divide():
    empty = ContributionReport(sources=[])
    assert empty.unattributed_lead_share_percent is None
    assert empty.unattributed_contribution_share_percent is None
