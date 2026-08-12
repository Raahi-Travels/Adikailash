"""Content freshness invariants.

`test_never_reviewed_is_stale` is the one that matters. If that ever flips, a guide
nobody has checked starts telling readers it was reviewed, and the freshness label
becomes decoration on exactly the pages where it is load-bearing: road conditions and
permit paperwork.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

import pytest

from api.domain.content import (
    Freshness,
    derive_freshness,
    is_time_sensitive,
    label_for,
    next_review_due,
)

NOW = datetime(2027, 5, 20, 12, 0, tzinfo=UTC)


def test_never_reviewed_is_stale():
    """The default has to fall this way. An article with no review date is not fresh;
    it is one nobody has checked."""
    assert derive_freshness(None, 180, now=NOW) is Freshness.STALE
    assert label_for(Freshness.STALE) == "Not recently reviewed"


def test_recently_reviewed_is_current():
    assert derive_freshness(NOW - timedelta(days=10), 180, now=NOW) is Freshness.CURRENT


def test_three_quarters_through_the_interval_is_due_soon():
    """Chased, but still shown to the reader as current: it has not lapsed yet."""
    assert derive_freshness(NOW - timedelta(days=140), 180, now=NOW) is Freshness.DUE_SOON


def test_past_the_interval_is_stale():
    assert derive_freshness(NOW - timedelta(days=181), 180, now=NOW) is Freshness.STALE


def test_exactly_at_the_interval_is_stale():
    """The commitment was to re-check within the interval. At the boundary it was not
    kept, and rounding that in our own favour is how a freshness claim rots."""
    assert derive_freshness(NOW - timedelta(days=180), 180, now=NOW) is Freshness.STALE


def test_a_short_interval_goes_stale_faster():
    """A route piece committing to a 14-day re-check is stale after 14 days, even
    though a culture piece reviewed the same day is fine for months."""
    reviewed = NOW - timedelta(days=20)
    assert derive_freshness(reviewed, 14, now=NOW) is Freshness.STALE
    assert derive_freshness(reviewed, 365, now=NOW) is Freshness.CURRENT


def test_label_never_claims_the_content_is_wrong():
    """We know nobody checked. We do not know it is wrong, and saying more than we
    know is the failure this product is built against."""
    assert "outdated" not in label_for(Freshness.STALE).lower()
    assert "wrong" not in label_for(Freshness.STALE).lower()


def test_next_review_due_is_none_without_a_review():
    assert next_review_due(None, 180) is None
    assert next_review_due(NOW, 30) == NOW + timedelta(days=30)


@pytest.mark.parametrize(
    "cluster",
    ["route_and_status", "preparation", "gateway_and_transport"],
)
def test_operational_clusters_are_time_sensitive(cluster: str):
    """Read six months late these are not stale information, they are wrong
    information, and they can put somebody on a closed road."""
    assert is_time_sensitive(cluster)


@pytest.mark.parametrize("cluster", ["culture_and_tradition", "field_report"])
def test_narrative_clusters_are_not_time_sensitive(cluster: str):
    assert not is_time_sensitive(cluster)
