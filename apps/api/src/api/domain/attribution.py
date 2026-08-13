"""Which sources produce contribution, not which produce bookings (doc 07).

Doc 07's measurement section ends with the sentence this module exists to obey:

    "Do not report return on ad spend using gross booking value alone when supplier
    costs, refunds and conditional reservations materially affect the business."

All three of those things materially affect this business. A ₹1,85,000 booking on a
departure whose vehicles, permits and beds cost ₹1,40,000 contributes ₹45,000, and a
source that brings ten of those is worth less than a source bringing four at a better
tier. Reporting gross would say the opposite.

So nothing here reports revenue by source. It reports **contribution**: revenue, less
the supplier cost apportioned to those travellers, less refunds actually paid out.

Three honesty rules, each of which changes a number somebody would otherwise quote:

1. **A held reservation is not revenue.** Doc 05 is explicit that a hold is
   "refundable, and explicitly not a booking". It goes in a separate at-risk bucket
   and never into contribution, because a source whose leads all sit on holds that
   lapse looks excellent right up until the season ends.

2. **Refunds are subtracted, never netted into revenue.** Consistent with the
   append-only ledgers on both sides of the business: the gross and the reversal are
   both facts, and hiding one inside the other is how a refund-heavy channel passes
   for a good one.

3. **Supplier cost is apportioned per traveller, and that is an estimate.** Doc 07
   itself asks for a "contribution *estimate*". Vehicles, permits and beds are bought
   per departure and consumed per head, so per-head is the right apportionment — but
   it is still an apportionment, and `is_estimated` says so rather than letting a
   derived figure be read as a measured one.

Attribution itself is first-touch, which is a choice with a known bias — it flatters
whatever people find first, usually organic search, and undercredits the guide that
convinced them three visits later. `ATTRIBUTION_MODEL` names it so nobody reads these
numbers as though the question were settled.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from decimal import Decimal

from api.domain.reservations import ReservationState

#: Named so the report can print it. Single-touch attribution is a simplification,
#: and the honest thing is to say which simplification rather than to imply the
#: number is the truth.
ATTRIBUTION_MODEL = "first-touch"

#: States whose money is real enough to count toward contribution. `TRAVELLED` is
#: included, obviously; `CONFIRMED` onward is included because doc 05 makes confirmed
#: the state that means "you are going" and every gate has passed.
EARNING_STATES = frozenset(
    {
        ReservationState.CONFIRMED,
        ReservationState.PREPARING,
        ReservationState.READY,
        ReservationState.TRAVELLED,
    }
)

#: Money that might yet arrive, and might not. Reported separately and never summed
#: into contribution.
CONDITIONAL_STATES = frozenset(
    {ReservationState.PROPOSED, ReservationState.HELD}
)

#: Below this many earning reservations, a per-lead contribution figure is noise.
#: Four is not a statistical threshold; it is the point at which one unusual party
#: stops dominating the average, which is the practical failure here.
MIN_SAMPLE_FOR_CONFIDENCE = 4


def apportioned_cost(
    departure_committed_cost: Decimal,
    departure_party_total: int,
    party_size: int,
) -> Decimal:
    """This reservation's share of its departure's supplier cost.

    Per traveller, because that is how the cost is actually incurred: a seat in the
    vehicle, an inner-line permit, a bed. Apportioning by revenue share instead would
    make a discounted party look cheaper to serve, which is exactly backwards.

    Returns zero when the departure carries nobody — a departure with committed cost
    and no travellers is a real and serious situation, but it is a departure-level
    problem and attributing it to whichever source happens to be on file would
    invent a number.
    """
    if departure_party_total <= 0 or party_size <= 0:
        return Decimal("0")
    per_head = departure_committed_cost / Decimal(departure_party_total)
    return (per_head * Decimal(party_size)).quantize(Decimal("0.01"))


@dataclass(frozen=True, slots=True)
class ReservationContribution:
    """One reservation, reduced to what it actually contributed."""

    reservation_id: int
    reference: str
    state: ReservationState
    party_size: int
    source: str | None
    campaign: str | None
    landing_page: str | None

    agreed_amount: Decimal = Decimal("0")
    received: Decimal = Decimal("0")
    refunded: Decimal = Decimal("0")
    apportioned_supplier_cost: Decimal = Decimal("0")

    @property
    def is_earning(self) -> bool:
        return self.state in EARNING_STATES

    @property
    def is_conditional(self) -> bool:
        return self.state in CONDITIONAL_STATES

    @property
    def net_received(self) -> Decimal:
        """Cash in, less cash returned. Never below zero at the row level.

        A refund larger than what arrived means somebody recorded the ledger wrong,
        and clamping keeps one bad row from silently subtracting from every other
        source in the roll-up. The row is still visible in the ledger itself, which
        is where that error should be found and fixed.
        """
        return max(self.received - self.refunded, Decimal("0"))

    @property
    def contribution(self) -> Decimal:
        """Agreed revenue less apportioned supplier cost less refunds.

        Built from *agreed* rather than received, matching `DepartureEconomics.margin`
        — the question is whether this booking was worth having, and money still in
        transit does not change that. Cash position is `net_received`.
        """
        if not self.is_earning:
            return Decimal("0")
        return self.agreed_amount - self.apportioned_supplier_cost - self.refunded


@dataclass(slots=True)
class SourcePerformance:
    """Everything one acquisition source produced.

    A source here is a first-touch string: "organic", "instagram", a campaign name.
    Unattributed leads are grouped under `UNATTRIBUTED` rather than dropped, because
    a report that quietly omits a third of the business is worse than one that admits
    it does not know.
    """

    source: str
    leads: int = 0
    reservations: int = 0
    #: Reservations in an earning state. The denominator for anything per-booking.
    earning_reservations: int = 0
    conditional_reservations: int = 0
    travellers: int = 0

    gross_agreed: Decimal = Decimal("0")
    received: Decimal = Decimal("0")
    refunded: Decimal = Decimal("0")
    supplier_cost: Decimal = Decimal("0")
    #: Agreed value sitting in proposed or held reservations. Money that may never
    #: arrive, reported next to contribution and never inside it.
    conditional_value: Decimal = Decimal("0")

    #: Recorded acquisition spend for this source over the same period. None when
    #: nothing was recorded — which is not the same as zero, see `cost_per_lead`.
    spend: Decimal | None = None

    def add(self, row: ReservationContribution) -> None:
        self.reservations += 1
        if row.is_earning:
            self.earning_reservations += 1
            self.travellers += row.party_size
            self.gross_agreed += row.agreed_amount
            self.supplier_cost += row.apportioned_supplier_cost
            self.refunded += row.refunded
            self.received += row.net_received
        elif row.is_conditional:
            self.conditional_reservations += 1
            self.conditional_value += row.agreed_amount

    @property
    def contribution(self) -> Decimal:
        return self.gross_agreed - self.supplier_cost - self.refunded

    @property
    def contribution_margin_percent(self) -> Decimal | None:
        """None when nothing was sold, rather than a divide by zero."""
        if self.gross_agreed <= 0:
            return None
        return ((self.contribution / self.gross_agreed) * 100).quantize(Decimal("0.1"))

    @property
    def lead_to_reservation_percent(self) -> Decimal | None:
        if self.leads <= 0:
            return None
        return (
            (Decimal(self.earning_reservations) / Decimal(self.leads)) * 100
        ).quantize(Decimal("0.1"))

    @property
    def contribution_per_lead(self) -> Decimal | None:
        if self.leads <= 0:
            return None
        return (self.contribution / Decimal(self.leads)).quantize(Decimal("0.01"))

    @property
    def cost_per_qualified_lead(self) -> Decimal | None:
        """None when no spend was recorded — deliberately not zero.

        Zero would read as "free", and a channel with no recorded spend is one we
        have not measured, not one that costs nothing. The distinction matters
        because these two render identically in a table unless the type forces the
        difference.
        """
        if self.spend is None or self.leads <= 0:
            return None
        return (self.spend / Decimal(self.leads)).quantize(Decimal("0.01"))

    @property
    def acquisition_share_of_contribution(self) -> Decimal | None:
        """Spend as a percentage of what the source contributed.

        Doc 07 asks for exactly this rather than ROAS, and the difference is the
        point: a channel can look profitable against gross booking value and be
        losing money once the vehicles and beds are paid for.
        """
        if self.spend is None or self.contribution <= 0:
            return None
        return ((self.spend / self.contribution) * 100).quantize(Decimal("0.1"))

    @property
    def is_low_confidence(self) -> bool:
        return self.earning_reservations < MIN_SAMPLE_FOR_CONFIDENCE

    @property
    def caveats(self) -> list[str]:
        """What a reader must know before quoting any of the above.

        Returned as text rather than left to the UI, so the warning travels with the
        number into an export, a screenshot or a WhatsApp message to an investor.
        """
        notes: list[str] = []
        if self.is_low_confidence:
            notes.append(
                f"Only {self.earning_reservations} confirmed booking(s) — too few for"
                " the per-lead figures to mean anything yet."
            )
        if self.conditional_reservations:
            notes.append(
                f"{self.conditional_reservations} reservation(s) worth"
                f" {self.conditional_value} are still proposed or held and are NOT"
                " counted in contribution."
            )
        if self.spend is None:
            notes.append("No acquisition spend recorded, so cost per lead is unknown.")
        if self.supplier_cost == 0 and self.earning_reservations:
            notes.append(
                "No supplier cost apportioned, so contribution here is gross revenue."
                " Either the departures have no committed supplier bookings yet, or"
                " they were never recorded."
            )
        return notes


#: Where leads with no recorded first touch go. Named rather than silently dropped:
#: if this bucket is the largest one, the attribution itself is what needs fixing,
#: and that fact should be the first thing the report makes obvious.
UNATTRIBUTED = "(unattributed)"


@dataclass(slots=True)
class ContributionReport:
    """The whole report, with its own limitations attached."""

    sources: list[SourcePerformance] = field(default_factory=list)
    attribution_model: str = ATTRIBUTION_MODEL

    @property
    def total_contribution(self) -> Decimal:
        return sum((s.contribution for s in self.sources), Decimal("0"))

    @property
    def total_conditional_value(self) -> Decimal:
        return sum((s.conditional_value for s in self.sources), Decimal("0"))

    @property
    def _unattributed(self) -> SourcePerformance | None:
        return next((s for s in self.sources if s.source == UNATTRIBUTED), None)

    @property
    def unattributed_lead_share_percent(self) -> Decimal | None:
        """Share of *leads* that arrived with no recorded source."""
        total_leads = sum(s.leads for s in self.sources)
        if total_leads <= 0:
            return None
        unknown = self._unattributed.leads if self._unattributed else 0
        return ((Decimal(unknown) / Decimal(total_leads)) * 100).quantize(Decimal("0.1"))

    @property
    def unattributed_contribution_share_percent(self) -> Decimal | None:
        """Share of *contribution* we cannot explain — the number that matters.

        Measuring this on leads alone is actively misleading, and the first real run
        of this report proved it: a walk-in booking taken over the phone has no lead
        row at all, so it contributed the best margin of any source while the
        lead-based figure cheerfully reported nought percent unattributed.

        Money is the thing being attributed, so money is what the share is taken
        over. The lead-based figure is kept alongside because the two diverging is
        itself the signal — a small share of leads carrying a large share of
        contribution means the good business is arriving through a door nobody is
        measuring.
        """
        total = sum((s.contribution for s in self.sources), Decimal("0"))
        if total <= 0:
            return None
        unknown = self._unattributed.contribution if self._unattributed else Decimal("0")
        return ((unknown / total) * 100).quantize(Decimal("0.1"))

    def ranked(self) -> list[SourcePerformance]:
        """Best contribution first, low-confidence sources last regardless.

        A source with one lucky booking would otherwise top the table, and the first
        row of a report is what gets acted on.
        """
        return sorted(
            self.sources,
            key=lambda s: (s.is_low_confidence, -s.contribution),
        )
