"""All ORM models. Importing this module registers every table on ``Base.metadata``.

Alembic autogenerate depends on this being complete — a model that is not imported
here is invisible to migrations.
"""

# Imported first: registers the public.users FK anchor before leads resolves it.
from api.models.external import raahi_users
from api.models.access import TravellerAccessToken, generate_token, hash_token
from api.models.catalogue import (
    Destination,
    ItineraryStage,
    ItineraryVersion,
    Journey,
    JourneyFamily,
    MediaAsset,
    MediaProvenance,
    ServiceTier,
    Stay,
    StayKind,
)
from api.models.documents import (
    DocumentAccessLog,
    DocumentRequirement,
    DocumentState,
    DocumentSubmission,
    TravellerCategory,
)
from api.models.leads import (
    ConsentChannel,
    ConsentPurpose,
    Lead,
    LeadConsent,
    LeadStage,
)
from api.models.operations import (
    Departure,
    DepartureStateChange,
    OperatingPartner,
    RouteSegment,
    StatusUpdate,
)
from api.models.staff import (
    CONTENT_ROLES,
    DEPARTURE_LIFECYCLE_ROLES,
    DOCUMENT_REVIEW_ROLES,
    STATUS_PUBLISHING_ROLES,
    StaffAccount,
    StaffRole,
    StaffSession,
    StaffUser,
    StaffVerification,
)
from api.models.weather import (
    SEVERE_CONDITIONS,
    WeatherCondition,
    WeatherSnapshot,
    WeatherSource,
)

__all__ = [
    "CONTENT_ROLES",
    "ConsentChannel",
    "ConsentPurpose",
    "DEPARTURE_LIFECYCLE_ROLES",
    "DOCUMENT_REVIEW_ROLES",
    "Departure",
    "DepartureStateChange",
    "Destination",
    "DocumentAccessLog",
    "DocumentRequirement",
    "DocumentState",
    "DocumentSubmission",
    "ItineraryStage",
    "ItineraryVersion",
    "Journey",
    "JourneyFamily",
    "Lead",
    "LeadConsent",
    "LeadStage",
    "MediaAsset",
    "MediaProvenance",
    "OperatingPartner",
    "RouteSegment",
    "STATUS_PUBLISHING_ROLES",
    "SEVERE_CONDITIONS",
    "ServiceTier",
    "StaffAccount",
    "StaffRole",
    "StaffSession",
    "StaffUser",
    "StaffVerification",
    "StatusUpdate",
    "Stay",
    "StayKind",
    "TravellerAccessToken",
    "TravellerCategory",
    "generate_token",
    "hash_token",
    "WeatherCondition",
    "WeatherSnapshot",
    "WeatherSource",
    "raahi_users",
]
