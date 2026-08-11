"""Traveller access links.

Doc 05 sets the constraint precisely: "The first version may use a low-friction
secure access method rather than forcing every companion through a complex
account-creation process. Regardless of implementation, access must be
authenticated, revocable and appropriate for sensitive traveller information."

So: a long random token sent to the traveller, hashed here. Three properties follow
from "revocable" and "appropriate for sensitive information":

  - only a SHA-256 hash is stored, so a database leak does not yield working links
  - every link expires, and can be revoked before expiry
  - each use is stamped, so a link that is circulating more widely than expected is
    visible rather than silent

This is deliberately not a login. A traveller uploading a passport scan should not
have to create an account first; doc 03 forbids requiring one even to ask a question.
"""

from __future__ import annotations

import hashlib
import secrets
from datetime import UTC, datetime, timedelta

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column

from api.db import Base, TimestampMixin

#: Long enough that guessing is hopeless, short enough to survive a WhatsApp message.
TOKEN_BYTES = 32

#: Documents are gathered over weeks, not hours, so a short expiry would just mean
#: constant re-issuing. Revocation covers the case where a link goes astray.
DEFAULT_TTL = timedelta(days=30)


def generate_token() -> str:
    """A fresh opaque token. Returned once; only its hash is ever stored."""
    return secrets.token_urlsafe(TOKEN_BYTES)


def hash_token(token: str) -> str:
    """SHA-256, matching how the token is looked up.

    Not a password hash on purpose: this is a high-entropy random value, not a
    user-chosen secret, so slow hashing buys nothing and would cost a KDF round on
    every page load.
    """
    return hashlib.sha256(token.encode()).hexdigest()


class TravellerAccessToken(Base, TimestampMixin):
    """One shareable link to a traveller's own record.

    Originally a lead's document checklist; since Phase 2 it can also open a
    reservation, which carries the state, the payment trail and the accepted terms.
    """

    __tablename__ = "traveller_access_tokens"
    __table_args__ = (
        CheckConstraint("expires_at > created_at", name="expiry_is_forward"),
        Index("ix_traveller_access_tokens_hash", "token_hash", unique=True),
        Index("ix_traveller_access_tokens_lead", "lead_id"),
        Index("ix_traveller_access_tokens_reservation", "reservation_id"),
        # A token has to open something. Both columns are nullable so either kind of
        # link is expressible, which without this would also make "neither" expressible.
        CheckConstraint(
            "lead_id is not null or reservation_id is not null",
            name="token_points_at_something",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    #: Phase 2: a link can now open a reservation rather than only a lead. Nullable
    #: on both sides because a document request to a lead predates any reservation,
    #: and a walk-in reservation never had a lead. The check constraint below is what
    #: stops a token that points at nothing.
    reservation_id: Mapped[int | None] = mapped_column(
        ForeignKey("reservations.id", ondelete="CASCADE")
    )
    lead_id: Mapped[int | None] = mapped_column(
        ForeignKey("leads.id", ondelete="CASCADE")
    )
    token_hash: Mapped[str] = mapped_column(String(64), nullable=False)

    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    revoked_by: Mapped[str | None] = mapped_column(String(120))

    #: Who issued it, so an unexpected link has an owner to ask.
    issued_by: Mapped[str | None] = mapped_column(String(120))
    last_used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    use_count: Mapped[int] = mapped_column(
        Integer, default=0, server_default=text("0"), nullable=False
    )

    def is_valid(self, *, now: datetime | None = None) -> bool:
        moment = now or datetime.now(UTC)
        return self.revoked_at is None and self.expires_at > moment
