"""Permit checklist and traveller document uploads.

Doc 06 is emphatic that the checklist is configuration, not a constant: requirements
differ by "journey and departure, operating partner, nationality, age or traveller
category, permit authority, current season or rule version. Do not encode a single
permanent checklist into the product."

Doc 05 supplies the submission states, and the rule that matters most:

    "The portal does not label a document as approved merely because it was uploaded."

Upload and review are therefore separate states with separate actors, and acceptance
requires a named reviewer. Files live in private object storage; only a storage key
is held here, never a public URL (doc 08: "Do not expose raw document locations
directly to public clients").
"""

from __future__ import annotations

import enum
from datetime import date, datetime
from typing import Any

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from api.db import Base, LocalizedText, TimestampMixin, pg_enum, requires_english


class DocumentState(enum.StrEnum):
    """Doc 05's document states, in lifecycle order."""

    REQUIRED = "required"
    AWAITING_UPLOAD = "awaiting_upload"
    UPLOADED = "uploaded"
    UNDER_REVIEW = "under_review"
    ACCEPTED = "accepted"
    NEEDS_CORRECTION = "needs_correction"
    EXPIRED = "expired"
    WAIVED = "waived"
    SUBMITTED_TO_OPERATOR = "submitted_to_operator"
    OUTCOME_RECORDED = "outcome_recorded"


class TravellerCategory(enum.StrEnum):
    """Who a requirement applies to. Age bands only where lawfully needed."""

    ALL = "all"
    INDIAN_NATIONAL = "indian_national"
    FOREIGN_NATIONAL = "foreign_national"
    MINOR = "minor"


class DocumentRequirement(Base, TimestampMixin):
    """A configurable checklist item.

    Scoped to a journey or a specific departure. A NULL journey_id and departure_id
    means it applies everywhere — useful for baseline identity documents.
    """

    __tablename__ = "document_requirements"
    __table_args__ = (
        UniqueConstraint("code", "journey_id", "departure_id", "applies_to"),
        requires_english("label"),
        # Doc 03: "Do not imply that completing the website checklist guarantees
        # permit approval." A requirement may never assert an outcome.
        CheckConstraint(
            "not (is_mandatory and is_permit_bearing and guarantees_nothing = false)",
            # Kept short on purpose: with the ck_document_requirements_ prefix this
            # must stay under Postgres's 63-char identifier limit, or the name gets
            # hash-truncated and never matches the model again.
            name="permit_docs_cannot_promise_approval",
        ),
        Index("ix_document_requirements_journey", "journey_id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    #: Stable identifier: photo_id, aadhaar, passport_photos, medical_fitness, insurance.
    code: Mapped[str] = mapped_column(String(60), nullable=False)
    label: Mapped[dict[str, Any]] = mapped_column(LocalizedText(), nullable=False)
    description: Mapped[dict[str, Any] | None] = mapped_column(LocalizedText())

    journey_id: Mapped[int | None] = mapped_column(
        ForeignKey("journeys.id", ondelete="CASCADE")
    )
    departure_id: Mapped[int | None] = mapped_column(
        ForeignKey("departures.id", ondelete="CASCADE")
    )
    applies_to: Mapped[TravellerCategory] = mapped_column(
        pg_enum(TravellerCategory, "traveller_category"),
        nullable=False,
        server_default=text("'all'"),
    )

    is_mandatory: Mapped[bool] = mapped_column(
        Boolean, default=True, server_default=text("true"), nullable=False
    )
    #: True when this document feeds a permit application, which is what makes the
    #: "no guaranteed approval" language mandatory on the public page.
    is_permit_bearing: Mapped[bool] = mapped_column(
        Boolean, default=False, server_default=text("false"), nullable=False
    )
    #: Structural reminder that submission never equals approval. Always true; the
    #: check constraint exists so nobody can quietly flip it to sell certainty.
    guarantees_nothing: Mapped[bool] = mapped_column(
        Boolean, default=True, server_default=text("true"), nullable=False
    )

    #: Whether a file is expected, or just an acknowledgement (e.g. "carry originals").
    requires_file: Mapped[bool] = mapped_column(
        Boolean, default=True, server_default=text("true"), nullable=False
    )
    sort_order: Mapped[int] = mapped_column(
        Integer, default=0, server_default=text("0"), nullable=False
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean, default=True, server_default=text("true"), nullable=False
    )


class DocumentSubmission(Base, TimestampMixin):
    """A traveller's response to one requirement.

    Not linked to a Traveller table yet — bookings are Phase 2 — so this carries the
    lead reference and a free-text traveller name. The FK moves to `travellers` when
    that table lands, without changing the state machine.
    """

    __tablename__ = "document_submissions"
    __table_args__ = (
        # Doc 05: uploading is not approval. Acceptance demands a named human.
        CheckConstraint(
            "state <> 'accepted' or reviewed_by is not null",
            name="acceptance_requires_a_reviewer",
        ),
        CheckConstraint(
            "state <> 'needs_correction' or correction_reason is not null",
            name="correction_requires_a_reason",
        ),
        # Doc 06: a waiver must be attributable.
        CheckConstraint(
            "state <> 'waived' or (waived_by is not null and waiver_reason is not null)",
            name="waiver_requires_owner_and_reason",
        ),
        # A file-bearing submission past upload must actually reference an object.
        CheckConstraint(
            "state in ('required','awaiting_upload','waived') or storage_key is not null",
            name="submitted_document_needs_storage_key",
        ),
        Index("ix_document_submissions_state", "state"),
        Index("ix_document_submissions_lead", "lead_id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    requirement_id: Mapped[int] = mapped_column(
        ForeignKey("document_requirements.id", ondelete="RESTRICT"), nullable=False
    )
    #: Phase 2: a submission belongs to a reservation once one exists. Nullable
    #: because a document can legitimately be requested from a lead before they
    #: reserve, and because every row written before reservations existed has none.
    reservation_id: Mapped[int | None] = mapped_column(
        ForeignKey("reservations.id", ondelete="CASCADE")
    )
    #: Which named traveller this belongs to. A permit is per person, so a party of
    #: four produces four sets, and "the lead uploaded a passport" is not enough.
    #: Named explicitly: the convention would generate a 70-character name, and
    #: Postgres truncates at 63 and appends a hash, which then differs from what the
    #: migration wrote.
    reservation_traveller_id: Mapped[int | None] = mapped_column(
        ForeignKey(
            "reservation_travellers.id",
            ondelete="CASCADE",
            name="fk_document_submissions_res_traveller",
        )
    )
    lead_id: Mapped[int | None] = mapped_column(
        ForeignKey("leads.id", ondelete="CASCADE")
    )
    departure_id: Mapped[int | None] = mapped_column(
        ForeignKey("departures.id", ondelete="SET NULL")
    )
    traveller_name: Mapped[str | None] = mapped_column(String(200))

    state: Mapped[DocumentState] = mapped_column(
        pg_enum(DocumentState, "document_state"),
        nullable=False,
        server_default=text("'required'"),
    )

    #: Object key in private storage. NEVER a public URL — access is issued as a
    #: short-lived signed URL at request time, to an authorised reviewer only.
    storage_key: Mapped[str | None] = mapped_column(Text)
    original_filename: Mapped[str | None] = mapped_column(String(255))
    content_type: Mapped[str | None] = mapped_column(String(120))
    byte_size: Mapped[int | None] = mapped_column(Integer)

    uploaded_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    reviewed_by: Mapped[str | None] = mapped_column(String(120))
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    #: Customer-facing. Distinct from internal notes, which travellers never see.
    correction_reason: Mapped[dict[str, Any] | None] = mapped_column(LocalizedText())
    internal_note: Mapped[str | None] = mapped_column(Text)

    waived_by: Mapped[str | None] = mapped_column(String(120))
    waiver_reason: Mapped[str | None] = mapped_column(Text)

    valid_until: Mapped[date | None] = mapped_column(Date)
    #: Recorded outcome from the permit authority. Never inferred from the file.
    operator_outcome: Mapped[str | None] = mapped_column(String(120))

    requirement: Mapped[DocumentRequirement] = relationship()


class DocumentAccessLog(Base, TimestampMixin):
    """Who opened a traveller's document, and when.

    Doc 06: "Track access and download for sensitive documents." Identity documents
    are the highest-risk data this platform holds; doc 09's risk register rates a leak
    as severe trust and legal impact. Reads are logged, not just writes.
    """

    __tablename__ = "document_access_log"
    __table_args__ = (
        Index("ix_document_access_log_submission", "submission_id", "created_at"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    submission_id: Mapped[int] = mapped_column(
        ForeignKey("document_submissions.id", ondelete="CASCADE"), nullable=False
    )
    staff_user_id: Mapped[str | None] = mapped_column(String(64))
    action: Mapped[str] = mapped_column(String(40), nullable=False)
    ip_address: Mapped[str | None] = mapped_column(String(64))
