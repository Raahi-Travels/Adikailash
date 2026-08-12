"""Family share links and their audit trail (doc 05, P1).

The projection these links resolve to is `api.domain.sharing.FamilyView`, which is
constructed field by field precisely so a new sensitive column cannot reach it. This
module only holds the grant.

**Three properties the grant must have, all for the same reason.** A share link gets
forwarded — that is what it is for, and a family WhatsApp group is where it lands. So
it is revocable (the group lead changes their mind), it expires (a link from the 2026
season should not still open in 2029), and every view is logged (doc 05: "Download
and sharing are auditable"). None of those are optional once you accept that the
audience is wider than the person you sent it to.
"""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from api.db import Base, TimestampMixin
from api.models.subscriptions import generate_token


class FamilyShare(Base, TimestampMixin):
    """One link, giving one person the reassurance view of one reservation."""

    __tablename__ = "family_shares"
    __table_args__ = (
        CheckConstraint("length(trim(label)) > 0", name="share_label_present"),
        CheckConstraint(
            "revoked_at is null or revoked_reason is not null",
            name="revocation_needs_a_reason",
        ),
        Index("ix_family_shares_reservation", "reservation_id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    reservation_id: Mapped[int] = mapped_column(
        ForeignKey("reservations.id", ondelete="CASCADE"), nullable=False
    )

    token: Mapped[str] = mapped_column(
        String(64), nullable=False, unique=True, default=generate_token
    )
    #: What the group lead calls this person — "Amma", "Rakesh bhaiya". Shown back
    #: to them on the manage screen so revoking the right link is possible without
    #: comparing tokens.
    label: Mapped[str] = mapped_column(String(120), nullable=False)
    created_by: Mapped[str | None] = mapped_column(String(200))

    #: Set at creation to shortly after the journey ends. A link that never expires
    #: is a link that outlives the reason it was made.
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    revoked_reason: Mapped[str | None] = mapped_column(Text)

    #: Denormalised for the manage screen, so listing shares does not need a join
    #: and a count. The log below stays the record of truth.
    view_count: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, server_default=text("0")
    )
    last_viewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    #: Doc 05 lists a check-in summary as offered rather than assumed. A group lead
    #: who does not want daily movement shared can turn it off without revoking.
    shows_check_ins: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default=text("true")
    )

    views: Mapped[list[FamilyShareView]] = relationship(
        back_populates="share", cascade="all, delete-orphan"
    )

    def is_usable(self, *, now: datetime) -> bool:
        return self.revoked_at is None and self.expires_at > now


class FamilyShareView(Base, TimestampMixin):
    """One opening of a share link.

    Deliberately thin. Doc 08 treats an IP address as personal data, and logging the
    full address of a worried relative to audit a page that shows a broad itinerary
    is disproportionate — so we keep a truncated address only, enough to tell "one
    person refreshing" from "forwarded to thirty people".
    """

    __tablename__ = "family_share_views"
    __table_args__ = (Index("ix_family_share_views_share", "share_id", "created_at"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    share_id: Mapped[int] = mapped_column(
        ForeignKey("family_shares.id", ondelete="CASCADE"), nullable=False
    )
    #: First three octets of IPv4, or the /48 of IPv6. Never the full address.
    coarse_address: Mapped[str | None] = mapped_column(String(64))
    user_agent_family: Mapped[str | None] = mapped_column(String(80))

    share: Mapped[FamilyShare] = relationship(back_populates="views")
