"""Route-status subscriptions and the outbound queue (Phase 4, doc 07).

**Why this exists as its own table rather than a flag on a lead.** Somebody may want
route alerts without ever enquiring — that is a perfectly reasonable relationship with
a company whose differentiator is telling the truth about a road. Forcing them
through a sales record to get one would be both dishonest about what they asked for
and a worse consent story.

**Consent is a record, not a boolean.** `confirmed_at` and `unsubscribed_at` are
timestamps with a token behind each. Doc 08 classifies contact details as personal
data and India's DPDP Act requires consent to be demonstrable, which a `true` in a
column is not. `LeadConsent` already does this for enquiries; this mirrors it.

**Unsubscribing must be trivial and must not require a login.** A one-click token is
in every message. Anything harder is a dark pattern, and doc 03 rules those out.

**Nothing sends yet.** Decision O9 has not settled a messaging provider, so the queue
fills and holds. That is deliberate and visible in the admin rather than silent: a
queue with a growing backlog and no provider is an honest state; a subscription
button that quietly discards is not.
"""

from __future__ import annotations

import enum
import secrets
from datetime import datetime

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from api.db import Base, TimestampMixin, pg_enum


class SubscriptionChannel(enum.StrEnum):
    """Where an alert would go.

    WhatsApp is listed and is not yet reachable. Decision O9 is open, and pretending
    otherwise in an enum would not make a message arrive.
    """

    WHATSAPP = "whatsapp"
    EMAIL = "email"
    SMS = "sms"


class SubscriptionState(enum.StrEnum):
    #: Created, awaiting the holder confirming they own the address or number.
    PENDING = "pending"
    ACTIVE = "active"
    UNSUBSCRIBED = "unsubscribed"
    #: We stopped sending: bounced, blocked, or the number is dead. Distinct from
    #: unsubscribed, because the person never asked to leave and may want fixing.
    SUPPRESSED = "suppressed"


class OutboundState(enum.StrEnum):
    QUEUED = "queued"
    SENT = "sent"
    FAILED = "failed"
    #: Not sent on purpose: the subscriber left, hit their daily cap, or no provider
    #: exists. A first-class outcome, because "why did this never arrive" is the
    #: question this table has to answer.
    SUPPRESSED = "suppressed"


def generate_token() -> str:
    """URL-safe, unguessable. Used for both confirm and unsubscribe links."""
    return secrets.token_urlsafe(24)


class StatusSubscription(Base, TimestampMixin):
    """One person asking to hear when a route changes."""

    __tablename__ = "status_subscriptions"
    __table_args__ = (
        # One live subscription per destination per segment. Re-subscribing
        # reactivates rather than duplicating, or an unsubscribe would only stop one
        # of several rows and the person would keep receiving messages.
        UniqueConstraint(
            "channel", "destination", "route_segment_id", name="one_subscription_each"
        ),
        CheckConstraint("length(trim(destination)) > 0", name="destination_present"),
        CheckConstraint(
            "state <> 'active' or confirmed_at is not null",
            name="active_subscription_needs_confirmation",
        ),
        Index("ix_status_subscriptions_state", "state"),
        Index("ix_status_subscriptions_segment", "route_segment_id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    channel: Mapped[SubscriptionChannel] = mapped_column(
        pg_enum(SubscriptionChannel, "subscription_channel"), nullable=False
    )
    #: Phone number or email. Personal data under doc 08.
    destination: Mapped[str] = mapped_column(String(320), nullable=False)
    name: Mapped[str | None] = mapped_column(String(200))

    #: Null means every segment. Most people want "tell me about the road", not a
    #: particular stretch of it, and forcing a choice would be a worse product.
    route_segment_id: Mapped[int | None] = mapped_column(
        ForeignKey("route_segments.id", ondelete="CASCADE")
    )

    state: Mapped[SubscriptionState] = mapped_column(
        pg_enum(SubscriptionState, "subscription_state"),
        nullable=False,
        default=SubscriptionState.PENDING,
        server_default=text("'pending'"),
    )

    #: Where they signed up, so we can tell whether the status page or a guide is
    #: actually earning subscriptions. Doc 07 wants attribution on nurture.
    source_page: Mapped[str | None] = mapped_column(String(200))
    #: Present when this came from an enquiry, so the two records can be reconciled.
    lead_id: Mapped[int | None] = mapped_column(
        ForeignKey("leads.id", ondelete="SET NULL")
    )

    #: Hashed would be better for a password. These are capability URLs sent to the
    #: holder, need to be looked up by value, and expire on use for confirmation.
    confirm_token: Mapped[str | None] = mapped_column(String(64), unique=True)
    unsubscribe_token: Mapped[str] = mapped_column(
        String(64), nullable=False, unique=True, default=generate_token
    )

    confirmed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    unsubscribed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    suppressed_reason: Mapped[str | None] = mapped_column(Text)
    last_sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    messages: Mapped[list[OutboundMessage]] = relationship(
        back_populates="subscription",
        cascade="all, delete-orphan",
        order_by="OutboundMessage.created_at.desc()",
    )


class OutboundMessage(Base, TimestampMixin):
    """One message we intend to send, or decided not to.

    Provider-agnostic on purpose. When decision O9 settles, a sender reads `QUEUED`
    rows due now and marks them; nothing above this table changes. Until then the
    queue is the honest record of what a subscriber *would* have received, which is
    also what makes it possible to check the materiality rules against reality before
    a single message goes out.

    Suppressed rows are kept rather than deleted. "Why did I not hear about the
    closure" is the question this table exists to answer, and a deleted row answers
    nothing.
    """

    __tablename__ = "outbound_messages"
    __table_args__ = (
        CheckConstraint("length(trim(subject)) > 0", name="outbound_subject_present"),
        CheckConstraint("length(trim(body)) > 0", name="outbound_body_present"),
        CheckConstraint(
            "state <> 'suppressed' or length(trim(coalesce(suppressed_reason,''))) > 0",
            name="suppression_needs_a_reason",
        ),
        Index("ix_outbound_due", "state", "send_after"),
        Index("ix_outbound_subscription", "subscription_id", "created_at"),
        # One message per subscriber per status update. The trigger runs on every
        # publish and a retry must not double-send; the database enforces it rather
        # than the caller remembering to check.
        UniqueConstraint(
            "subscription_id", "status_update_id", name="one_message_per_update"
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    subscription_id: Mapped[int] = mapped_column(
        ForeignKey("status_subscriptions.id", ondelete="CASCADE"), nullable=False
    )
    #: What caused it. Nullable so a future non-status message fits the same queue.
    status_update_id: Mapped[int | None] = mapped_column(
        ForeignKey("status_updates.id", ondelete="SET NULL")
    )

    channel: Mapped[SubscriptionChannel] = mapped_column(
        pg_enum(SubscriptionChannel, "subscription_channel"), nullable=False
    )
    destination: Mapped[str] = mapped_column(String(320), nullable=False)
    subject: Mapped[str] = mapped_column(String(200), nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)

    #: urgent | notable. Urgent ignores quiet hours.
    urgency: Mapped[str] = mapped_column(
        String(20), nullable=False, default="notable", server_default=text("'notable'")
    )

    # --- Pre-approved template, for channels that require one ---
    #
    # WhatsApp refuses free-form business-initiated messages outside a 24-hour reply
    # window, and India's TRAI DLT regime imposes the same rule on SMS. Both need the
    # template's registered *name* and an ordered array of values, not prose — so both
    # are stored, rather than leaving a future sender to re-derive them from `body`
    # by reversing the wording. Null for email, which has no such gatekeeping.
    #
    # `body` still holds the rendered text so the admin queue keeps showing the
    # message a person would receive rather than a row of placeholders.
    template_name: Mapped[str | None] = mapped_column(String(80))
    #: Positional, filling {{1}}, {{2}} … in the approved body. A JSON array rather
    #: than a delimited string because a coordinator's note contains commas.
    template_parameters: Mapped[list[str] | None] = mapped_column(JSONB)
    #: Computed at queue time from quiet hours. A sender picks up rows due now.
    send_after: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )

    state: Mapped[OutboundState] = mapped_column(
        pg_enum(OutboundState, "outbound_state"),
        nullable=False,
        default=OutboundState.QUEUED,
        server_default=text("'queued'"),
    )
    attempts: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, server_default=text("0")
    )
    sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    failed_reason: Mapped[str | None] = mapped_column(Text)
    suppressed_reason: Mapped[str | None] = mapped_column(Text)

    subscription: Mapped[StatusSubscription] = relationship(back_populates="messages")
