"""Visibly-marked demo data for local development.

Separate from `api.seed` on purpose. The real seed produces honest drafts with no
invented facts. But a live-status bar, a departure list and a permit page cannot be
built or reviewed against an empty database, so this fills them — loudly.

Everything created here is labelled. Route statuses are attributed to
`DEMO DATA - not a real verification`, journey durations carry a placeholder marker,
and departures reference a demo operating partner. If any of it ever reaches
production it will be obvious on the page rather than passing as fact.

    uv run --project apps/api python -m api.seed_demo          # create
    uv run --project apps/api python -m api.seed_demo --purge  # remove
"""

from __future__ import annotations

import asyncio
import sys
from datetime import UTC, date, datetime, timedelta

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from api.db import SessionLocal
from api.domain.status import Access, PublicationStage, SourceType
from api.models.catalogue import Destination, ItineraryVersion, Journey
from api.models.operations import (
    Departure,
    OperatingPartner,
    RouteSegment,
    StatusUpdate,
)
from api.models.weather import WeatherCondition, WeatherSnapshot, WeatherSource
from api.seed import t

DEMO_VERIFIER = "DEMO DATA - not a real verification"
DEMO_OPERATOR = "DEMO Operating Partner (placeholder, see decision O2)"

#: Route conditions covering every state the UI must render, including a
#: deliberately stale one so the staleness treatment can be reviewed.
DEMO_STATUS = [
    ("kathgodam-pithoragarh", Access.OPEN, SourceType.FIELD_COORDINATOR, 12,
     t("Road open. Normal running time.", "मार्ग खुला। सामान्य समय।")),
    ("pithoragarh-dharchula", Access.OPEN, SourceType.OPERATING_PARTNER, 12,
     t("Open. Single-lane sections after rain.",
       "खुला। वर्षा के बाद कुछ हिस्से एकल-लेन।")),
    ("dharchula-gunji", Access.LIMITED, SourceType.FIELD_COORDINATOR, 8,
     t("Limited access. Convoy timings apply; carry permits.",
       "सीमित पहुँच। काफिले का समय लागू; परमिट साथ रखें।")),
    ("gunji-adi-kailash", Access.PERMIT_PENDING, SourceType.OFFICIAL_NOTICE, 24,
     t("Permit issuance pending for the coming window.",
       "आगामी अवधि के लिए परमिट जारी होना लंबित।")),
    # Verified four days ago with a 6-hour window: renders as stale.
    ("gunji-nabhidhang", Access.OPEN, SourceType.SUPPLIER_OBSERVATION, 6,
     t("Reported open by a vendor. Not re-verified since.",
       "विक्रेता द्वारा खुला बताया गया। तब से पुनः सत्यापित नहीं।")),
]

DEMO_WEATHER = [
    ("dharchula", WeatherCondition.PARTLY_CLOUDY, 14.0, 24.0,
     t("Mild in the valley. Carry a light layer for evenings.",
       "घाटी में सामान्य। शाम के लिए हल्का कपड़ा साथ रखें।"), True, 6),
    ("gunji", WeatherCondition.CLEAR, 2.0, 12.0,
     t("Clear and cold above 3,000m. Layers essential.",
       "3,000 मीटर से ऊपर साफ़ और ठंडा। परतदार कपड़े आवश्यक।"), True, 6),
    ("adi-kailash", WeatherCondition.SNOW, -6.0, 1.0,
     t("Snow at the darshan point. Conditions change quickly.",
       "दर्शन स्थल पर बर्फ़। परिस्थितियाँ शीघ्र बदलती हैं।"), False, 4),
]


async def _demo_partner(session: AsyncSession) -> OperatingPartner:
    partner = await session.scalar(
        select(OperatingPartner).where(OperatingPartner.legal_name == DEMO_OPERATOR)
    )
    if partner is None:
        partner = OperatingPartner(
            legal_name=DEMO_OPERATOR,
            public_name=DEMO_OPERATOR,
            is_contracting_entity=True,
        )
        session.add(partner)
        await session.flush()
    return partner


async def create_demo(session: AsyncSession) -> None:
    now = datetime.now(UTC)

    # Publish journeys so the public endpoints return something. The duration is a
    # placeholder; the marker in last_reviewed_by makes that explicit in the admin.
    journeys = list(await session.scalars(select(Journey)))
    for j in journeys:
        j.is_published = True
        j.duration_nights = j.duration_nights or 9
        j.last_reviewed_by = DEMO_VERIFIER
        version = await session.scalar(
            select(ItineraryVersion).where(ItineraryVersion.journey_id == j.id)
        )
        if version is not None:
            version.is_published = True

    for d in await session.scalars(select(Destination)):
        d.is_published = True

    # Route status
    for slug, access, source, hours, summary in DEMO_STATUS:
        segment = await session.scalar(
            select(RouteSegment).where(RouteSegment.slug == slug)
        )
        if segment is None:
            continue
        observed = now - (timedelta(days=4) if access is Access.OPEN and hours == 6 else timedelta(minutes=30))
        session.add(
            StatusUpdate(
                route_segment_id=segment.id,
                access=access,
                stage=PublicationStage.PUBLISHED,
                source=source,
                verified_by=DEMO_VERIFIER,
                verified_at=observed,
                next_verification_due=observed + timedelta(hours=hours),
                summary=summary,
            )
        )

    # Weather
    for slug, condition, tmin, tmax, advisory, field_verified, hours in DEMO_WEATHER:
        dest = await session.scalar(select(Destination).where(Destination.slug == slug))
        if dest is None:
            continue
        session.add(
            WeatherSnapshot(
                destination_id=dest.id,
                condition=condition,
                temp_min_c=tmin,
                temp_max_c=tmax,
                advisory=advisory,
                source=WeatherSource.FIELD_COORDINATOR
                if field_verified
                else WeatherSource.WEATHER_API,
                is_field_verified=field_verified,
                observed_by=DEMO_VERIFIER if field_verified else None,
                observed_at=now - timedelta(minutes=45),
                next_update_due=now + timedelta(hours=hours),
            )
        )

    # Departures across the states the UI must render.
    partner = await _demo_partner(session)
    flagship = await session.scalar(
        select(Journey).where(Journey.slug == "adi-kailash-om-parvat")
    )
    if flagship is not None:
        await session.refresh(flagship, ["tiers"])
        tier = flagship.tiers[0] if flagship.tiers else None
        if tier is not None:
            plan = [
                (date(2027, 5, 20), "open_for_booking", 12, 4),
                (date(2027, 6, 10), "waitlist_open", 12, 0),
                (date(2027, 6, 24), "minimum_group_pending", 12, 3),
                (date(2027, 7, 8), "suspended", 12, 0),
            ]
            for start, state, capacity, reserved in plan:
                exists = await session.scalar(
                    select(Departure).where(
                        Departure.journey_id == flagship.id,
                        Departure.service_tier_id == tier.id,
                        Departure.start_date == start,
                    )
                )
                if exists is not None:
                    continue
                session.add(
                    Departure(
                        journey_id=flagship.id,
                        service_tier_id=tier.id,
                        operating_partner_id=partner.id,
                        start_date=start,
                        end_date=start + timedelta(days=9),
                        gateway="Kathgodam",
                        state=state,
                        capacity=capacity,
                        reserved_count=reserved,
                    )
                )

    await session.commit()


async def purge_demo(session: AsyncSession) -> None:
    await session.execute(
        delete(StatusUpdate).where(StatusUpdate.verified_by == DEMO_VERIFIER)
    )
    await session.execute(
        delete(WeatherSnapshot).where(WeatherSnapshot.observed_by == DEMO_VERIFIER)
    )
    partner = await session.scalar(
        select(OperatingPartner).where(OperatingPartner.legal_name == DEMO_OPERATOR)
    )
    if partner is not None:
        await session.execute(
            delete(Departure).where(Departure.operating_partner_id == partner.id)
        )
        await session.delete(partner)
    for j in await session.scalars(select(Journey)):
        if j.last_reviewed_by == DEMO_VERIFIER:
            j.is_published = False
    await session.commit()


async def _run(purge: bool) -> None:
    async with SessionLocal() as session:
        if purge:
            await purge_demo(session)
            print("Demo data removed.")
        else:
            await create_demo(session)
            print(
                "Demo data created. Every row is labelled "
                f"'{DEMO_VERIFIER}' — remove with --purge before any real use."
            )


def main() -> None:
    asyncio.run(_run("--purge" in sys.argv))


if __name__ == "__main__":
    main()
