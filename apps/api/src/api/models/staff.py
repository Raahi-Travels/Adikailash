"""Staff identity and roles (decision D8).

**Why these tables are defined here rather than by better-auth's CLI.**

Raahi's `public` schema already contains better-auth's default tables — `account`,
`session`, `verification`. Running `@better-auth/cli migrate` against this database
with default settings would target those exact names in the default schema and could
collide with, or alter, the cab platform's live auth tables.

So we own the DDL: distinct table names (`staff_*`), inside `yatra`, created by our
own Alembic migration. better-auth is pointed at them through `modelName` overrides
in `apps/web/lib/auth.ts`. Its CLI is never run against this database.

Staff are not travellers and not Raahi passengers. This is a separate identity space.
"""

from __future__ import annotations

import enum
from datetime import datetime

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    String,
    Text,
    text,
)
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import Mapped, mapped_column, relationship

from api.db import Base, TimestampMixin


class StaffRole(enum.StrEnum):
    """Doc 06's suggested roles, least privilege by default.

    "No one should gain broad access simply because they are part of the family or
    team. Sensitive documents, finance and incidents require explicit permission."
    """

    SUPER_ADMIN = "super_admin"
    FOUNDER = "founder"
    OPS_MANAGER = "ops_manager"
    TRIP_COORDINATOR = "trip_coordinator"
    DOCUMENT_REVIEWER = "document_reviewer"
    STATUS_PUBLISHER = "status_publisher"
    CONTENT_EDITOR = "content_editor"
    SALES = "sales"
    FINANCE = "finance"
    READ_ONLY = "read_only"


#: Roles permitted to publish a verified route or weather status. Doc 06: "Only
#: authorised roles may publish a verified status."
STATUS_PUBLISHING_ROLES = frozenset(
    {
        StaffRole.SUPER_ADMIN,
        StaffRole.FOUNDER,
        StaffRole.OPS_MANAGER,
        StaffRole.STATUS_PUBLISHER,
    }
)

#: Roles permitted to move a departure through its lifecycle.
DEPARTURE_LIFECYCLE_ROLES = frozenset(
    {StaffRole.SUPER_ADMIN, StaffRole.FOUNDER, StaffRole.OPS_MANAGER}
)

#: Roles permitted to see traveller identity documents. Deliberately narrow — doc 08
#: classifies these as Sensitive, requiring "strong access controls".
DOCUMENT_REVIEW_ROLES = frozenset(
    {StaffRole.SUPER_ADMIN, StaffRole.OPS_MANAGER, StaffRole.DOCUMENT_REVIEWER}
)

#: Roles permitted to work the sales queue. Deliberately excludes read_only.
SALES_ROLES = frozenset(
    {
        StaffRole.SUPER_ADMIN,
        StaffRole.FOUNDER,
        StaffRole.SALES,
        StaffRole.OPS_MANAGER,
    }
)

#: Roles permitted to create and work reservations. Sales owns the relationship;
#: operations needs it because readiness and departures are the same conversation.
RESERVATION_ROLES = frozenset(
    {
        StaffRole.SUPER_ADMIN,
        StaffRole.FOUNDER,
        StaffRole.SALES,
        StaffRole.OPS_MANAGER,
        StaffRole.TRIP_COORDINATOR,
    }
)

#: Roles permitted to record money. Deliberately narrower than RESERVATION_ROLES:
#: doc 06 wants finance held separately, and under decision O3 every one of these
#: rows is a human asserting that money actually arrived.
FINANCE_ROLES = frozenset(
    {
        StaffRole.SUPER_ADMIN,
        StaffRole.FOUNDER,
        StaffRole.FINANCE,
    }
)

#: Roles permitted to report an incident. Deliberately the widest set in this file.
#: Doc 06 wants least privilege on *reading* sensitive data; reporting that something
#: went wrong is the opposite problem, and a coordinator who cannot file one because
#: of a permission is a coordinator who tells nobody.
INCIDENT_ROLES = frozenset(
    {
        StaffRole.SUPER_ADMIN,
        StaffRole.FOUNDER,
        StaffRole.OPS_MANAGER,
        StaffRole.TRIP_COORDINATOR,
        StaffRole.SALES,
        StaffRole.DOCUMENT_REVIEWER,
        StaffRole.STATUS_PUBLISHER,
        StaffRole.FINANCE,
    }
)

#: Roles permitted to edit catalogue content.
CONTENT_ROLES = frozenset(
    {
        StaffRole.SUPER_ADMIN,
        StaffRole.FOUNDER,
        StaffRole.OPS_MANAGER,
        StaffRole.CONTENT_EDITOR,
    }
)


class StaffUser(Base, TimestampMixin):
    """better-auth `user` model, renamed to avoid colliding with Raahi's."""

    __tablename__ = "staff_users"
    __table_args__ = (
        CheckConstraint("array_length(roles, 1) >= 1", name="staff_needs_a_role"),
        Index("ix_staff_users_email", "email", unique=True),
    )

    #: better-auth issues string ids, not integers.
    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    email: Mapped[str] = mapped_column(String(320), nullable=False)
    email_verified: Mapped[bool] = mapped_column(
        Boolean, default=False, server_default=text("false"), nullable=False
    )
    image: Mapped[str | None] = mapped_column(Text)

    #: Multiple roles per person — a three-founder team wears several hats.
    roles: Mapped[list[str]] = mapped_column(
        ARRAY(String(40)), nullable=False, server_default=text("'{read_only}'")
    )
    #: Revocation without deletion, so past attributions stay resolvable.
    #:
    #: This is the supported way to remove somebody. Deleting a staff row SET NULLs
    #: `reservations.coordinator_staff_id`, which then violates the check constraint
    #: requiring a confirmed reservation to have a coordinator, and the delete fails
    #: with an opaque error. That refusal is correct: a confirmed family must not be
    #: left in nobody's inbox. Deactivate here, reassign their reservations, and the
    #: record of who did what survives.
    is_active: Mapped[bool] = mapped_column(
        Boolean, default=True, server_default=text("true"), nullable=False
    )

    sessions: Mapped[list[StaffSession]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    accounts: Mapped[list[StaffAccount]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )

    def has_any(self, allowed: frozenset[StaffRole]) -> bool:
        if not self.is_active:
            return False
        return any(role in {r.value for r in allowed} for role in self.roles)


class StaffSession(Base, TimestampMixin):
    __tablename__ = "staff_sessions"
    __table_args__ = (Index("ix_staff_sessions_token", "token", unique=True),)

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[str] = mapped_column(
        ForeignKey("staff_users.id", ondelete="CASCADE"), nullable=False
    )
    token: Mapped[str] = mapped_column(String(255), nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    ip_address: Mapped[str | None] = mapped_column(String(64))
    user_agent: Mapped[str | None] = mapped_column(Text)

    user: Mapped[StaffUser] = relationship(back_populates="sessions")


class StaffAccount(Base, TimestampMixin):
    __tablename__ = "staff_accounts"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    account_id: Mapped[str] = mapped_column(String(255), nullable=False)
    provider_id: Mapped[str] = mapped_column(String(64), nullable=False)
    user_id: Mapped[str] = mapped_column(
        ForeignKey("staff_users.id", ondelete="CASCADE"), nullable=False
    )
    #: Hashed by better-auth. Never a plaintext value.
    password: Mapped[str | None] = mapped_column(Text)
    access_token: Mapped[str | None] = mapped_column(Text)
    refresh_token: Mapped[str | None] = mapped_column(Text)
    id_token: Mapped[str | None] = mapped_column(Text)
    access_token_expires_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True)
    )
    refresh_token_expires_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True)
    )
    scope: Mapped[str | None] = mapped_column(Text)

    user: Mapped[StaffUser] = relationship(back_populates="accounts")


class StaffVerification(Base, TimestampMixin):
    __tablename__ = "staff_verifications"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    identifier: Mapped[str] = mapped_column(String(320), nullable=False)
    value: Mapped[str] = mapped_column(Text, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
