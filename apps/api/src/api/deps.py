"""Shared request dependencies: locale and staff authorisation.

Session validation reads `yatra.staff_sessions` directly rather than calling back into
the Next.js app. better-auth issues and stores the session; both services share one
database, so the API can verify a token without a network hop or a second source of
truth about who is signed in.
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Annotated

from fastapi import Depends, Header, HTTPException, Query, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api.db import get_session
from api.localization import normalise_locale
from api.models.staff import StaffRole, StaffSession, StaffUser

SessionDep = Annotated[AsyncSession, Depends(get_session)]


async def get_locale(
    locale: Annotated[str | None, Query()] = None,
    accept_language: Annotated[str | None, Header(alias="Accept-Language")] = None,
) -> str:
    """Explicit ?locale= wins; otherwise negotiate from the header."""
    return normalise_locale(locale or accept_language)


LocaleDep = Annotated[str, Depends(get_locale)]


async def current_staff(
    request: Request,
    session: SessionDep,
    authorization: Annotated[str | None, Header()] = None,
) -> StaffUser:
    """The signed-in staff member, or 401.

    Accepts the token as a Bearer header or the better-auth session cookie, so the
    Next.js server can forward whichever it holds.
    """
    token: str | None = None
    if authorization and authorization.lower().startswith("bearer "):
        token = authorization[7:].strip()
    if not token:
        token = request.cookies.get("better-auth.session_token")
    if not token:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Sign-in required.")

    # better-auth cookies may carry a signature suffix; the stored token is the head.
    token = token.split(".")[0]

    staff_session = await session.scalar(
        select(StaffSession).where(StaffSession.token == token)
    )
    if staff_session is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Session not recognised.")
    if staff_session.expires_at <= datetime.now(UTC):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Session expired.")

    user = await session.get(StaffUser, staff_session.user_id)
    if user is None or not user.is_active:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Account is not active.")
    return user


StaffDep = Annotated[StaffUser, Depends(current_staff)]


def require_roles(allowed: frozenset[StaffRole], action: str):
    """Dependency factory gating an action behind specific roles.

    The `action` string appears in the 403 so an operator learns which permission
    they lack rather than hitting an opaque wall — doc 06 wants least privilege, not
    mystery.
    """

    async def _guard(staff: StaffDep) -> StaffUser:
        if not staff.has_any(allowed):
            raise HTTPException(
                status.HTTP_403_FORBIDDEN,
                f"Your roles do not permit {action}. "
                f"Required: {', '.join(sorted(r.value for r in allowed))}.",
            )
        return staff

    return _guard
