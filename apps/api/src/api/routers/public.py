"""Public read endpoints and lead capture.

Every response here is shaped by one rule from doc 03: the site "must do more than
inspire. It must answer the questions that determine trust". So a journey never
returns without its caveats, a status never returns without its verification, and a
departure never returns a payment action its state does not permit.
"""

from __future__ import annotations

from datetime import UTC, datetime

from fastapi import APIRouter, HTTPException, Request, status
from sqlalchemy import desc, select
from sqlalchemy.orm import selectinload

from api.deps import LocaleDep, SessionDep
from api.domain.departures import permitted_payment_action
from api.localization import is_translated, resolve
from api.models.catalogue import (
    Destination,
    ItineraryStage,
    ItineraryVersion,
    Journey,
    ServiceTier,
)
from api.models.documents import DocumentRequirement
from api.models.leads import (
    ConsentChannel,
    ConsentPurpose,
    EnquiryDetail,
    EnquiryKind,
    Lead,
    LeadConsent,
)
from api.routers.advocacy import attribute_referral
from api.models.operations import Departure, RouteSegment, StatusUpdate
from api.models.weather import WeatherSnapshot
from api.schemas import (
    DepartureOut,
    DestinationOut,
    DocumentRequirementOut,
    ItineraryStageOut,
    JourneyDetailOut,
    JourneySummaryOut,
    LeadIn,
    LeadOut,
    LiveStatusOut,
    PermitChecklistOut,
    ServiceTierOut,
    StatusOut,
    StayOut,
    WeatherOut,
)

router = APIRouter(tags=["public"])

#: Availability wording approved for public display. Doc 03 permits showing limited
#: capacity "only when inventory is trusted", so exact seat counts are never exposed.
_AVAILABILITY = {
    "open_for_booking": "Open",
    "minimum_group_pending": "Confirming minimum group",
    "conditional_reservation": "Conditional — see terms",
    "waitlist_open": "Waitlist",
    "confirmed": "Confirmed",
    "suspended": "Suspended",
    "rescheduled": "Rescheduled",
    "cancelled": "Cancelled",
    "completed": "Completed",
}

_STATE_LABELS = {
    "draft": "Draft",
    "feasibility_review": "Under review",
    "proposed": "Planned",
    "waitlist_open": "Waitlist open",
    "conditional_reservation": "Conditional reservation",
    "open_for_booking": "Open for booking",
    "minimum_group_pending": "Minimum group pending",
    "confirmed": "Confirmed",
    "preparation": "In preparation",
    "ready_to_depart": "Ready to depart",
    "in_progress": "Underway",
    "completed": "Completed",
    "suspended": "Suspended",
    "rescheduled": "Rescheduled",
    "cancelled": "Cancelled",
}


# ------------------------------------------------------------------------- catalogue


@router.get("/journeys", response_model=list[JourneySummaryOut])
async def list_journeys(session: SessionDep, locale: LocaleDep):
    """Published journeys only.

    Doc 03: "Do not display unlaunched journeys as purchasable." Drafts are invisible
    here; the admin is the only place they exist.
    """
    rows = await session.scalars(
        select(Journey).where(Journey.is_published.is_(True)).order_by(Journey.id)
    )
    return [
        JourneySummaryOut(
            id=j.id,
            slug=j.slug,
            name=resolve(j.name, locale) or j.slug,
            essence=resolve(j.essence, locale),
            family=j.family.value,
            gateway=j.gateway,
            duration_nights=j.duration_nights,
            highest_altitude_m=j.highest_altitude_m,
            is_published=j.is_published,
        )
        for j in rows
    ]


@router.get("/journeys/{slug}", response_model=JourneyDetailOut)
async def get_journey(slug: str, session: SessionDep, locale: LocaleDep):
    journey = await session.scalar(
        select(Journey)
        .where(Journey.slug == slug, Journey.is_published.is_(True))
        .options(selectinload(Journey.tiers))
    )
    if journey is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Journey not found.")

    version = await session.scalar(
        select(ItineraryVersion)
        .where(
            ItineraryVersion.journey_id == journey.id,
            ItineraryVersion.is_published.is_(True),
        )
        .order_by(desc(ItineraryVersion.version))
        .limit(1)
    )

    stages: list[ItineraryStageOut] = []
    if version is not None:
        stage_rows = await session.scalars(
            select(ItineraryStage)
            .where(ItineraryStage.itinerary_version_id == version.id)
            .order_by(ItineraryStage.day_number)
        )
        for s in stage_rows:
            stay_out = None
            if s.stay_id is not None:
                from api.models.catalogue import Stay  # local import avoids a cycle

                stay = await session.get(Stay, s.stay_id)
                if stay is not None:
                    stay_out = StayOut(
                        id=stay.id,
                        slug=stay.slug,
                        name=resolve(stay.name, locale) or stay.slug,
                        kind=stay.kind.value,
                        host_name=stay.host_name,
                        household_story=resolve(stay.household_story, locale),
                        village=stay.village,
                        shares_family_meals=stay.shares_family_meals,
                        typical_occupancy=stay.typical_occupancy,
                        has_running_hot_water=stay.has_running_hot_water,
                        has_heating=stay.has_heating,
                        has_mobile_network=stay.has_mobile_network,
                        is_shared_bathroom=stay.is_shared_bathroom,
                        limitations_note=resolve(stay.limitations_note, locale),
                        last_verified_by=stay.last_verified_by,
                    )
            stages.append(
                ItineraryStageOut(
                    id=s.id,
                    day_number=s.day_number,
                    title=resolve(s.title, locale) or "",
                    travel_note=resolve(s.travel_note, locale),
                    altitude_note=resolve(s.altitude_note, locale),
                    is_route_dependent=s.is_route_dependent,
                    stay=stay_out,
                )
            )

    translated = is_translated(journey.name, locale) and is_translated(
        journey.essence, locale
    )

    return JourneyDetailOut(
        id=journey.id,
        slug=journey.slug,
        name=resolve(journey.name, locale) or journey.slug,
        essence=resolve(journey.essence, locale),
        family=journey.family.value,
        gateway=journey.gateway,
        duration_nights=journey.duration_nights,
        highest_altitude_m=journey.highest_altitude_m,
        is_published=journey.is_published,
        last_reviewed_at=journey.last_reviewed_at,
        is_fully_translated=translated,
        tiers=[
            ServiceTierOut(
                id=t.id,
                slug=t.slug,
                name=resolve(t.name, locale) or t.slug,
                differentiators=resolve(t.differentiators, locale),
                max_group_size=t.max_group_size,
                typical_group_size=t.typical_group_size,
                is_private=t.is_private,
                indicative_price=t.indicative_price,
            )
            for t in journey.tiers
        ],
        stages=stages,
    )


@router.get("/destinations", response_model=list[DestinationOut])
async def list_destinations(session: SessionDep, locale: LocaleDep):
    rows = await session.scalars(
        select(Destination).where(Destination.is_published.is_(True)).order_by(Destination.id)
    )
    return [
        DestinationOut(
            id=d.id,
            slug=d.slug,
            name=resolve(d.name, locale) or d.slug,
            summary=resolve(d.summary, locale),
            altitude_m=d.altitude_m,
        )
        for d in rows
    ]


# ---------------------------------------------------------------------- live status


@router.get("/status", response_model=LiveStatusOut)
async def live_status(session: SessionDep, locale: LocaleDep):
    """Route and weather status with full provenance.

    `as_of` is the OLDEST verification in the set, not the newest. Reporting the
    freshest reading would let one recent check make three stale ones look current —
    the exact false confidence doc 08's acceptance #6 exists to prevent.
    """
    now = datetime.now(UTC)

    segments = await session.scalars(select(RouteSegment).order_by(RouteSegment.id))
    routes: list[StatusOut] = []
    verification_times: list[datetime] = []

    for segment in segments:
        latest = await session.scalar(
            select(StatusUpdate)
            .where(
                StatusUpdate.route_segment_id == segment.id,
                StatusUpdate.stage == "published",
            )
            .order_by(desc(StatusUpdate.verified_at))
            .limit(1)
        )
        if latest is None:
            continue
        freshness = latest.freshness(now=now)
        routes.append(
            StatusOut(
                id=latest.id,
                segment_slug=segment.slug,
                segment_name=resolve(segment.name, locale) or segment.slug,
                access=latest.access.value,
                label=latest.public_label(now=now),
                freshness=freshness.value,
                source=latest.source.value,
                verified_by=latest.verified_by,
                verified_at=latest.verified_at,
                next_verification_due=latest.next_verification_due,
                summary=resolve(latest.summary, locale),
                requires_permit=segment.requires_permit,
                blocks_sale=latest.blocks_sale(now=now),
            )
        )
        verification_times.append(latest.verified_at)

    weather_rows = await session.scalars(
        select(WeatherSnapshot).order_by(desc(WeatherSnapshot.observed_at)).limit(20)
    )
    seen: set[tuple[int | None, int | None]] = set()
    weather: list[WeatherOut] = []
    for w in weather_rows:
        key = (w.destination_id, w.route_segment_id)
        if key in seen:
            continue
        seen.add(key)

        place = "Route"
        if w.destination_id is not None:
            dest = await session.get(Destination, w.destination_id)
            if dest is not None:
                place = resolve(dest.name, locale) or dest.slug
        elif w.route_segment_id is not None:
            seg = await session.get(RouteSegment, w.route_segment_id)
            if seg is not None:
                place = resolve(seg.name, locale) or seg.slug

        weather.append(
            WeatherOut(
                id=w.id,
                place=place,
                condition=w.condition.value,
                temp_min_c=float(w.temp_min_c) if w.temp_min_c is not None else None,
                temp_max_c=float(w.temp_max_c) if w.temp_max_c is not None else None,
                wind_kph=float(w.wind_kph) if w.wind_kph is not None else None,
                snow_depth_cm=w.snow_depth_cm,
                advisory=resolve(w.advisory, locale),
                source=w.source.value,
                is_field_verified=w.is_field_verified,
                observed_by=w.observed_by,
                observed_at=w.observed_at,
                next_update_due=w.next_update_due,
                is_stale=w.is_stale(now=now),
                is_severe=w.is_severe,
            )
        )
        verification_times.append(w.observed_at)

    return LiveStatusOut(
        routes=routes,
        weather=weather,
        as_of=min(verification_times) if verification_times else None,
        any_stale=any(r.freshness == "stale" for r in routes)
        or any(w.is_stale for w in weather),
        any_blocking=any(r.blocks_sale for r in routes),
        has_data=bool(routes or weather),
    )


# ------------------------------------------------------------------------ departures


@router.get("/departures", response_model=list[DepartureOut])
async def list_departures(session: SessionDep, locale: LocaleDep):
    """Publicly listable departures with their true state.

    The payment action comes from the domain rule, not from the row, so a suspended
    or operator-less departure can never surface a pay affordance.
    """
    # Gated until decisions O2-O4 land — see docs/DECISIONS.md. Passed explicitly so
    # the gate is visible here rather than buried in the domain module.
    payments_enabled = False

    rows = await session.scalars(
        select(Departure)
        .where(Departure.state.notin_(["draft", "feasibility_review"]))
        .order_by(Departure.start_date)
    )

    out: list[DepartureOut] = []
    for d in rows:
        journey = await session.get(Journey, d.journey_id)
        tier = await session.get(ServiceTier, d.service_tier_id)
        operator_name = None
        if d.operating_partner_id is not None:
            from api.models.operations import OperatingPartner

            partner = await session.get(OperatingPartner, d.operating_partner_id)
            operator_name = partner.public_name or partner.legal_name if partner else None

        out.append(
            DepartureOut(
                id=d.id,
                journey_slug=journey.slug if journey else "",
                journey_name=(resolve(journey.name, locale) if journey else "") or "",
                tier_name=(resolve(tier.name, locale) if tier else "") or "",
                start_date=d.start_date,
                end_date=d.end_date,
                gateway=d.gateway,
                state=d.state.value,
                state_label=_STATE_LABELS.get(d.state.value, d.state.value),
                capacity=d.capacity,
                reserved_count=d.reserved_count,
                availability_label=_AVAILABILITY.get(d.state.value, "Enquire"),
                price=d.price,
                payment_action=permitted_payment_action(
                    d.state, payments_enabled=payments_enabled
                ).value,
                operator_disclosed=d.operating_partner_id is not None,
                operator_name=operator_name,
            )
        )
    return out


# -------------------------------------------------------------------- permit checklist


@router.get("/permit-checklist", response_model=PermitChecklistOut)
async def permit_checklist(
    session: SessionDep,
    locale: LocaleDep,
    journey: str | None = None,
):
    """The configurable document checklist.

    Doc 06 forbids a single hardcoded list, so requirements are filtered by journey
    with global ones always included. The disclaimer code travels with the payload —
    doc 03: completing this never guarantees a permit.
    """
    stmt = select(DocumentRequirement).where(DocumentRequirement.is_active.is_(True))
    if journey:
        j = await session.scalar(select(Journey).where(Journey.slug == journey))
        if j is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Journey not found.")
        stmt = stmt.where(
            (DocumentRequirement.journey_id == j.id)
            | (DocumentRequirement.journey_id.is_(None))
        )
    else:
        stmt = stmt.where(DocumentRequirement.journey_id.is_(None))

    rows = await session.scalars(stmt.order_by(DocumentRequirement.sort_order))
    return PermitChecklistOut(
        journey_slug=journey,
        requirements=[
            DocumentRequirementOut(
                id=r.id,
                code=r.code,
                label=resolve(r.label, locale) or r.code,
                description=resolve(r.description, locale),
                applies_to=r.applies_to.value,
                is_mandatory=r.is_mandatory,
                is_permit_bearing=r.is_permit_bearing,
                requires_file=r.requires_file,
                sort_order=r.sort_order,
            )
            for r in rows
        ],
    )


# ------------------------------------------------------------------------------ leads


@router.post("/leads", response_model=LeadOut, status_code=status.HTTP_201_CREATED)
async def create_lead(payload: LeadIn, request: Request, session: SessionDep):
    """Capture an enquiry with consent and attribution.

    Doc 04: consent is recorded per purpose and channel with its source and
    timestamp. Essential trip communication is granted implicitly by enquiring;
    promotional consent is only ever recorded when explicitly given.
    """
    if not payload.has_contact():
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "A phone number or email address is required so the team can reply.",
        )

    journey_id = None
    if payload.journey_slug:
        j = await session.scalar(
            select(Journey).where(Journey.slug == payload.journey_slug)
        )
        journey_id = j.id if j else None

    lead = Lead(
        enquiry_kind=EnquiryKind(payload.enquiry_kind),
        name=payload.name,
        phone=payload.phone,
        email=payload.email,
        preferred_language=payload.preferred_language,
        country=payload.country,
        origin_city=payload.origin_city,
        journey_id=journey_id,
        departure_id=payload.departure_id,
        group_size=payload.group_size,
        is_senior_inclusive=payload.is_senior_inclusive,
        tier_preference=payload.tier_preference,
        primary_concern=payload.primary_concern,
        first_touch_source=payload.first_touch_source,
        latest_touch_source=payload.first_touch_source,
        campaign=payload.campaign,
        landing_page=payload.landing_page,
        referrer=payload.referrer,
    )
    session.add(lead)
    await session.flush()

    # The specialised forms carry a second page of answers. Created only when the
    # form actually sent one, so the common WhatsApp enquiry does not get an empty
    # row of fifteen nulls attached to it.
    if payload.detail is not None:
        session.add(
            EnquiryDetail(lead_id=lead.id, **payload.detail.model_dump(exclude_none=True))
        )

    # Attribution, per doc 07. An unrecognised code is still recorded: somebody
    # mistyped, and a coordinator who can see what they typed can find the right
    # traveller and thank them.
    if payload.referral_code and payload.referral_code.strip():
        await attribute_referral(session, lead.id, payload.referral_code.strip())

    now = datetime.now(UTC)
    evidence = f"Enquiry form at {payload.landing_page or request.url.path}"

    # Enquiring grants permission to reply about this enquiry — and nothing else.
    session.add(
        LeadConsent(
            lead_id=lead.id,
            purpose=ConsentPurpose.ESSENTIAL_TRIP,
            channel=ConsentChannel.WHATSAPP
            if payload.phone
            else ConsentChannel.EMAIL,
            granted_at=now,
            evidence=evidence,
        )
    )
    for c in payload.consents:
        if not c.granted:
            continue
        session.add(
            LeadConsent(
                lead_id=lead.id,
                purpose=ConsentPurpose(c.purpose),
                channel=ConsentChannel(c.channel),
                granted_at=now,
                evidence=evidence,
            )
        )

    await session.commit()
    return LeadOut(id=lead.id, stage=lead.stage.value)
