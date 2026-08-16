"""live source readings

One row per outside source, overwritten in place, so a page load never depends on a
government portal being reachable. New table plus one new enum, both inside `yatra`.

Revision ID: c8e2f1a47b56
Revises: b1d4e7a92f03
Create Date: 2026-08-17

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "c8e2f1a47b56"
down_revision: Union[str, Sequence[str], None] = "b1d4e7a92f03"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# Created explicitly with a schema so it lands in `yatra` rather than `public`. The
# database is shared with another product (decision D6) and an enum leaking into the
# public schema is the exact kind of collision that is invisible until it is not.
LIVE_SOURCE = postgresql.ENUM(
    "permit_portal",
    "road_register",
    "hazard_alerts",
    "bed_availability",
    name="live_source",
    schema="yatra",
    create_type=False,
)


def upgrade() -> None:
    LIVE_SOURCE.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "live_readings",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("source", LIVE_SOURCE, nullable=False),
        sa.Column(
            "payload", postgresql.JSONB(astext_type=sa.Text()), nullable=False
        ),
        sa.Column("fetched_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("last_error", sa.Text(), nullable=True),
        sa.Column("last_attempt_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("source_url", sa.String(length=300), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        # Matches TimestampMixin exactly: nullable, no server default, populated by
        # SQLAlchemy's `onupdate` on subsequent writes. Declaring it NOT NULL here
        # made every INSERT fail, because the ORM sends an explicit NULL on create.
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        # One row per source. The upsert depends on this, and without it a failing
        # job would quietly append instead of replacing.
        sa.UniqueConstraint("source", name="one_reading_per_source"),
        schema="yatra",
    )


def downgrade() -> None:
    op.drop_table("live_readings", schema="yatra")
    LIVE_SOURCE.drop(op.get_bind(), checkfirst=True)
