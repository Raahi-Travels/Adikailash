"""Skeleton drafts for the three launch journey families (decision D10).

Idempotent. re-running updates by slug rather than duplicating.

**What is deliberately absent.** Every operational fact is left NULL: altitudes,
durations, prices, permit rules, group sizes, day-by-day timings. Doc 09 is explicit
that agents must not invent journey facts, and doc 03 requires altitude and duration
to be *approved* values carrying a review date. Place names and route structure are
real and verifiable; numbers are for operations to fill in.

Nothing seeded here is publishable. `published_journey_needs_facts` blocks it at the
database level until a human supplies the essence and duration.

    uv run --project apps/api seed
"""

from __future__ import annotations

import asyncio
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api.db import SessionLocal
from api.models.catalogue import (
    Destination,
    ItineraryVersion,
    Journey,
    JourneyFamily,
    ServiceTier,
    StayKind,
    Stay,
)
from api.models.documents import DocumentRequirement, TravellerCategory
from api.models.operations import RouteSegment

NEEDS_FACTS = "TO BE CONFIRMED by operations, see decision O6."


def t(en: str, hi: str) -> dict[str, Any]:
    """Localized text. Hindi is a first-class value here, not an afterthought."""
    return {"en": en, "hi": hi}


DESTINATIONS: list[dict[str, Any]] = [
    {"slug": "adi-kailash", "name": t("Adi Kailash", "आदि कैलाश")},
    {"slug": "om-parvat", "name": t("Om Parvat", "ॐ पर्वत")},
    {"slug": "pithoragarh", "name": t("Pithoragarh", "पिथौरागढ़")},
    {"slug": "dharchula", "name": t("Dharchula", "धारचूला")},
    {"slug": "gunji", "name": t("Gunji", "गुंजी")},
    {"slug": "nabhidhang", "name": t("Nabhidhang", "नाभीढांग")},
    {"slug": "jageshwar", "name": t("Jageshwar Dham", "जागेश्वर धाम")},
    {"slug": "kainchi-dham", "name": t("Kainchi Dham", "कैंची धाम")},
    {"slug": "kasar-devi", "name": t("Kasar Devi", "कसार देवी")},
    {"slug": "munsiyari", "name": t("Munsiyari", "मुनस्यारी")},
    {"slug": "kathgodam", "name": t("Kathgodam", "काठगोदाम")},
]

ROUTE_SEGMENTS: list[dict[str, Any]] = [
    {
        "slug": "kathgodam-pithoragarh",
        "name": t("Kathgodam to Pithoragarh", "काठगोदाम से पिथौरागढ़"),
        "requires_permit": False,
    },
    {
        "slug": "pithoragarh-dharchula",
        "name": t("Pithoragarh to Dharchula", "पिथौरागढ़ से धारचूला"),
        "requires_permit": False,
    },
    {
        "slug": "dharchula-gunji",
        "name": t("Dharchula to Gunji", "धारचूला से गुंजी"),
        "requires_permit": True,
    },
    {
        "slug": "gunji-adi-kailash",
        "name": t("Gunji to Adi Kailash", "गुंजी से आदि कैलाश"),
        "requires_permit": True,
    },
    {
        "slug": "gunji-nabhidhang",
        "name": t("Gunji to Nabhidhang (Om Parvat)", "गुंजी से नाभीढांग (ॐ पर्वत)"),
        "requires_permit": True,
    },
]

JOURNEYS: list[dict[str, Any]] = [
    {
        "slug": "adi-kailash-om-parvat",
        "family": JourneyFamily.SACRED_FLAGSHIP,
        "name": t("Adi Kailash & Om Parvat", "आदि कैलाश और ॐ पर्वत"),
        "essence": t(
            "The flagship pilgrimage to Adi Kailash and Om Parvat, guided from Kumaon.",
            "कुमाऊँ से संचालित आदि कैलाश और ॐ पर्वत की प्रमुख तीर्थयात्रा।",
        ),
        "gateway": "Kathgodam / Pithoragarh",
        "tiers": [
            ("standard", t("Standard", "स्टैंडर्ड"), False),
            ("comfort", t("Comfort", "कम्फर्ट"), False),
            ("private", t("Private", "प्राइवेट"), True),
        ],
    },
    {
        "slug": "kumaon-spiritual-circuit",
        "family": JourneyFamily.KUMAON_CIRCUIT,
        "name": t("Kumaon Spiritual Circuit", "कुमाऊँ आध्यात्मिक परिक्रमा"),
        "essence": t(
            "Jageshwar, Kainchi Dham and Kasar Devi. Living sacred landscapes at "
            "lower altitude, open across a longer season.",
            "जागेश्वर, कैंची धाम और कसार देवी। कम ऊँचाई पर जीवंत पवित्र स्थल, "
            "लंबे मौसम तक खुले।",
        ),
        "gateway": "Kathgodam",
        "tiers": [
            ("standard", t("Standard", "स्टैंडर्ड"), False),
            ("private", t("Private", "प्राइवेट"), True),
        ],
    },
    {
        "slug": "homestay-immersion",
        "family": JourneyFamily.HOMESTAY_IMMERSION,
        "name": t("Kumaon Homestay Immersion", "कुमाऊँ होमस्टे अनुभव"),
        "essence": t(
            "Nights with host families rather than hotels. Shared kitchens, village "
            "mornings, and income that stays in the household.",
            "होटलों के बजाय मेज़बान परिवारों के साथ रातें। साझा रसोई, गाँव की सुबह, "
            "और आमदनी जो घर में ही रहती है।",
        ),
        "gateway": "Pithoragarh",
        "tiers": [
            ("shared", t("Shared", "साझा"), False),
            ("private", t("Private", "प्राइवेट"), True),
        ],
    },
]


async def _upsert_destinations(session: AsyncSession) -> None:
    for row in DESTINATIONS:
        existing = await session.scalar(
            select(Destination).where(Destination.slug == row["slug"])
        )
        if existing:
            existing.name = row["name"]
        else:
            session.add(Destination(slug=row["slug"], name=row["name"]))


async def _upsert_route_segments(session: AsyncSession) -> None:
    for row in ROUTE_SEGMENTS:
        existing = await session.scalar(
            select(RouteSegment).where(RouteSegment.slug == row["slug"])
        )
        if existing:
            existing.name = row["name"]
            existing.requires_permit = row["requires_permit"]
        else:
            session.add(RouteSegment(**row))


async def _upsert_journeys(session: AsyncSession) -> None:
    for spec in JOURNEYS:
        journey = await session.scalar(
            select(Journey).where(Journey.slug == spec["slug"])
        )
        if journey is None:
            journey = Journey(slug=spec["slug"])
            session.add(journey)

        journey.name = spec["name"]
        journey.essence = spec["essence"]
        journey.family = spec["family"]
        journey.gateway = spec["gateway"]
        # Left NULL on purpose. operations supplies approved values (O6).
        journey.duration_nights = None
        journey.highest_altitude_m = None
        journey.is_published = False
        await session.flush()

        for slug, name, is_private in spec["tiers"]:
            tier = await session.scalar(
                select(ServiceTier).where(
                    ServiceTier.journey_id == journey.id, ServiceTier.slug == slug
                )
            )
            if tier is None:
                tier = ServiceTier(journey_id=journey.id, slug=slug)
                session.add(tier)
            tier.name = name
            tier.is_private = is_private
            tier.differentiators = t(NEEDS_FACTS, NEEDS_FACTS)

        version = await session.scalar(
            select(ItineraryVersion).where(
                ItineraryVersion.journey_id == journey.id, ItineraryVersion.version == 1
            )
        )
        if version is None:
            session.add(
                ItineraryVersion(
                    journey_id=journey.id,
                    version=1,
                    is_published=False,
                    notes=t(
                        f"Draft skeleton. Day-by-day stages, timings, altitudes and "
                        f"accommodation are not yet entered. {NEEDS_FACTS}",
                        f"प्रारूप ढाँचा। दिनवार चरण, समय, ऊँचाई और आवास अभी दर्ज नहीं हैं। "
                        f"{NEEDS_FACTS}",
                    ),
                )
            )


async def _upsert_example_stay(session: AsyncSession) -> None:
    """One homestay row showing the D5 shape. placeholder host, no imagery.

    Deliberately not a real family: consent and a field visit come first, and doc 02
    forbids representing an actual stay without verified imagery.
    """
    existing = await session.scalar(select(Stay).where(Stay.slug == "example-homestay"))
    if existing:
        return
    session.add(
        Stay(
            slug="example-homestay",
            name=t("Example Host Family (placeholder)", "उदाहरण मेज़बान परिवार (प्लेसहोल्डर)"),
            kind=StayKind.HOMESTAY,
            household_story=t(
                "Placeholder showing how a host family's story is stored. Replace only "
                "after a field visit and recorded consent from the household.",
                "यह दिखाने के लिए प्लेसहोल्डर कि मेज़बान परिवार की कहानी कैसे संग्रहीत होती है। "
                "क्षेत्र भ्रमण और परिवार की दर्ज सहमति के बाद ही बदलें।",
            ),
            limitations_note=t(NEEDS_FACTS, NEEDS_FACTS),
        )
    )


#: Baseline document requirements.
#:
#: These are configuration, not invented facts. they are the documents an inner-line
#: permit application for this region customarily requires, and doc 06 explicitly
#: wants them stored as configurable rows rather than hardcoded. The *specifics*
#: (issuing authority, validity windows, exact medical form) remain for operations to
#: confirm, which is why each description says so rather than asserting a rule.
DOCUMENT_REQUIREMENTS: list[dict[str, Any]] = [
    {
        "code": "photo_id",
        "label": t("Government photo ID (original)", "सरकारी फोटो पहचान पत्र (मूल)"),
        "description": t(
            "Carried in original. Accepted forms are confirmed by operations for each "
            "departure.",
            "मूल रूप में साथ रखें। प्रत्येक प्रस्थान के लिए स्वीकृत प्रकार संचालन टीम द्वारा "
            "पुष्ट किए जाते हैं।",
        ),
        "is_permit_bearing": True,
        "sort_order": 10,
    },
    {
        "code": "aadhaar",
        "label": t("Aadhaar card", "आधार कार्ड"),
        "description": t(
            "Required for Indian nationals. Foreign nationals follow a different "
            "process. Ask the team.",
            "भारतीय नागरिकों के लिए आवश्यक। विदेशी नागरिकों के लिए प्रक्रिया अलग है. "
            "टीम से पूछें।",
        ),
        "applies_to": TravellerCategory.INDIAN_NATIONAL,
        "is_permit_bearing": True,
        "sort_order": 20,
    },
    {
        "code": "passport_photos",
        "label": t("Passport-size photographs", "पासपोर्ट आकार की तस्वीरें"),
        "description": t(
            "Quantity is confirmed per departure. Bring spares.",
            "संख्या प्रत्येक प्रस्थान के अनुसार पुष्ट होती है। अतिरिक्त साथ लाएँ।",
        ),
        "is_permit_bearing": True,
        "sort_order": 30,
    },
    {
        "code": "medical_fitness",
        "label": t("Medical fitness certificate", "चिकित्सा स्वस्थता प्रमाणपत्र"),
        "description": t(
            "From a qualified medical practitioner. We do not assess fitness and "
            "cannot advise on your suitability. please consult a doctor.",
            "किसी योग्य चिकित्सक द्वारा जारी। हम स्वस्थता का आकलन नहीं करते और आपकी "
            "उपयुक्तता पर सलाह नहीं दे सकते. कृपया चिकित्सक से परामर्श लें।",
        ),
        "is_permit_bearing": True,
        "sort_order": 40,
    },
    {
        "code": "travel_insurance",
        "label": t("Travel insurance", "यात्रा बीमा"),
        "description": t(
            "Strongly recommended for high-altitude travel.",
            "अधिक ऊँचाई की यात्रा के लिए अत्यंत अनुशंसित।",
        ),
        "is_mandatory": False,
        "requires_file": False,
        "sort_order": 50,
    },
]


async def _upsert_document_requirements(session: AsyncSession) -> None:
    for row in DOCUMENT_REQUIREMENTS:
        existing = await session.scalar(
            select(DocumentRequirement).where(
                DocumentRequirement.code == row["code"],
                DocumentRequirement.journey_id.is_(None),
                DocumentRequirement.departure_id.is_(None),
            )
        )
        target = existing or DocumentRequirement(code=row["code"])
        target.label = row["label"]
        target.description = row["description"]
        target.applies_to = row.get("applies_to", TravellerCategory.ALL)
        target.is_mandatory = row.get("is_mandatory", True)
        target.is_permit_bearing = row.get("is_permit_bearing", False)
        target.requires_file = row.get("requires_file", True)
        target.sort_order = row["sort_order"]
        target.is_active = True
        if existing is None:
            session.add(target)


async def seed() -> None:
    async with SessionLocal() as session:
        await _upsert_destinations(session)
        await _upsert_route_segments(session)
        await _upsert_journeys(session)
        await _upsert_example_stay(session)
        await _upsert_document_requirements(session)
        await session.commit()

    print(
        f"Seeded {len(DESTINATIONS)} destinations, {len(ROUTE_SEGMENTS)} route segments, "
        f"{len(JOURNEYS)} journeys (all unpublished drafts), "
        f"{len(DOCUMENT_REQUIREMENTS)} document requirements."
    )


def main() -> None:
    asyncio.run(seed())


if __name__ == "__main__":
    main()
