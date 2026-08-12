"""Family share links (doc 05, P1).

Two audiences. The group lead creates and revokes links through their traveller
token; a relative opens one with no account at all.

**`_build_family_view` is the security boundary of this feature**, and it is written
as a construction rather than a filter for the reason set out at length in
`api.domain.sharing`: a deny-list fails silently when somebody adds a column, and
the thing it would leak is a passport number to a forwarded WhatsApp link.

Read that function as a list of decisions. Every line puts one specific piece of
information in front of a relative, and nothing reaches the response that is not
written there.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, HTTPException, Query, Request, status
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from api.config import get_settings
from api.deps import SessionDep
from api.domain.sharing import (
    FamilyView,
    SharedCheckIn,
    SharedContact,
    SharedDay,
)
from api.localization import resolve
from api.models.access import TravellerAccessToken, hash_token
from api.models.catalogue import Destination, ItineraryStage, Journey, Stay
from api.models.operations import (
    Departure,
    DepartureCheckIn,
    OperatingPartner,
    StatusUpdate,
)
from api.models.reservations import Reservation, TravellerRole
from api.models.sharing import FamilyShare, FamilyShareView
from api.schemas import (
    FamilyShareIn,
    FamilyShareOut,
    FamilyViewOut,
    SharedCheckInOut,
    SharedContactOut,
    SharedDayOut,
)

router = APIRouter(tags=["sharing"])

#: How long after the journey ends a link keeps working. Two weeks is enough for a
#: relative to look back at what happened and short enough that a link forwarded in
#: 2026 is not still live in 2029.
GRACE_AFTER_END = timedelta(days=14)


async def _reservation_for_token(session, token: str) -> Reservation:
    row = await session.scalar(
        select(TravellerAccessToken).where(
            TravellerAccessToken.token_hash == hash_token(token)
        )
    )
    if row is None or not row.is_valid() or row.reservation_id is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "This link is not valid.")
    reservation = await session.get(Reservation, row.reservation_id)
    if reservation is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "This link is not valid.")
    return reservation


def _share_url(token: str) -> str:
    origin = get_settings().public_site_origin.rstrip("/")
    prefix = origin or "[SITE ORIGIN NOT CONFIGURED — see decision O7]"
    return f"{prefix}/family/{token}"


def _coarse_address(request: Request) -> str | None:
    """Truncate before storing. Doc 08 treats a full IP as personal data.

    Auditing "is this link being passed around" needs to tell one person refreshing
    from thirty people opening it, and a /24 answers that. The full address of a
    worried relative answers nothing we need to know.
    """
    client = request.client.host if request.client else None
    if not client:
        return None
    if ":" in client:  # IPv6 — keep the /48
        return ":".join(client.split(":")[:3]) + "::/48"
    parts = client.split(".")
    return ".".join(parts[:3]) + ".0/24" if len(parts) == 4 else None


# ------------------------------------------------------- the security boundary


async def _build_family_view(
    session, share: FamilyShare, reservation: Reservation
) -> FamilyView:
    """Assemble exactly what a relative may see. Nothing else can get in here.

    Each block below is a deliberate decision, not a projection of a wider object.
    """
    departure = await session.get(Departure, reservation.departure_id)
    journey = (
        await session.get(Journey, departure.journey_id) if departure else None
    )

    # --- Who is travelling: FIRST NAMES ONLY ---
    #
    # "Is Amma on this trip" is reassurance. A full name next to a date of birth and
    # a phone number is a contact list, which is what the rest of the traveller row
    # would give away.
    await session.refresh(reservation, ["travellers"])
    first_names = tuple(
        (t.full_name or "").strip().split(" ")[0]
        for t in reservation.travellers
        if (t.full_name or "").strip()
    )

    # --- Broad itinerary, at settlement granularity ---
    days: list[SharedDay] = []
    if departure and departure.itinerary_version_id:
        stages = list(
            await session.scalars(
                select(ItineraryStage)
                .where(
                    ItineraryStage.itinerary_version_id
                    == departure.itinerary_version_id
                )
                .order_by(ItineraryStage.day_number)
            )
        )
        for stage in stages:
            staying_at = None
            if stage.stay_id:
                stay = await session.get(Stay, stage.stay_id)
                if stay is not None:
                    # The *village*, never the stay's name or address. A homestay's
                    # location is the host family's information, not ours to publish
                    # to a link that gets forwarded.
                    if stay.destination_id:
                        dest = await session.get(Destination, stay.destination_id)
                        staying_at = resolve(dest.name, "en") if dest else None
                    staying_at = staying_at or stay.village
            days.append(
                SharedDay(
                    day=stage.day_number,
                    on_date=(
                        departure.start_date + timedelta(days=stage.day_number - 1)
                        if departure.start_date
                        else None
                    ),
                    title=resolve(stage.title, "en") or f"Day {stage.day_number}",
                    staying_at=staying_at,
                )
            )

    # --- Reachability: COMPANY numbers only ---
    #
    # For a relative at home this is the most important thing on the page. Somebody
    # worried at 2am with no number to call is not reassured by an itinerary.
    #
    # The operating partner's support contact is what we can honestly publish today:
    # a company line belonging to the entity legally responsible for this departure
    # (doc 06). Never a traveller's own number — that is the one number a relative
    # might actually want, and the one we must not hand to a link that gets
    # forwarded round a family group. A dedicated 24-hour operations number waits on
    # decision O10.
    contacts: list[SharedContact] = []
    if departure is not None and departure.operating_partner_id:
        partner = await session.get(OperatingPartner, departure.operating_partner_id)
        if partner is not None and partner.support_contact:
            contacts.append(
                SharedContact(
                    label=partner.public_name or partner.legal_name,
                    phone=partner.support_contact,
                    note="The operator responsible for this departure.",
                )
            )

    settings = get_settings()
    if settings.public_site_origin:
        contacts.append(
            SharedContact(
                label="Route and permit status",
                phone="",
                note=f"{settings.public_site_origin.rstrip('/')}/en/status",
            )
        )

    # --- Check-ins, only if this share was set up to show them ---
    latest: SharedCheckIn | None = None
    if share.shows_check_ins and departure is not None:
        row = await session.scalar(
            select(DepartureCheckIn)
            .where(
                DepartureCheckIn.departure_id == departure.id,
                DepartureCheckIn.is_shareable.is_(True),
            )
            .order_by(DepartureCheckIn.occurred_at.desc())
            .limit(1)
        )
        if row is not None:
            latest = SharedCheckIn(
                at=row.occurred_at,
                note=(f"{row.location}. {row.note}" if row.location else row.note),
                posted_by=row.posted_by,
            )

    # --- Route notices: already public on the status page ---
    #
    # Nothing here is privileged information about this group. It is the same text a
    # stranger reads at /status, which is exactly why it is safe to include.
    notices: list[str] = []
    for update in await session.scalars(
        select(StatusUpdate)
        .where(StatusUpdate.access != "open")
        .order_by(StatusUpdate.verified_at.desc())
        .limit(3)
    ):
        summary = resolve(update.summary, "en")
        if summary:
            notices.append(summary)

    return FamilyView(
        journey_name=(resolve(journey.name, "en") if journey else "Your journey"),
        starts_on=departure.start_date if departure else None,
        ends_on=departure.end_date if departure else None,
        traveller_first_names=first_names,
        days=tuple(days),
        contacts=tuple(contacts),
        latest_check_in=latest,
        route_notices=tuple(notices),
        shared_by=next(
            (
                (t.full_name or "").split(" ")[0]
                for t in reservation.travellers
                if t.role is TravellerRole.GROUP_LEAD
            ),
            None,
        ),
        shared_with_label=share.label,
    )


# ------------------------------------------------------------- group lead side


@router.get("/family-shares", response_model=list[FamilyShareOut])
async def list_shares(session: SessionDep, token: str = Query(min_length=20)):
    reservation = await _reservation_for_token(session, token)
    rows = await session.scalars(
        select(FamilyShare)
        .where(FamilyShare.reservation_id == reservation.id)
        .order_by(FamilyShare.created_at.desc())
    )
    return [
        FamilyShareOut(
            id=r.id,
            label=r.label,
            url=_share_url(r.token),
            expires_at=r.expires_at,
            revoked_at=r.revoked_at,
            shows_check_ins=r.shows_check_ins,
            view_count=r.view_count,
            last_viewed_at=r.last_viewed_at,
        )
        for r in rows
    ]


@router.post("/family-shares", response_model=FamilyShareOut, status_code=201)
async def create_share(
    payload: FamilyShareIn, session: SessionDep, token: str = Query(min_length=20)
):
    """Create a link for one relative.

    One link per person rather than one per reservation, so revoking reaches the
    right person and the view count means something. A single shared link tells you
    nothing and cannot be taken back from one recipient.
    """
    reservation = await _reservation_for_token(session, token)
    departure = await session.get(Departure, reservation.departure_id)

    expires = datetime.now(UTC) + timedelta(days=30)
    if departure and departure.end_date:
        expires = datetime.combine(
            departure.end_date, datetime.min.time(), tzinfo=UTC
        ) + GRACE_AFTER_END

    share = FamilyShare(
        reservation_id=reservation.id,
        label=payload.label.strip(),
        shows_check_ins=payload.shows_check_ins,
        expires_at=expires,
    )
    session.add(share)
    await session.commit()
    await session.refresh(share)

    return FamilyShareOut(
        id=share.id,
        label=share.label,
        url=_share_url(share.token),
        expires_at=share.expires_at,
        shows_check_ins=share.shows_check_ins,
    )


@router.post("/family-shares/{share_id}/revoke", response_model=FamilyShareOut)
async def revoke_share(
    share_id: int,
    session: SessionDep,
    token: str = Query(min_length=20),
    reason: str = Query(default="Revoked by the group lead.", max_length=500),
):
    reservation = await _reservation_for_token(session, token)
    share = await session.scalar(
        select(FamilyShare).where(
            FamilyShare.id == share_id,
            FamilyShare.reservation_id == reservation.id,
        )
    )
    if share is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Share not found.")

    if share.revoked_at is None:
        share.revoked_at = datetime.now(UTC)
        share.revoked_reason = reason
        await session.commit()

    return FamilyShareOut(
        id=share.id,
        label=share.label,
        url=_share_url(share.token),
        expires_at=share.expires_at,
        revoked_at=share.revoked_at,
        shows_check_ins=share.shows_check_ins,
        view_count=share.view_count,
        last_viewed_at=share.last_viewed_at,
    )


# -------------------------------------------------------------- relative side


@router.get("/family/{share_token}", response_model=FamilyViewOut)
async def view_share(share_token: str, request: Request, session: SessionDep):
    """Open a share link. No account, no login, nothing to install.

    A revoked or expired link 404s rather than 403s, for the same reason the
    traveller tokens do: a distinct "this was revoked" response confirms to a
    stranger that the token was once real.
    """
    share = await session.scalar(
        select(FamilyShare)
        .options(selectinload(FamilyShare.views))
        .where(FamilyShare.token == share_token)
    )
    now = datetime.now(UTC)
    if share is None or not share.is_usable(now=now):
        raise HTTPException(
            status.HTTP_404_NOT_FOUND,
            "This link is not available. It may have been turned off, or the"
            " journey may have finished a while ago.",
        )

    reservation = await session.get(Reservation, share.reservation_id)
    if reservation is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "This link is not available.")

    view = await _build_family_view(session, share, reservation)

    share.view_count += 1
    share.last_viewed_at = now
    session.add(
        FamilyShareView(
            share_id=share.id,
            coarse_address=_coarse_address(request),
            user_agent_family=(request.headers.get("user-agent") or "")[:80] or None,
        )
    )
    await session.commit()

    return FamilyViewOut(
        journey_name=view.journey_name,
        starts_on=view.starts_on,
        ends_on=view.ends_on,
        traveller_first_names=list(view.traveller_first_names),
        days=[
            SharedDayOut(
                day=d.day, on_date=d.on_date, title=d.title, staying_at=d.staying_at
            )
            for d in view.days
        ],
        contacts=[
            SharedContactOut(label=c.label, phone=c.phone, note=c.note)
            for c in view.contacts
        ],
        latest_check_in=(
            SharedCheckInOut(
                at=view.latest_check_in.at,
                note=view.latest_check_in.note,
                posted_by=view.latest_check_in.posted_by,
            )
            if view.latest_check_in
            else None
        ),
        route_notices=list(view.route_notices),
        shared_by=view.shared_by,
        shared_with_label=view.shared_with_label,
    )
