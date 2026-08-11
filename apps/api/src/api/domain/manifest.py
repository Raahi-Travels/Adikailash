"""Departure readiness: is this group actually able to leave.

Doc 09's Phase 3 exit condition: "Operations can identify and resolve every critical
blocker before departure and preserve a record of what customers were told."

Two ideas, kept apart on purpose.

**A blocker stops the departure.** Somebody without a permit cannot pass the
checkpost, so the group either fixes it or that person does not travel. Blockers are
counted and named, and `can_depart` is false while any remain.

**A warning does not.** A missing dietary note is worth chasing and is not a reason
to hold a convoy at Dharchula. Conflating the two is how a readiness screen becomes
noise that nobody reads, which is worse than not having one.

The distinction is also why this is not simply "sum the reservation readiness".
Reservation readiness answers "is this family sorted"; departure readiness answers
"can this vehicle leave", and the second is not the conjunction of the first: an
unpaid balance blocks a reservation being confirmed, but a confirmed traveller with
an outstanding balance is a finance problem, not a reason to cancel a convoy.

Pure. No ORM, no session, so the rules are testable without a database.
"""

from __future__ import annotations

from dataclasses import dataclass, field


@dataclass(frozen=True, slots=True)
class PartyReadiness:
    """One reservation's contribution to the departure, already resolved."""

    reference: str
    group_lead: str | None
    travellers_named: int
    travellers_expected: int
    documents_outstanding: int
    #: Permit-bearing documents specifically. These are the ones that stop a person
    #: at the checkpost; a missing insurance copy does not.
    permit_documents_outstanding: int
    policy_accepted: bool
    is_confirmed: bool
    balance_outstanding: bool = False


@dataclass(frozen=True, slots=True)
class DepartureReadiness:
    """Whether a departure can leave, and precisely what is stopping it."""

    #: Somebody with the right registration is responsible for the inner-line segment.
    operator_assigned: bool = False
    #: The route status for this journey is not currently suppressing travel.
    route_clear: bool = True
    #: Why the route is not clear, when it is not.
    route_note: str | None = None
    parties: tuple[PartyReadiness, ...] = ()
    #: Holds still occupying capacity that nobody has converted or released.
    unresolved_holds: int = 0

    @property
    def travellers_expected(self) -> int:
        return sum(p.travellers_expected for p in self.parties if p.is_confirmed)

    @property
    def travellers_named(self) -> int:
        return sum(p.travellers_named for p in self.parties if p.is_confirmed)

    @property
    def blockers(self) -> list[str]:
        """What must be fixed before this departure can leave.

        Only confirmed parties are considered. A held reservation that never
        converted is not a blocker on departure; it is a blocker on capacity, and it
        is reported separately as a warning so it does not stop a running trip.
        """
        items: list[str] = []

        if not self.operator_assigned:
            items.append(
                "No operator is assigned, so nobody is registered to run this departure."
            )
        if not self.route_clear:
            items.append(
                self.route_note
                or "The route status does not currently permit travel on this segment."
            )

        confirmed = [p for p in self.parties if p.is_confirmed]
        if not confirmed:
            items.append("No confirmed reservations. There is nobody to take.")

        for party in confirmed:
            missing = party.travellers_expected - party.travellers_named
            if missing > 0:
                items.append(
                    f"{party.reference}: {missing} traveller"
                    f"{'s' if missing != 1 else ''} still unnamed. "
                    "Permits are issued against names."
                )
            if party.permit_documents_outstanding:
                n = party.permit_documents_outstanding
                items.append(
                    f"{party.reference}: {n} permit document{'s' if n != 1 else ''} "
                    "not accepted. This stops a person at the checkpost."
                )
            if not party.policy_accepted:
                items.append(f"{party.reference}: terms not accepted.")

        return items

    @property
    def warnings(self) -> list[str]:
        """Worth chasing, never a reason to hold a convoy."""
        items: list[str] = []

        if self.unresolved_holds:
            n = self.unresolved_holds
            items.append(
                f"{n} hold{'s' if n != 1 else ''} still occupying capacity, "
                "neither confirmed nor released."
            )

        for party in self.parties:
            if not party.is_confirmed:
                continue
            non_permit = party.documents_outstanding - party.permit_documents_outstanding
            if non_permit > 0:
                items.append(
                    f"{party.reference}: {non_permit} other document"
                    f"{'s' if non_permit != 1 else ''} outstanding."
                )
            if party.balance_outstanding:
                items.append(
                    f"{party.reference}: balance outstanding. A finance matter, not a "
                    "reason to stop the departure."
                )

        return items

    @property
    def can_depart(self) -> bool:
        return not self.blockers
