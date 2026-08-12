"""Post-trip feedback, the complaint gate, public reviews and referrals (doc 07).

The rules live in `api.domain.advocacy` and are tested without a database. These are
the rows.

**Why feedback is a table and not a form emailed to somebody.** Doc 07's step 2 —
"identify and resolve material complaints" — is only enforceable if a complaint has
a state and an owner. A form that arrives as mail is read once, agreed with, and
forgotten; the traveller then gets a cheerful review request a week later. Rows with
a `resolution_state` are what make the gate in the domain module mean anything.

**No aggregate rating is exposed anywhere public.** Doc 02 and doc 03 are explicit
about not manufacturing social proof, and a `TravelAgency` carrying `aggregateRating`
before a single real review exists is exactly that. When there are genuine reviews
this table is where the number would come from — computed from these rows, never
typed into a template.
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
    Integer,
    SmallInteger,
    String,
    Text,
    UniqueConstraint,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from api.db import Base, TimestampMixin, pg_enum
from api.models.subscriptions import generate_token


class ResolutionState(enum.StrEnum):
    OPEN = "open"
    RESOLVED = "resolved"
    ACKNOWLEDGED = "acknowledged"


class ReviewPlatform(enum.StrEnum):
    GOOGLE = "google"
    TRIPADVISOR = "tripadvisor"
    #: Published on our own site, with the traveller's name and consent.
    OWN_SITE = "own_site"


class TripFeedback(Base, TimestampMixin):
    """One traveller's private answers after a journey.

    Private is the operative word: nothing here is published. Doc 07 step 1 exists so
    a problem reaches us before it reaches the internet, and that bargain only holds
    if we keep our side of it.

    One row per reservation. Per-traveller would be more honest — a father and a son
    may feel differently about the same trip — but it needs every companion to have
    their own access, which doc 05 only makes P1. The token model here is per
    reservation, and the free-text field asks whose view it is.
    """

    __tablename__ = "trip_feedback"
    __table_args__ = (
        UniqueConstraint("reservation_id", name="one_feedback_per_reservation"),
        CheckConstraint(
            "recommend_score is null or recommend_score between 0 and 10",
            name="recommend_score_range",
        ),
        # Every dimension is 1-5 or unanswered. Zero is not a rating; it is the
        # thing an empty form control posts, and it must not be stored as "terrible".
        *[
            CheckConstraint(
                f"{col} is null or {col} between 1 and 5", name=f"{col}_range"
            )
            for col in (
                "sales_promise_accuracy",
                "preparation",
                "pickup_and_transport",
                "accommodation",
                "coordinator_support",
                "route_communication",
                "spiritual_and_cultural",
            )
        ],
        Index("ix_trip_feedback_submitted", "submitted_at"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    reservation_id: Mapped[int] = mapped_column(
        ForeignKey("reservations.id", ondelete="CASCADE"), nullable=False
    )

    #: The link we send. Single-use for submission, then kept so the traveller can
    #: come back and read what they said.
    token: Mapped[str] = mapped_column(
        String(64), nullable=False, unique=True, default=generate_token
    )
    invited_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    submitted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    #: Who filled it in, in their words. Not matched against the traveller list:
    #: correcting somebody about their own name at this moment is graceless.
    submitted_by: Mapped[str | None] = mapped_column(String(200))

    # --- The seven dimensions from doc 05. Nullable: unanswered is not a 1. ---
    sales_promise_accuracy: Mapped[int | None] = mapped_column(SmallInteger)
    preparation: Mapped[int | None] = mapped_column(SmallInteger)
    pickup_and_transport: Mapped[int | None] = mapped_column(SmallInteger)
    accommodation: Mapped[int | None] = mapped_column(SmallInteger)
    coordinator_support: Mapped[int | None] = mapped_column(SmallInteger)
    route_communication: Mapped[int | None] = mapped_column(SmallInteger)
    spiritual_and_cultural: Mapped[int | None] = mapped_column(SmallInteger)

    #: 0-10 "would you recommend us".
    recommend_score: Mapped[int | None] = mapped_column(SmallInteger)

    what_went_well: Mapped[str | None] = mapped_column(Text)
    #: The most valuable field on the form. A non-empty answer here opens a
    #: complaint regardless of how generous the star ratings were.
    what_went_wrong: Mapped[str | None] = mapped_column(Text)

    complaints: Mapped[list[FeedbackComplaint]] = relationship(
        back_populates="feedback", cascade="all, delete-orphan"
    )
    review_requests: Mapped[list[ReviewRequest]] = relationship(
        back_populates="feedback", cascade="all, delete-orphan"
    )


class FeedbackComplaint(Base, TimestampMixin):
    """Something that went wrong, and what was done about it.

    Rows are created automatically from low ratings and non-empty "what went wrong"
    text, and may also be logged by a coordinator after a phone call. Until every
    row is out of `open`, the review request endpoint refuses.

    `resolution_note` is NOT NULL once resolved, enforced by a check. "Resolved"
    with no note is a checkbox somebody ticked to clear a screen, which is the
    failure mode this table exists to prevent.
    """

    __tablename__ = "feedback_complaints"
    __table_args__ = (
        CheckConstraint(
            "resolution_state = 'open' "
            "or (resolved_by is not null "
            "and length(trim(coalesce(resolution_note,''))) > 0)",
            name="resolution_needs_an_owner_and_a_note",
        ),
        Index("ix_feedback_complaints_state", "resolution_state"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    feedback_id: Mapped[int] = mapped_column(
        ForeignKey("trip_feedback.id", ondelete="CASCADE"), nullable=False
    )

    #: A dimension key, or "what_went_wrong" for the free-text one.
    dimension: Mapped[str] = mapped_column(String(60), nullable=False)
    rating: Mapped[int | None] = mapped_column(SmallInteger)
    detail: Mapped[str | None] = mapped_column(Text)

    resolution_state: Mapped[ResolutionState] = mapped_column(
        pg_enum(ResolutionState, "complaint_resolution_state"),
        nullable=False,
        default=ResolutionState.OPEN,
        server_default=text("'open'"),
    )
    resolution_note: Mapped[str | None] = mapped_column(Text)
    resolved_by: Mapped[str | None] = mapped_column(String(120))
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    feedback: Mapped[TripFeedback] = relationship(back_populates="complaints")


class ReviewRequest(Base, TimestampMixin):
    """An invitation to write something public, and what came of it.

    Doc 07 step 4: "Provide a direct link without scripting false praise." We record
    the platform and that we asked. We do not record, suggest or store draft text —
    there is no `suggested_wording` column and there should never be one.

    Doc 07 step 5 wants image, video and story reuse permission asked for
    *separately*. Three booleans rather than one, because bundling them means a
    traveller who agreed to a written review discovers their family's photograph on a
    landing page.
    """

    __tablename__ = "review_requests"
    __table_args__ = (
        UniqueConstraint("feedback_id", "platform", name="one_ask_per_platform"),
        Index("ix_review_requests_asked", "asked_at"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    feedback_id: Mapped[int] = mapped_column(
        ForeignKey("trip_feedback.id", ondelete="CASCADE"), nullable=False
    )

    platform: Mapped[ReviewPlatform] = mapped_column(
        pg_enum(ReviewPlatform, "review_platform"), nullable=False
    )
    asked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    asked_by: Mapped[str | None] = mapped_column(String(120))
    #: Recorded when somebody tells us, or when we find it. Never scraped.
    left_review_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    # --- Separate permissions, asked separately (doc 07 step 5). ---
    may_publish_written_review: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default=text("false")
    )
    may_publish_images: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default=text("false")
    )
    may_publish_story: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default=text("false")
    )
    permission_note: Mapped[str | None] = mapped_column(Text)

    feedback: Mapped[TripFeedback] = relationship(back_populates="review_requests")


class Referral(Base, TimestampMixin):
    """A traveller's personal share code.

    Doc 07: "The most powerful referral message is reliable delivery, not a large
    discount." `benefit` is therefore nullable and defaults to nothing, and the
    terms version records what was in force when the code was issued — somebody who
    referred under the first version is owed the first version.
    """

    __tablename__ = "referrals"
    __table_args__ = (
        UniqueConstraint("code", name="referral_code_unique"),
        CheckConstraint("length(trim(code)) >= 4", name="referral_code_present"),
        Index("ix_referrals_reservation", "reservation_id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    #: Which trip earned it. Null for a code issued by hand to somebody who never
    #: travelled with us — a partner, an advisor — which doc 07 anticipates.
    reservation_id: Mapped[int | None] = mapped_column(
        ForeignKey("reservations.id", ondelete="SET NULL")
    )

    code: Mapped[str] = mapped_column(String(24), nullable=False)
    #: Shown to the referrer, and to whoever they send it to: "Meera thought you
    #: might want to see this." Attribution is the point (doc 07).
    referrer_name: Mapped[str | None] = mapped_column(String(200))

    terms_version: Mapped[str] = mapped_column(String(40), nullable=False)
    #: Null means recognition without payment, which is the launch position.
    benefit: Mapped[str | None] = mapped_column(Text)

    is_active: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default=text("true")
    )
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    revoked_reason: Mapped[str | None] = mapped_column(Text)

    attributions: Mapped[list[ReferralAttribution]] = relationship(
        back_populates="referral"
    )


class ReferralAttribution(Base, TimestampMixin):
    """Somebody arrived with a code.

    `referral_id` is nullable and `raw_code` is not: a code that we do not recognise
    is still worth keeping. Somebody mistyped, or a code was revoked, and either way
    a coordinator seeing "they mentioned MEE-K4T9P" can find the right traveller and
    thank them. A foreign key alone would silently discard that.
    """

    __tablename__ = "referral_attributions"
    __table_args__ = (
        UniqueConstraint("lead_id", name="one_attribution_per_lead"),
        Index("ix_referral_attributions_referral", "referral_id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    lead_id: Mapped[int] = mapped_column(
        ForeignKey("leads.id", ondelete="CASCADE"), nullable=False
    )
    referral_id: Mapped[int | None] = mapped_column(
        ForeignKey("referrals.id", ondelete="SET NULL")
    )
    #: Exactly what they typed, before normalisation.
    raw_code: Mapped[str] = mapped_column(String(40), nullable=False)
    matched: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default=text("false")
    )

    referral: Mapped[Referral | None] = relationship(back_populates="attributions")
