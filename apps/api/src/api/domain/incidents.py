"""The incident record.

Doc 09's Phase 3 exit condition: operations must "preserve a record of what customers
were told". An incident is the case where that matters most, because it is the one
somebody will ask about afterwards, sometimes formally.

**The constraint that shapes every field here** is one of the standing constraints in
`docs/DECISIONS.md`:

    "No medical clearance, diagnosis or fitness certification, by human or AI."

So an incident records **what was observed and what was done**. It never records a
diagnosis, and the field is called `observed` rather than `condition` so that a
coordinator typing at 3,500 metres is not invited to write one. "Complained of
headache and nausea, unsteady on his feet, descended to Gunji" is a record. "Had
AMS" is a clinical judgement nobody on this team is qualified to make, and it is the
sentence a lawyer would read back.

Severity drives escalation, not access. Everyone with operations access can see every
incident: hiding a serious one from the people running the trip is the failure mode
this is meant to prevent.
"""

from __future__ import annotations

import enum
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta


class IncidentSeverity(enum.StrEnum):
    """How bad it was, judged by what happened rather than by what might have.

    ``NEAR_MISS`` is first-class and deliberately not called "minor". A vehicle that
    slid and stopped is the most valuable row in this table, because it is the one
    that tells you where the next real one will happen.
    """

    NEAR_MISS = "near_miss"
    MINOR = "minor"
    SIGNIFICANT = "significant"
    SERIOUS = "serious"
    CRITICAL = "critical"


class IncidentCategory(enum.StrEnum):
    HEALTH_ALTITUDE = "health_altitude"
    ROAD_VEHICLE = "road_vehicle"
    WEATHER_ROUTE = "weather_route"
    ACCOMMODATION = "accommodation"
    PERMIT_CHECKPOST = "permit_checkpost"
    CONDUCT = "conduct"
    SUPPLIER_FAILURE = "supplier_failure"
    OTHER = "other"


#: Severities a founder has to see, not merely be able to find. Doc 06 wants
#: incidents to have explicit ownership; this decides whose problem it is by default.
ESCALATES_TO_FOUNDER = frozenset(
    {IncidentSeverity.SERIOUS, IncidentSeverity.CRITICAL}
)

#: How long an open incident may sit before it is chased, by severity. A critical
#: incident that nobody has updated in two hours is itself a second failure.
_REVIEW_WINDOW: dict[IncidentSeverity, timedelta] = {
    IncidentSeverity.CRITICAL: timedelta(hours=2),
    IncidentSeverity.SERIOUS: timedelta(hours=12),
    IncidentSeverity.SIGNIFICANT: timedelta(days=2),
    IncidentSeverity.MINOR: timedelta(days=7),
    IncidentSeverity.NEAR_MISS: timedelta(days=14),
}


def review_window(severity: IncidentSeverity) -> timedelta:
    return _REVIEW_WINDOW[severity]


def requires_founder_attention(severity: IncidentSeverity) -> bool:
    return severity in ESCALATES_TO_FOUNDER


@dataclass(frozen=True, slots=True)
class IncidentStatus:
    """Whether an open incident is being handled or has gone quiet."""

    severity: IncidentSeverity
    occurred_at: datetime
    resolved_at: datetime | None = None
    last_updated_at: datetime | None = None
    travellers_informed: bool = False

    def is_open(self) -> bool:
        return self.resolved_at is None

    def is_overdue(self, *, now: datetime | None = None) -> bool:
        """Open past its review window, measured from the last time anyone touched it."""
        if not self.is_open():
            return False
        moment = now or datetime.now(UTC)
        since = self.last_updated_at or self.occurred_at
        return moment - since > review_window(self.severity)

    def obligations(self, *, now: datetime | None = None) -> list[str]:
        """What still has to happen, in plain words.

        `travellers_informed` is separate from resolution on purpose. An incident can
        be operationally over and still owe somebody an explanation, and that gap is
        precisely what doc 09 means by preserving a record of what customers were
        told.
        """
        items: list[str] = []
        if self.is_open():
            if requires_founder_attention(self.severity):
                items.append("A founder must review this personally.")
            if self.is_overdue(now=now):
                window = review_window(self.severity)
                hours = int(window.total_seconds() // 3600)
                items.append(
                    f"Open with no update for longer than the {hours}-hour review "
                    "window for this severity."
                )
        if not self.travellers_informed:
            items.append(
                "The affected travellers have not been told anything through their "
                "booking page."
            )
        return items
