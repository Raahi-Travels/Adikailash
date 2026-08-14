"""Partner scoping, asserted structurally rather than only observed.

`test_no_partner_endpoint_accepts_a_partner_id` is the guarantee. Scoping enforced by
a query filter is correct until somebody adds a convenience endpoint that takes an id
"just for the admin", and then a partner's token reaches another partner's departures
by changing a number. The way to keep that from happening is for no such parameter to
exist anywhere in the router.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest
from fastapi.routing import APIRoute

from api.models.operations import PartnerAccessToken
from api.routers import partners

NOW = datetime(2027, 5, 20, 12, 0, tzinfo=timezone.utc)


def token(**kw) -> PartnerAccessToken:
    base = {
        "operating_partner_id": 1,
        "token_hash": "x" * 64,
        "label": "Ops desk",
    }
    return PartnerAccessToken(**{**base, **kw})


# ------------------------------------------------------------------- scoping


def test_no_partner_endpoint_accepts_a_partner_id():
    """The scope comes from the token, never from the URL.

    A partner id in a path or query is the one change that would turn this from
    scoped to enumerable, and it would look perfectly reasonable in a diff.
    """
    for route in partners.router.routes:
        if not isinstance(route, APIRoute):
            continue
        assert "{partner" not in route.path, f"{route.path} takes a partner id"
        assert "{operating_partner" not in route.path
        for name in route.dependant.query_params:
            assert "partner_id" not in name.name, (
                f"{route.path} accepts {name.name} as a query parameter"
            )


def test_every_partner_endpoint_is_read_only():
    """Doc 06 keeps departure lifecycle and status publishing behind named staff
    roles. A partner is a different company and gets no write path at all."""
    for route in partners.router.routes:
        if isinstance(route, APIRoute):
            assert route.methods <= {"GET", "HEAD"}, f"{route.path} is not read-only"


# ------------------------------------------------------------------- validity


def test_a_fresh_token_is_valid():
    assert token(expires_at=NOW + timedelta(days=30)).is_valid(now=NOW)


def test_a_token_with_no_expiry_stays_valid():
    """Supported, but not the default: `issue_partner_token` sets a year unless told
    otherwise, because this credential lives in another company's systems."""
    assert token(expires_at=None).is_valid(now=NOW)


def test_an_expired_token_is_not_valid():
    assert not token(expires_at=NOW - timedelta(seconds=1)).is_valid(now=NOW)


def test_a_revoked_token_is_not_valid_even_before_it_expires():
    revoked = token(expires_at=NOW + timedelta(days=30), revoked_at=NOW - timedelta(days=1))
    assert not revoked.is_valid(now=NOW)


#: The one field naming travellers, and it is a count. Named as an exception rather
#: than by loosening the rule below, so "traveller" appearing on any *other* field
#: still fails — a `traveller_names` added for a partner's convenience is exactly the
#: change this is watching for.
ALLOWED_TRAVELLER_FIELD = "travellers_expected"


@pytest.mark.parametrize("field", ["passport", "traveller", "payment", "document", "phone"])
def test_the_partner_payload_carries_no_traveller_data(field: str):
    """A head count, never the manifest. Doc 08 restricts access to sensitive
    traveller data, and a partner is a different company."""
    from api.schemas import PartnerDepartureOut

    offending = [
        name
        for name in PartnerDepartureOut.model_fields
        if field in name and name != ALLOWED_TRAVELLER_FIELD
    ]
    assert offending == []
