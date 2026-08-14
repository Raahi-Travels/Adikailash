"""The partner portal (doc 09, Phase 5; doc 01 rates a B2B operating platform P2).

An operating partner is the registered entity legally responsible for a departure
(doc 06). When one of them is running groups on the ground they need the operational
picture for those groups, and today they get it by asking a coordinator on WhatsApp.

**Everything here is scoped by the token, never by the URL.**

`_partner()` resolves the token to exactly one `operating_partner_id`, and every
query filters on it. There is no endpoint that takes a partner id, so changing a
number in the address bar reaches nothing — the same shape as the traveller and
family tokens, for the same reason. `test_a_partner_cannot_see_another_partners_departure`
is the test that has to keep passing.

**Read-only, and deliberately thin on people.** A partner sees their departures,
their dates and capacity, and the public route status. They do not see travellers,
documents, payments or another partner's anything. Doc 08 restricts access to
sensitive traveller data, and a partner is a different company — the manifest stays
with the coordinator who is accountable for it.
"""

from __future__ import annotations

from datetime import UTC, datetime

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import select

from api.deps import LocaleDep, SessionDep
from api.localization import resolve
from api.models.access import hash_token
from api.models.catalogue import Journey
from api.models.operations import (
    Departure,
    OperatingPartner,
    PartnerAccessToken,
    RouteSegment,
    StatusUpdate,
)
from api.schemas import PartnerDepartureOut, PartnerViewOut

router = APIRouter(tags=["partners"])


async def _partner(session, token: str) -> OperatingPartner:
    """Exchange a token for the one partner it belongs to, or 404.

    404 rather than 403 for a revoked or expired token, matching the traveller
    tokens: a distinct "this was revoked" response confirms to a stranger that the
    token was once real.
    """
    row = await session.scalar(
        select(PartnerAccessToken).where(
            PartnerAccessToken.token_hash == hash_token(token)
        )
    )
    now = datetime.now(UTC)
    if row is None or not row.is_valid(now=now):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "This link is not valid.")

    partner = await session.get(OperatingPartner, row.operating_partner_id)
    if partner is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "This link is not valid.")

    row.last_used_at = now
    row.use_count += 1
    return partner


@router.get("/partner/departures", response_model=PartnerViewOut)
async def partner_departures(
    session: SessionDep, locale: LocaleDep, token: str = Query(min_length=20)
):
    """Departures this partner is operating, and the route as we last verified it.

    The route status is the same public record anybody can read, included here so a
    partner planning tomorrow's movement does not have to hold two windows open. It
    carries its timestamp, because a partner repeating "the road is open" to their
    own travellers is doing so on our word and deserves to know how old it is.
    """
    partner = await _partner(session, token)

    departures = list(
        await session.scalars(
            select(Departure)
            .where(Departure.operating_partner_id == partner.id)
            .order_by(Departure.start_date)
        )
    )

    rows: list[PartnerDepartureOut] = []
    for departure in departures:
        journey = await session.get(Journey, departure.journey_id)
        rows.append(
            PartnerDepartureOut(
                id=departure.id,
                journey_name=resolve(journey.name, locale) if journey else "",
                start_date=departure.start_date,
                end_date=departure.end_date,
                state=departure.state.value,
                gateway=departure.gateway,
                capacity=departure.capacity,
                # A head count, never the manifest. A partner needs to know how many
                # beds and seats; the names belong to the coordinator accountable
                # for them (doc 08).
                travellers_expected=departure.reserved_count,
            )
        )

    notices: list[str] = []
    for update in await session.scalars(
        select(StatusUpdate)
        .where(StatusUpdate.stage == "published", StatusUpdate.access != "open")
        .order_by(StatusUpdate.verified_at.desc())
        .limit(5)
    ):
        segment = await session.get(RouteSegment, update.route_segment_id)
        summary = resolve(update.summary, locale)
        hours = int((datetime.now(UTC) - update.verified_at).total_seconds() // 3600)
        notices.append(
            f"{resolve(segment.name, locale) if segment else 'Route'}:"
            f" {update.access.replace('_', ' ')}, verified {hours}h ago."
            + (f" {' '.join(summary.split())}" if summary else "")
        )

    return PartnerViewOut(
        partner_name=partner.public_name or partner.legal_name,
        departures=rows,
        route_notices=notices,
        generated_at=datetime.now(UTC),
    )
