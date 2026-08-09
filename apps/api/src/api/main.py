"""FastAPI application.

Two surfaces: unauthenticated public reads plus lead capture, and role-gated staff
endpoints. Business policy that is still open (docs/DECISIONS.md O1-O11) is absent
rather than guessed — most conspicuously, there is no payment endpoint, because the
operator, deposit and refund rules are not approved.
"""

from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.config import get_settings
from api.domain.departures import (
    DepartureState,
    allowed_transitions,
    is_publicly_listable,
    permitted_payment_action,
)
from api.routers import admin, public, traveller
from api.storage import is_storage_configured

settings = get_settings()

app = FastAPI(
    title="Journeys API",
    description=(
        "Operational backbone for Himalayan pilgrimage departures. "
        "Brand-neutral by design — no endpoint or model is named after the "
        "provisional consumer brand."
    ),
    version="0.2.0",
)

# The Next.js app is the only browser client. Credentials are allowed because staff
# sessions travel as cookies, so the origin can never be "*" — that combination is
# how session tokens leak.
#
# Development accepts any localhost port because the dev server picks a free one.
# Production accepts only the exact origins in ALLOWED_ORIGINS and refuses to start
# without them, rather than falling back to a permissive default nobody notices.
if settings.is_production:
    if not settings.allowed_origins:
        raise RuntimeError(
            "ALLOWED_ORIGINS must list the deployed web origins in production. "
            "Refusing to start with a development CORS policy."
        )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.allowed_origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type", "Accept-Language"],
    )
else:
    app.add_middleware(
        CORSMiddleware,
        allow_origin_regex=r"^http://(localhost|127\.0\.0\.1):\d+$",
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

app.include_router(public.router)
app.include_router(admin.router)
app.include_router(traveller.router)


@app.get("/health", tags=["meta"])
def health() -> dict[str, object]:
    return {
        "status": "ok",
        "schema": settings.db_schema,
        # Surfaced so a deploy cannot quietly run with document uploads misconfigured.
        "document_storage_configured": is_storage_configured(),
        "payments_enabled": False,
    }


@app.get("/domain/departure-states", tags=["meta"])
def departure_states(payments_enabled: bool = False) -> list[dict[str, object]]:
    """The departure lifecycle as the code actually enforces it.

    Lets operations review the rules without reading Python, and makes drift from
    doc 06 visible.
    """
    return [
        {
            "state": state.value,
            "allowed_transitions": sorted(s.value for s in allowed_transitions(state)),
            "payment_action": permitted_payment_action(
                state, payments_enabled=payments_enabled
            ).value,
            "publicly_listable": is_publicly_listable(state),
        }
        for state in DepartureState
    ]
