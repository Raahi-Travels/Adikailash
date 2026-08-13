"""Recorded acquisition spend, so cost per lead has a numerator (doc 07).

Doc 07's acquisition metrics — spend by channel, cost per qualified lead, cost per
confirmed traveller — all need one input this system does not otherwise have: what
was actually spent. Everything else (leads, reservations, supplier cost, refunds) is
already a by-product of running the business; spend is not, so it has to be entered.

**The table is expected to be empty for now**, and that is a supported state rather
than a gap to be papered over. The founders are organic-first per doc 03, and
`SourcePerformance.cost_per_qualified_lead` returns `None` — not zero — when no row
exists for a source. Zero would read as "free"; `None` reads as "we have not measured
this", which is the truth.

Entered by hand on purpose. Pulling spend from an ad platform API would tie a
three-person team to a provider before they have decided whether to advertise at all,
and a monthly number typed from an invoice is both more accurate than a mis-mapped
API pull and impossible to misattribute silently.
"""

from __future__ import annotations

from datetime import date
from decimal import Decimal

from sqlalchemy import (
    CheckConstraint,
    Date,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column

from api.db import Base, TimestampMixin


class AcquisitionSpend(Base, TimestampMixin):
    """What was spent on one channel over one period.

    A period rather than a date because that is how spend is actually known: an
    invoice covers a month, a photographer's day rate covers a shoot. Pretending to
    daily precision we do not have would make the cost-per-lead series look far more
    trustworthy than it is.
    """

    __tablename__ = "acquisition_spend"
    __table_args__ = (
        # One row per channel per period. A second row for the same month is almost
        # always a double entry, and a silently doubled denominator makes a channel
        # look half as efficient as it is.
        UniqueConstraint(
            "channel", "campaign", "period_start", name="one_spend_row_per_period"
        ),
        CheckConstraint("period_end >= period_start", name="spend_period_ordered"),
        CheckConstraint("amount >= 0", name="spend_not_negative"),
        CheckConstraint("length(trim(channel)) > 0", name="spend_channel_present"),
        Index("ix_acquisition_spend_period", "period_start", "period_end"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    #: Must match the `first_touch_source` values leads arrive with, or the join
    #: produces a spend row that attributes to nothing. The report surfaces
    #: unmatched channels rather than dropping them, so a typo is visible.
    channel: Mapped[str] = mapped_column(String(120), nullable=False)
    #: Optional finer grain, matching `Lead.campaign`. Empty string rather than NULL
    #: so the unique constraint above actually holds — in Postgres, NULLs are
    #: distinct, so two NULL-campaign rows for the same channel and month would both
    #: be allowed and the spend would silently double.
    campaign: Mapped[str] = mapped_column(
        String(160), nullable=False, default="", server_default=text("''")
    )

    period_start: Mapped[date] = mapped_column(Date, nullable=False)
    period_end: Mapped[date] = mapped_column(Date, nullable=False)

    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    currency: Mapped[str] = mapped_column(
        String(3), nullable=False, default="INR", server_default=text("'INR'")
    )

    #: What the money bought, in words. "Instagram boost for the May departure" is
    #: worth more six months later than a line item, and this is the only field that
    #: will still explain a surprising number next season.
    note: Mapped[str | None] = mapped_column(Text)
    recorded_by: Mapped[str | None] = mapped_column(String(120))
