"""When a guide may still call itself current.

The same rule as route status, for the same reason. Doc 07's guardrails include "do
not fabricate current status from old articles" and "do not mark content as live when
it is not regularly verified" — and a guide about road conditions written last October
is exactly the artefact those two warnings describe.

So an article carries a re-check commitment, and the label it earns is computed from
whether that commitment was kept. It is not a badge somebody sets.

Kept deliberately parallel to `api.domain.status.derive_freshness`: two different
freshness models on one site would eventually disagree in public, and the visitor
would have no way to know which one to believe.
"""

from __future__ import annotations

import enum
from datetime import UTC, datetime, timedelta


class Freshness(enum.StrEnum):
    #: Reviewed within its interval.
    CURRENT = "current"
    #: Past three quarters of the interval. Chase it; still shown as current.
    DUE_SOON = "due_soon"
    #: Past its interval. Shown to the reader as not recently reviewed.
    STALE = "stale"


def derive_freshness(
    last_reviewed_at: datetime | None,
    review_interval_days: int,
    *,
    now: datetime | None = None,
) -> Freshness:
    """Never-reviewed counts as stale, not as current.

    The default has to fall that way. An article with no review date is not a fresh
    article; it is one nobody has checked, and defaulting to `CURRENT` would make the
    freshness label meaningless precisely where it matters most.
    """
    if last_reviewed_at is None:
        return Freshness.STALE

    moment = now or datetime.now(UTC)
    interval = timedelta(days=review_interval_days)
    age = moment - last_reviewed_at

    if age >= interval:
        return Freshness.STALE
    if age >= interval * 0.75:
        return Freshness.DUE_SOON
    return Freshness.CURRENT


#: What the reader is told. "Not recently reviewed" rather than "outdated": we do not
#: know that it is wrong, only that nobody has checked, and saying more than we know
#: is the failure this whole product is built against.
_LABELS: dict[Freshness, str] = {
    Freshness.CURRENT: "Reviewed",
    Freshness.DUE_SOON: "Reviewed, re-check due",
    Freshness.STALE: "Not recently reviewed",
}


def label_for(freshness: Freshness) -> str:
    return _LABELS[freshness]


def next_review_due(
    last_reviewed_at: datetime | None, review_interval_days: int
) -> datetime | None:
    if last_reviewed_at is None:
        return None
    return last_reviewed_at + timedelta(days=review_interval_days)


def is_time_sensitive(cluster: str) -> bool:
    """Clusters where a stale page is actively misleading rather than merely old.

    A piece on Kumaoni festival tradition ages gracefully. One on road conditions or
    permit paperwork does not: read six months late it is not stale information, it is
    wrong information, and it can put somebody on a closed road.
    """
    return cluster in {"route_and_status", "preparation", "gateway_and_transport"}
