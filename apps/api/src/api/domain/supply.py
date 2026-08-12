"""Suppliers, what we owe them, and where people sleep.

Phase 3 of doc 09. Three decisions from 11 August 2026 shape this module.

**D14, hire per departure.** The company books a vehicle, a driver, a guide or a
household from a local operator for each trip rather than running a fleet. So the
unit here is a *booking of a supplier for a departure*, not a resource with a
calendar. An owned vehicle, if one is ever bought, is recorded as a supplier the
company happens to control, which is why nothing needs rewriting if that changes.

**D15, a payables ledger.** What is owed to each supplier is the sum of an
append-only ledger, exactly as customer receipts are. No balance column anywhere, on
either side of the business, so neither can drift from its evidence. That symmetry is
also what makes per-departure margin real rather than a spreadsheet guess.

**D16, rooming per traveller per night.** Precise enough to answer a family asking
where their parents will sleep, which doc 01 treats as the centre of this business,
and no more precise than a shared room in somebody's house can actually be.

Pure. No ORM, no session.
"""

from __future__ import annotations

import enum
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import date
from decimal import Decimal


class SupplierKind(enum.StrEnum):
    """What a supplier provides. Drives nothing structural, only grouping and tone."""

    TRANSPORT = "transport"
    GUIDE = "guide"
    PORTER = "porter"
    STAY = "stay"
    PERMIT_AGENT = "permit_agent"
    OTHER = "other"


class BookingState(enum.StrEnum):
    """A supplier engagement.

    Deliberately shorter than the departure and reservation lifecycles. A vehicle is
    either asked for, promised, or not happening, and inventing more stages would be
    modelling a process nobody runs.
    """

    #: We have asked. They have not said yes.
    ENQUIRED = "enquired"
    #: They have committed. This is what readiness counts.
    CONFIRMED = "confirmed"
    #: Delivered. Payment may still be outstanding.
    DELIVERED = "delivered"
    CANCELLED = "cancelled"


#: States where the supplier is actually expected to turn up.
COMMITTED_STATES = frozenset({BookingState.CONFIRMED, BookingState.DELIVERED})


@dataclass(frozen=True, slots=True)
class BookingCost:
    """One supplier engagement's money, resolved from the ledger."""

    reference: str
    supplier_name: str
    kind: SupplierKind
    state: BookingState
    agreed_cost: Decimal = Decimal("0")
    paid: Decimal = Decimal("0")

    @property
    def outstanding(self) -> Decimal:
        return max(Decimal("0"), self.agreed_cost - self.paid)

    @property
    def is_overpaid(self) -> bool:
        """Worth surfacing rather than clamping. Paying a supplier more than agreed is
        either a variation nobody recorded or a mistake, and both need a human."""
        return self.paid > self.agreed_cost


@dataclass(frozen=True, slots=True)
class DepartureEconomics:
    """What a departure costs, what it earned, and what that leaves.

    Doc 09's Phase 4 exit condition asks for growth "without losing unit-economics
    visibility". This is the smallest honest version of that: committed supplier cost
    against confirmed customer revenue, per departure.

    Cancelled supplier bookings are excluded from cost; cancelled reservations are
    excluded from revenue by the caller. Neither is netted against the other.
    """

    bookings: tuple[BookingCost, ...] = ()
    #: Agreed with confirmed parties, whether or not it has arrived yet.
    customer_revenue_agreed: Decimal = Decimal("0")
    #: What the customer ledger says actually arrived.
    customer_revenue_received: Decimal = Decimal("0")

    @property
    def committed_cost(self) -> Decimal:
        return sum(
            (b.agreed_cost for b in self.bookings if b.state in COMMITTED_STATES),
            Decimal("0"),
        )

    @property
    def paid_to_suppliers(self) -> Decimal:
        return sum(
            (b.paid for b in self.bookings if b.state is not BookingState.CANCELLED),
            Decimal("0"),
        )

    @property
    def owed_to_suppliers(self) -> Decimal:
        return sum(
            (b.outstanding for b in self.bookings if b.state in COMMITTED_STATES),
            Decimal("0"),
        )

    @property
    def margin(self) -> Decimal:
        """Agreed revenue less committed cost.

        Deliberately computed from *agreed* revenue rather than received: the
        question a coordinator is asking is whether this departure makes sense to
        run, and money still in transit does not change that. Cash position is the
        separate `customer_revenue_received` figure.
        """
        return self.customer_revenue_agreed - self.committed_cost

    @property
    def margin_percent(self) -> Decimal | None:
        """None when nothing has been sold, rather than a divide by zero or a
        misleading -100%. Rounded, because Decimal division otherwise yields 28
        significant figures and a margin is not known to that precision."""
        if self.customer_revenue_agreed <= 0:
            return None
        ratio = (self.margin / self.customer_revenue_agreed) * 100
        return ratio.quantize(Decimal("0.1"))

    @property
    def is_loss_making(self) -> bool:
        return self.customer_revenue_agreed > 0 and self.margin < 0


# ------------------------------------------------------------------------ rooming


@dataclass(frozen=True, slots=True)
class Bed:
    """One traveller, one night, one household."""

    traveller_id: int
    traveller_name: str
    stay_id: int
    stay_name: str
    night: date
    #: What the household can actually take. None where nobody has recorded it, which
    #: is itself worth reporting rather than assuming infinite space.
    stay_capacity: int | None = None


@dataclass(frozen=True, slots=True)
class RoomingPlan:
    beds: tuple[Bed, ...] = ()
    #: Travellers who are expected on the departure. Used to find who has no bed.
    expected: tuple[tuple[int, str], ...] = ()
    nights: tuple[date, ...] = ()

    @property
    def over_capacity(self) -> list[str]:
        """Households given more people than they can take.

        This is the failure that strands a family at 3,500 metres at nine at night,
        so it is a blocker rather than a note.
        """
        counts: dict[tuple[int, date], list[Bed]] = defaultdict(list)
        for bed in self.beds:
            counts[(bed.stay_id, bed.night)].append(bed)

        problems: list[str] = []
        for (_, night), assigned in sorted(counts.items(), key=lambda i: i[0][1]):
            capacity = assigned[0].stay_capacity
            if capacity is not None and len(assigned) > capacity:
                problems.append(
                    f"{assigned[0].stay_name} on {night.isoformat()}: "
                    f"{len(assigned)} people assigned, {capacity} can be taken."
                )
        return problems

    @property
    def unknown_capacity(self) -> list[str]:
        """Households with no recorded occupancy. Not a blocker, but somebody has to
        ask before the vehicles leave."""
        seen: dict[int, str] = {}
        for bed in self.beds:
            if bed.stay_capacity is None:
                seen[bed.stay_id] = bed.stay_name
        return [f"{name}: occupancy not recorded." for name in sorted(seen.values())]

    @property
    def unassigned(self) -> list[str]:
        """Traveller and night pairs with nowhere to sleep."""
        placed = {(b.traveller_id, b.night) for b in self.beds}
        gaps: dict[str, list[date]] = defaultdict(list)
        for traveller_id, name in self.expected:
            for night in self.nights:
                if (traveller_id, night) not in placed:
                    gaps[name].append(night)

        return [
            f"{name}: no bed on "
            + ", ".join(n.isoformat() for n in sorted(nights))
            for name, nights in sorted(gaps.items())
        ]

    @property
    def is_complete(self) -> bool:
        return not self.unassigned and not self.over_capacity
