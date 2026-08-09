"""Route and permit status.

The signature trust asset. Docs 03, 06 and 07 all converge on the same point: what
makes this platform citable is not prettier copy, it is a status page that says who
verified something, when, from what kind of source, and admits when it has gone cold.

Doc 08's non-functional acceptance #6: "A stale route status becomes visibly stale
rather than remaining silently 'live'." Staleness here is **derived at read time**
from ``next_verification_due`` rather than written by a background job — a cron that
fails must not be able to leave a stale status looking fresh.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime
from enum import StrEnum


class SourceType(StrEnum):
    """Doc 06's source hierarchy, most authoritative first.

    "The interface must distinguish official information from field intelligence."
    Order matters: :func:`outranks` uses it to decide whether new information should
    replace what is published.
    """

    OFFICIAL_NOTICE = "official_notice"
    DISTRICT_OR_TOURISM = "district_or_tourism"
    OPERATING_PARTNER = "operating_partner"
    FIELD_COORDINATOR = "field_coordinator"
    SUPPLIER_OBSERVATION = "supplier_observation"


_SOURCE_RANK: dict[SourceType, int] = {
    SourceType.OFFICIAL_NOTICE: 0,
    SourceType.DISTRICT_OR_TOURISM: 1,
    SourceType.OPERATING_PARTNER: 2,
    SourceType.FIELD_COORDINATOR: 3,
    SourceType.SUPPLIER_OBSERVATION: 4,
}


def outranks(candidate: SourceType, published: SourceType) -> bool:
    """Whether ``candidate`` is at least as authoritative as ``published``."""
    return _SOURCE_RANK[candidate] <= _SOURCE_RANK[published]


class Access(StrEnum):
    """What the status actually says about getting through.

    Deliberately not a boolean. Doc 01: "The system must represent uncertainty
    honestly rather than forcing binary promises."
    """

    OPEN = "open"
    LIMITED = "limited"
    PERMIT_PENDING = "permit_pending"
    SUSPENDED = "suspended"
    CLOSED = "closed"
    NOT_IN_SEASON = "not_in_season"
    UNVERIFIED = "unverified"


class Freshness(StrEnum):
    """Derived, never stored."""

    VERIFIED = "verified"
    DUE_FOR_CHECK = "due_for_check"
    STALE = "stale"


class PublicationStage(StrEnum):
    """Doc 06's status workflow. Only ``PUBLISHED`` is customer-visible."""

    FIELD_INPUT = "field_input"
    UNVERIFIED_NOTE = "unverified_note"
    REVIEWED = "reviewed"
    PUBLISHED = "published"
    SUPERSEDED = "superseded"


#: How long past ``next_verification_due`` a status may run before it stops being
#: merely due for a check and becomes untrustworthy. Operations can tune this; it is
#: not a business policy requiring founder approval.
_STALE_GRACE_HOURS = 24


def derive_freshness(
    next_verification_due: datetime, *, now: datetime | None = None
) -> Freshness:
    """Freshness from the re-check deadline alone.

    Module-level so the ORM model and the domain dataclass share one implementation.
    Two copies of this rule would eventually disagree, and the disagreement would be
    invisible until a stale status rendered as current.
    """
    moment = now or datetime.now(UTC)
    if moment <= next_verification_due:
        return Freshness.VERIFIED
    overdue_hours = (moment - next_verification_due).total_seconds() / 3600
    if overdue_hours <= _STALE_GRACE_HOURS:
        return Freshness.DUE_FOR_CHECK
    return Freshness.STALE


def label_for(access: Access, stage: PublicationStage, freshness: Freshness) -> str:
    """Badge text. Always carries meaning on its own — colour is never enough."""
    if stage is not PublicationStage.PUBLISHED:
        return "Not verified"
    match freshness:
        case Freshness.VERIFIED:
            return _ACCESS_LABELS[access]
        case Freshness.DUE_FOR_CHECK:
            return f"{_ACCESS_LABELS[access]}, re-check due"
        case _:
            return f"Last known {_ACCESS_LABELS[access].lower()}, not recently verified"


def suppresses_sale(
    access: Access, stage: PublicationStage, freshness: Freshness
) -> bool:
    """Whether this reading should stop payment on affected departures."""
    if access in BLOCKING_ACCESS:
        return True
    return stage is not PublicationStage.PUBLISHED or freshness is Freshness.STALE


@dataclass(frozen=True, slots=True)
class StatusUpdate:
    """A verified statement about a route segment at a point in time.

    A published status cannot exist without ``verified_by`` and ``verified_at`` —
    doc 08's data-quality rule: "A verified status requires source type, author and
    timestamp."
    """

    segment_id: str
    access: Access
    stage: PublicationStage
    source: SourceType
    verified_by: str
    verified_at: datetime
    next_verification_due: datetime
    #: What changed, in the customer-facing order from doc 02's disruption pattern.
    summary: str

    def __post_init__(self) -> None:
        if self.stage is PublicationStage.PUBLISHED:
            if not self.verified_by.strip():
                raise ValueError("A published status requires a named verifier.")
            if not self.summary.strip():
                raise ValueError("A published status requires a summary.")
        if self.next_verification_due <= self.verified_at:
            raise ValueError("next_verification_due must be after verified_at.")

    def freshness(self, *, now: datetime | None = None) -> Freshness:
        """Derived freshness. See module docstring for why this is not stored."""
        return derive_freshness(self.next_verification_due, now=now)

    def is_publicly_trustworthy(self, *, now: datetime | None = None) -> bool:
        """Whether this may still be presented as current information.

        A stale status is not hidden — doc 03 wants the update history visible — but
        it must not be rendered as a current answer.
        """
        return (
            self.stage is PublicationStage.PUBLISHED
            and self.freshness(now=now) is not Freshness.STALE
        )

    def public_label(self, *, now: datetime | None = None) -> str:
        """Text label for a status badge.

        Doc 02: status "must remain readable and never rely on colour alone", so the
        badge always carries this string, not just a colour token.
        """
        return label_for(self.access, self.stage, self.freshness(now=now))


_ACCESS_LABELS: dict[Access, str] = {
    Access.OPEN: "Open",
    Access.LIMITED: "Limited access",
    Access.PERMIT_PENDING: "Permit pending",
    Access.SUSPENDED: "Suspended",
    Access.CLOSED: "Closed",
    Access.NOT_IN_SEASON: "Not in season",
    Access.UNVERIFIED: "Unverified",
}


#: Access states that should stop a departure being sold, whatever its own state says.
#: Doc 07 acceptance #4: "The paid-media team cannot advertise a suspended departure
#: as open without an operational status conflict becoming visible."
BLOCKING_ACCESS = frozenset({Access.SUSPENDED, Access.CLOSED, Access.NOT_IN_SEASON})


def blocks_sale(status: StatusUpdate, *, now: datetime | None = None) -> bool:
    """Whether this status should suppress payment on affected departures."""
    if status.access in BLOCKING_ACCESS:
        return True
    # An unverified or stale route is not a green light either.
    return not status.is_publicly_trustworthy(now=now)
